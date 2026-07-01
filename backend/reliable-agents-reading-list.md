# Reliable Agents in Production — Reading List
> Para a equipa Nzila Labs. Base de estudo antes de desenhar a arquitetura de agentes da Luena (AI Engine + Persona Operações + automações agent-triggered).
> Critério de inclusão: cada item aqui nomeia um problema real que já vimos no bot da Verano, ou dá uma ferramenta/padrão concreto para resolvê-lo — nada de "10 dicas genéricas de prompt engineering".

---

## 0. Como ler isto

Read nesta ordem. As secções 1–2 mudam como pensas sobre arquitetura *antes* de tocar em código. As secções 3–5 são ferramentas e padrões concretos. A secção 6 é o caso de estudo mais próximo do que estamos a construir (Fin/Intercom) — lê-o a seguir aos fundamentos, não antes, porque só faz sentido com o vocabulário das secções 1–2.

---

## 1. Fundamentos — a distinção que organiza tudo o resto

**Anthropic — "Building Effective Agents"** (Erik Schluntz & Barry Zhang)
`https://www.anthropic.com/engineering/building-effective-agents`

O documento mais citado em 2025-2026 sobre este tema, e com razão: introduz a distinção entre **workflows** (LLM + tools orquestrados por código pré-definido, caminho fixo) e **agents** (o LLM decide dinamicamente os seus próprios passos). A frase que importa: *"find the simplest solution possible, and only increase complexity when needed... this might mean not building agentic systems at all."*

**Por que isto importa para nós:** o bot da Verano já é, na prática, um **workflow com pontos de decisão LLM embutidos** — a FSM decide tudo, o LLM só sugere. Isto está certo conceptualmente (é o padrão "Routing" do paper). O problema não é a arquitetura ser workflow-based; é que partes do workflow (detecção de reset de conversa, gestão de contexto persistente) ainda dependem de regex frágil em vez de sinais estruturados. Mantém a filosofia "FSM decide, LLM sugere" — é a correcta — mas precisamos de tornar os *sinais* que alimentam a FSM mais robustos (secção 2).

Repo de referência com implementações mínimas de cada padrão (prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer):
`https://github.com/anthropics/claude-cookbooks/tree/main/patterns/agents`

**Anthropic — "Effective Context Engineering for AI Agents"**
`https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents`

Define **context engineering** como sucessor de prompt engineering: "curating and maintaining the optimal set of tokens during inference". A ideia central que se aplica directamente à Verano: contexto não é "tudo o que aconteceu" — é "o menor conjunto de tokens de alto sinal que maximiza a probabilidade do resultado desejado". Isto justifica directamente a estratégia de compaction que já têm (micro-compact + auto-compact), mas também aponta para o que falta: decidir **quando** um campo do contexto deixou de ser "alto sinal" (ex: `pendingDestinationCountry` de há 10 turnos atrás) e descartá-lo activamente, não só comprimi-lo.

---

## 2. O problema nomeado — por que "Oi" não reseta o contexto

Isto é a literatura que dá nome científico e soluções concretas ao bug #1 da Verano ("contexto preso").

**Laban et al., 2025 — "LLMs Get Lost in Multi-Turn Conversation"**
`https://arxiv.org/abs/2505.06120` (referenciado por trabalho subsequente, ver ERGO abaixo)

Mede empiricamente o que sentiram a usar o bot: LLMs degradam significativamente em conversas multi-turno comparado com single-turn — **112% de aumento de "unreliability"** em tarefas multi-turno face a single-turno equivalentes. O mecanismo: o modelo faz uma suposição precoce e errada (ex: assume Brasil como destino) e depois sobre-indexa nessa suposição em turnos seguintes, mesmo quando o user já mudou de assunto. Não é "memória fraca" — é "memória demasiado forte para suposições erradas".

**ERGO — "Entropy-guided Resetting for Generation Optimization"**
`https://arxiv.org/pdf/2510.14077`

A solução directa ao problema acima, e é provavelmente o paper mais aplicável de toda esta lista. Ideia central: em vez de tentar detectar "reset" via regex de palavras-chave (que é exactamente o que a Verano faz hoje, e exactamente onde falha — "Oi" nunca vai estar numa lista exaustiva), **monitoriza a entropia de Shannon da distribuição de probabilidade do próximo token**. Picos de entropia = o modelo está incerto/confuso = sinal de que o contexto acumulado deixou de ajudar e está a prejudicar. Quando detecta o pico, reconstrói o prompt removendo o contexto ambíguo.

**Aplicação prática para a Luena (sem precisar de acesso aos logits, que a maioria das APIs não expõe directamente):** não precisamos da implementação exacta de entropia de tokens — precisamos do **princípio**: a decisão de "resetar contexto" não deve ser uma regex de palavras de reset, deve ser uma **chamada LLM dedicada e barata** que classifica, a cada turno, `{ isTopicContinuation: boolean, confidence: number }` comparando a mensagem actual contra o resumo do estado actual. Isto é mais uma chamada LLM (custo: ~50 tokens, latência: ~200ms com modelo pequeno), mas resolve a causa raiz em vez de tentar enumerar todas as frases de reset possíveis em português angolano/brasileiro/europeu.

**Pan, J., 2026 — "Conversational Context Classification: A Representation Engineering Approach"**
`https://arxiv.org/pdf/2601.12286`

Treina um classificador (One-Class SVM sobre hidden states do modelo) para detectar quando uma resposta saiu do contexto esperado. Mais pesado de implementar (exige acesso aos hidden states, não só à API), mas confirma que "out-of-context detection" é tratado na literatura como um problema de classificação binária *separado* da geração de resposta — reforça a ideia de que a Verano precisa de um classificador dedicado, não de heurística textual.

**Padrão prático equivalente, mais simples de implementar já:** o "Context Manager Pattern" do catálogo de prompt patterns da Universidade Vanderbilt (`arxiv.org/pdf/2302.11382`, padrão P) — dar ao sistema uma forma explícita de "within scope X / ignore Z / start over" como parte estruturada do prompt, não como inferência implícita. Isto é o equivalente de baixo-custo do ERGO: em vez de detectar entropia, *perguntamos explicitamente ao LLM, a cada turno*, se o que está a ver ainda é o mesmo tópico — e tratamos isso como um campo estruturado da Chamada 1 (Intent Classification) que já existe no pipeline da Verano, só que actualmente essa chamada não pergunta isto.

---

## 3. Avaliação e testes — como sabes que não regrediste

Este é o ponto mais ausente na arquitetura actual da Verano: há `bot.test.ts` e `bot.eval.test.ts`, mas não há simulação sistemática de utilizador a longo prazo nem regressão automática contra cenários reais.

**IntellAgent — "A Multi-Agent Framework for Evaluating Conversational AI Systems"**
`https://arxiv.org/pdf/2501.11067`

Constrói um **policy graph** representando todas as combinações de regras de negócio possíveis, gera eventos sintéticos a partir desse grafo, e simula conversas completas entre um "user agent" e o chatbot real. O resultado é um relatório granular de *onde exactamente* o sistema falha — não só "passou/falhou", mas "falhou na transição searching_flight→presenting_results quando o user mudou de moeda a meio". Esta é a ferramenta certa para mapear a FSM da Verano (ou da futura Persona Operações da Luena) num grafo de teste e gerar automaticamente os cenários de borda que humanos não pensam em testar manualmente.

**"Toward Scalable Verifiable Reward: Proxy State-Based Evaluation for Multi-turn Tool-Calling LLM Agents"**
`https://arxiv.org/pdf/2602.16246`

Em vez de comparar o output do agente palavra-a-palavra contra um "gold standard" (impossível em conversação aberta), define um **estado proxy estruturado** — o que deveria ter mudado no sistema (deal criado? stage movido? mensagem enviada com X conteúdo?) — e um LLM-judge verifica se esse estado final foi atingido, não se o texto é idêntico. **Human-LLM judge agreement >90%** reportado. Isto é directamente aplicável à Luena: o critério de sucesso de um teste de automação não deve ser "a resposta da IA contém a palavra X", deve ser "o `deal.stage` mudou para Y e o `aiActionsLog` regista Z".

**DeepEval** (open-source, Python/TS)
`https://deepeval.com/docs/introduction` · `https://github.com/confident-ai/deepeval`

Framework de testes estilo pytest para LLMs — 50+ métricas prontas (tool selection accuracy, faithfulness, reasoning coherence, task completion), suporta simulação multi-turno com branching paths, e integra em CI/CD para regressão automática antes de cada deploy. É a ferramenta mais madura e pronta-a-usar desta lista — provavelmente o primeiro investimento concreto a fazer.

**SDialog** (open-source, Python, MIT license)
`https://arxiv.org/pdf/2512.09142` · `github.com/idiap/sdialog`

Toolkit académico mas utilizável: simulação multi-agente persona-driven para gerar diálogos sintéticos controlados, avaliação combinando métricas linguísticas + LLM-as-judge + validadores funcionais. Mais pesado de adoptar que o DeepEval, mas é a referência se quiserem gerar datasets de teste sintéticos em volume (ex: 500 conversas simuladas de "cliente angolano a tentar reservar voo com 3 crianças" para estress-testar o parser de passageiros).

**Confident AI — comparação de ferramentas 2026**
`https://www.confident-ai.com/knowledge-base/compare/best-llm-evaluation-tools-for-ai-agents`

Bom resumo do estado da arte: simulação multi-turno com tool use e branching paths é tratada como standard de 2026, não luxo. Nota a inclusão de **red teaming** (prompt injection, jailbreak, unauthorized tool use) como parte do mesmo pipeline de avaliação — relevante porque a Luena vai expor um MCP server público por workspace; um agente externo malicioso a tentar abusar de scopes é um vector de teste que tem de existir desde o dia 1, não como reacção a um incidente.

---

## 4. Guardrails e tool-calling — impedir que o LLM "minta com confiança"

**MARCO — "Multi-Agent Real-time Chat Orchestration"**
`https://arxiv.org/pdf/2410.21784`

Nomeia dois problemas exactos da Verano (mesmo sem saberem do projecto): **incorrect output formatting** (parsing falha → reflection prompt + retry) e **function hallucination** (LLM inventa nome de tool que não existe → guardrail verifica contra a lista real de tools disponíveis antes de executar, devolve reflection prompt em vez de tentar executar). É essencialmente o "ToolValidator" que já existe na arquitectura da Verano, descrito formalmente — confirma que o padrão está certo, e dá vocabulário para o formalizar melhor.

**"3 Patterns That Fix LLM API Calling"** (DEV.to, 2026)
`https://dev.to/docat0209/3-patterns-that-fix-llm-api-calling-stop-getting-hallucinated-parameters-4n3b`

Três falhas concretas de tool-calling e o fix de cada uma: chaves de parâmetro inventadas, nesting errado, campos obrigatórios omitidos em silêncio. O fix central é sempre o mesmo — **nunca confiar no JSON gerado pelo LLM directamente como input de uma operação real**; validar contra o JSON Schema primeiro, e se inválido, devolver o erro estruturado *ao próprio LLM* para correcção, não ao utilizador final. Isto é literalmente o que o `buildCleanSearchParams()` da Verano já faz bem — o documento generaliza o porquê.

**"AI Agent Guardrails: Rules That LLMs Cannot Bypass"** (DEV.to / AWS, 2026)
`https://dev.to/aws/ai-agent-guardrails-rules-that-llms-cannot-bypass-596d`

Introduz o termo **neurosymbolic**: regras de negócio *não devem viver no prompt* (o LLM pode "hallucinate compliance" com uma instrução textual mesmo lendo-a correctamente). Devem viver em **hooks determinísticos** que interceptam a chamada de tool *antes* da execução — `BeforeToolCallEvent` ou equivalente — e bloqueiam com uma condição Python/TS explícita, testável e auditável. Exemplo do artigo: um agente de viagens que confirma uma reserva sem verificar pagamento, porque o LLM "leu" a regra no docstring mas não a aplicou. **Isto é exactamente a categoria de risco do step `riskLevel='high'` + `automation_approvals` que já desenhámos para a Luena** — confirma que a decisão de pôr o portão de aprovação fora do alcance do LLM (em código, não em prompt) estava certa.

**"7 Guardrails That Reduce LLM Hallucinations"** (Medium, Nexumo)
`https://medium.com/@Nexumo_/7-guardrails-that-reduce-llm-hallucinations-78facbb0d560`

Resumo prático e bem escrito de 7 técnicas (schema enforcement com Pydantic/Zod, grounding via retrieval, tool calls para factos verificáveis como datas/IDs/tabelas em vez de o LLM "lembrar-se", verificação por judge model, decoding constraints, policy gates, observability). Boa referência de checklist antes de cada release.

**"5 AI Agent Error Handling Patterns That Keep Your Agent Running at 3 AM"** (DEV.to, 2026)
`https://dev.to/thedailyagent/5-ai-agent-error-handling-patterns-that-keep-your-agent-running-at-3-am-2j0j`

Cinco padrões com código Python pronto: circuit breaker sobre *qualidade* do output (não só status HTTP — 3 falhas de schema consecutivas → abre o circuito → muda para modelo fallback, exactamente o que a Verano já faz com DeepSeek→Groq, mas aplicado também à *qualidade* da resposta, não só à disponibilidade do provider), validation gates antes de cada tool call, idempotent sagas para workflows multi-passo (checkpoint antes de executar, compensar em falha, saltar passos já completados em retry — relevante directamente para o motor de automações da Luena), budgets rígidos de tokens/ciclos desde o dia 1, e critérios de escalação para humano definidos *antes* de escrever código, não depois de um incidente.

---

## 5. Observability — não se consegue confiar no que não se consegue ver

**Langfuse** (open-source, OpenTelemetry-based)
`https://langfuse.com/docs` · `https://github.com/langfuse/langfuse`

Tornou-se o padrão de facto de 2026 para observability de aplicações LLM — 2.300+ empresas, baseado em OpenTelemetry (logo sem vendor lock-in). Conceitos centrais: **traces** (árvore hierárquica de cada chamada — LLM call, tool call, retrieval — com inputs/outputs/latência/custo completos), **sessions** (agrupamento de múltiplos traces por conversa), **scores** (avaliação anexada directamente ao trace, humana ou LLM-as-judge). A funcionalidade que resolve directamente a frustração de debugging mencionada no README da Verano ("grep logs, 47 chamadas LLM, timestamps sobrepostos"): visualização em árvore que mostra exactamente qual das 3 chamadas NLU produziu o output que desencadeou a cadeia de erro.

**Caso real — Honeycomb + Intercom Fin**
`https://www.honeycomb.io/resources/case-studies/how-honeycomb-helped-intercom-observe-and-operate-fin-ai`

História concreta de como a Intercom resolveu reclamações de lentidão no Fin: a métrica que importava não era latência por componente, era **"time to first token" medido do lado do utilizador**, ponta-a-ponta, através de um sistema distribuído com mudanças de ~100 deploys/dia. Lição directa: instrumentar componentes individualmente não chega — é preciso uma métrica end-to-end que corresponda exactamente à experiência que o utilizador sente, e tratar essa métrica como a fonte de verdade para decidir se uma mudança "ajudou" ou "piorou".

**"Why Agent Tracing Matters: You Can't Debug What You Can't See"** (Towards AI, abril 2026)
`https://medium.com/@richardhightower/langfuse-why-agent-tracing-matters-you-cant-debug-what-you-can-t-see-0b63b92c0495`
Primeiro artigo de uma série de três sobre observability de multi-agentes; bom para a equipa ler antes de instrumentar o que quer que seja, porque estabelece o vocabulário (trace, span, session) que o resto da indústria usa.

---

## 6. O caso de estudo mais próximo — Intercom Fin

Não é só marketing — há detalhe de arquitectura suficiente para ser útil, e é o exemplo mais próximo do que a Luena pretende ser (agente de vendas/suporte que age sobre sistemas reais, não só responde).

**Fin — evolução arquitectural reportada publicamente**
`https://fin.ai/` · `https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained` · `https://www.intercom.com/blog/whats-new-with-fin-3/`

Pontos relevantes para a Luena, por ordem de aplicabilidade:

1. **"We had to evolve Fin from a single LLM call into a complicated agentic system"** — a Intercom não começou agêntico; começou com 1 chamada LLM e foi adicionando complexidade *conforme a métrica de resolução o justificou*. Confirma a recomendação da Anthropic (secção 1): não construir mais complexidade do que o problema actual exige. A Persona Operações da Luena (Fase 3) deve seguir o mesmo caminho — não tentar ser "agêntica" no dia 1, evoluir para lá com dados reais a justificar cada acréscimo.

2. **Procedures** — em vez de dar ao LLM autonomia total sobre processos críticos (reembolsos, alterações de conta), a Intercom combina "instruções em linguagem natural" com **"deterministic controls"** explícitos dentro do procedimento, para garantir que políticas são sempre seguidas e acções sensíveis são sempre tomadas de forma segura. Isto é o mesmo padrão neurosymbolic da secção 4 — confirma que mesmo a líder de mercado não confia no LLM para enforcement de regras, só para a parte conversacional.

3. **Simulations** — ferramenta de teste dedicada onde escolhem um Procedure, um segmento de utilizador, e correm uma conversa simulada completa multi-turno, ver exactamente como o agente segue cada passo, e ajustar o que não comporta como esperado. É a mesma ideia do IntellAgent (secção 3), mas confirma que isto não é académico — é o que a empresa líder do sector usa em produção, com um nome de produto dedicado.

4. **Resolution rate como métrica norte, não accuracy genérica** — a métrica que a Intercom optimiza não é "o LLM respondeu correctamente", é "a conversa foi resolvida sem precisar de escalar para humano, com o cliente satisfeito". Para a Luena isto traduz-se directamente: a métrica que importa para a Persona Vendas não é "taxa de resposta correcta", é **taxa de qualificação correcta antes do handoff** (já existe no schema como `qualificationScore` e `handoffRate` no dashboard de IA) — confirma que as métricas que já desenhámos no `insights-spec.md` estão alinhadas com o que a indústria trata como norte.

5. **Aligned incentives via outcome-based pricing** — não é arquitectura técnica, mas é relevante para o modelo de negócio: cobrar por resolução em vez de por assento dá à Intercom o incentivo de tornar o Fin genuinamente melhor, não só "activo". Vale a pena considerar como argumento de venda para a Luena junto de clientes de consultoria que hesitam: a Luena não ganha dinheiro só por ter a IA "ligada", ganha por ela qualificar leads de verdade.

---

## 7. Decisão de stack — Python ou manter TypeScript/Bun?

Não há necessidade de mudar de stack para resolver os problemas descritos. Nenhuma das ferramentas centrais desta lista exige Python:

- **DeepEval** tem SDK oficial Python primeiro, mas tem também integração via HTTP/CLI utilizável de qualquer stack para CI/CD; o essencial (datasets, LLM-as-judge, regressão) não exige que a aplicação em si seja Python.
- **Langfuse** tem SDK nativo TypeScript/JS de primeira classe (`langfuse-js`), além do Python — não há perda de funcionalidade ao ficar em Bun/Elysia.
- **IntellAgent e SDialog** são ferramentas de *geração de cenários de teste offline*, correm como processo separado (pode ser Python só para essa pipeline de avaliação, falando com o sistema real via HTTP/MCP) — não exigem que o runtime de produção mude.
- Os padrões de guardrail (schema validation, neurosymbolic hooks, circuit breaker sobre qualidade) são conceitos, não bibliotecas — implementam-se igualmente bem em TypeScript com Zod para validação de schema.

**Recomendação:** manter Bun/Elysia/TypeScript no runtime de produção (consistência com o resto da stack Luena e KWPay, reaproveitamento de `Result`/`ErrorFactory`/padrões já maduros). Adoptar Python **apenas** como linguagem da pipeline de avaliação offline (secção 3), porque é onde o ecossistema (DeepEval, SDialog, IntellAgent) é mais maduro — essa pipeline fala com o sistema real via HTTP/MCP, exactamente como um agente externo falaria, então não há acoplamento de runtime.

---

## 8. Resumo executivo — o que estudar primeiro se só houver tempo para 3 coisas

1. **Anthropic, "Building Effective Agents"** + **"Effective Context Engineering"** — vocabulário e princípios que organizam todo o resto.
2. **ERGO** (`arxiv.org/pdf/2510.14077`) — nome científico e solução directa ao bug #1 da Verano.
3. **DeepEval** (`deepeval.com/docs/introduction`) — a ferramenta concreta para parar de testar manualmente via `curl` e começar a ter regressão automática antes de cada deploy.

O resto da lista existe para quando estas três já estiverem a informar decisões reais de código.
