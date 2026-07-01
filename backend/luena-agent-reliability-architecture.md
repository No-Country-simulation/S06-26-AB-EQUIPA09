# Luena — Arquitectura de Agentes Confiáveis em Produção
> Como o AI Engine da Luena (Persona Vendas + Persona Operações) deve ser desenhado, testado e operado.
> Lê-se a seguir ao `reliable-agents-reading-list.md`. Usa o bot da Verano como caso de estudo — dos seus acertos e dos seus bugs nomeados — e aplica directamente os padrões da literatura ao schema e action plan já definidos.
>
> Tese central: **a FSM decide, o LLM sugere** continua certo. O que muda é tornar os *sinais* de decisão estruturados e testados, em vez de regex e vibes.

---

## 1. O Diagnóstico — o que a Verano já fez bem, e onde isso quebra

A Verano não fez nada de fundamentalmente errado na escolha de arquitectura. O padrão "3 chamadas LLM focadas + FSM que decide" é literalmente o padrão **Routing** descrito pela Anthropic — uma das arquitecturas recomendadas para produção, não um anti-padrão. O que falha não é a forma, é onde a disciplina de engenharia parou demasiado cedo:

| O que está certo | Onde a disciplina parou |
|---|---|
| LLM nunca chama tools directamente — FSM valida e decide | `validToolNames` existe, mas não há guardrail formal de *function hallucination* com reflection prompt automático (MARCO) |
| `buildCleanSearchParams()` nunca confia no JSON do LLM directamente | Não há validação de schema com Zod/equivalente antes — é confiança implícita no parser, não um gate explícito |
| Anti-hallucination guards restauram origin/destination | É reactivo (corrige depois do LLM já ter "decidido" errado) — devia ser um guardrail *antes* da geração, via contexto explícito |
| Circuit breaker DeepSeek→Groq existe | É só sobre disponibilidade do provider, não sobre *qualidade* do output (um provider "no ar" mas a devolver JSON malformado 3x seguidas não dispara nada) |
| Detecção de "nova pesquisa" via regex | É o ponto de falha nomeado na literatura (secção 2 do reading list) — regex nunca vai cobrir "Oi", "E tipo eu queria outra coisa", "Espera", etc, em 3 idiomas |
| Testes unitários + eval tests existem | Não há simulação multi-turno sistemática nem regressão automática contra cenários reais antes de cada deploy |

A conclusão prática: **não vamos reescrever a arquitectura da Verano.** Vamos formalizar os pontos onde ela já intuía a coisa certa (guardrails, circuit breaker, anti-hallucination) e fechar os dois buracos que a literatura nomeia como causa raiz — detecção de reset/drift de tópico, e ausência de avaliação sistemática — antes de construir o AI Engine da Luena por cima do mesmo padrão.

---

## 2. Princípio Arquitectural #1 — Workflow com LLM, não Agent autónomo

Seguindo Anthropic (`reading-list §1`): a Luena **não** dá ao LLM controlo total do loop de decisão. O AI Engine da Luena é um **workflow** — código nosso decide as transições de estado e quando chamar o LLM; o LLM nunca decide por si próprio "vou chamar esta tool agora" sem que o nosso código valide essa decisão primeiro.

Isto já estava implícito no automation action plan (regra 8: portão de aprovação para agentes; regra 1-3: idempotência e detecção de loop) e no `ai-engine` (Persona Operações reaproveita as mesmas tools MCP via `handleToolCall`, nunca um caminho de código paralelo). Esta secção só nomeia explicitamente o porquê: **se o LLM tivesse controlo total do loop, não haveria onde colocar o guardrail.** Ao manter o LLM como "sugeridor preenchendo formulários" (exactamente a frase usada no README da Verano), cada sugestão passa por um ponto de validação determinístico antes de se tornar uma acção real no CRM.

```
Mensagem do contacto
        │
        ▼
┌─────────────────────────────────────────┐
│  CAMADA 1 — Sinais Estruturados          │   ← formaliza o que a Verano já tenta
│  (substitui regex por classificação)     │     fazer com regex, ver secção 3
│                                          │
│  1. isTopicContinuation? (confidence)    │
│  2. intent (enum fechado)                │
│  3. entities extraídas (schema validado) │
└─────────────────┬─────────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  CAMADA 2 — FSM / Automation Engine      │   ← código nosso, determinístico
│  decide: reset? continuar? handoff?      │     (já existe — automationEngine,
│  qual tool sugerir, com que parâmetros   │      ai-engine.handleInboundForAi)
└─────────────────┬─────────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  CAMADA 3 — Guardrail de Tool Call        │   ← novo, formal (secção 4)
│  valida schema, valida que a tool existe,│
│  valida regras de negócio (neurosymbolic)│
└─────────────────┬─────────────────────────┘
                  ▼
        Tool executada de verdade
        (mcpServerService.handleToolCall)
                  │
                  ▼
┌─────────────────────────────────────────┐
│  CAMADA 4 — Observability                │   ← novo, formal (secção 6)
│  trace completo: o quê, porquê, quando   │
└─────────────────────────────────────────┘
```

---

## 3. Resolvendo o Bug #1 da Verano — Detecção de Drift sem Regex

### 3.1 O problema, formalizado

O README da Verano já diagnostica isto correctamente: a regex de "nova pesquisa" não cobre greetings ambíguos, e o contexto persiste mesmo quando o tópico mudou. A literatura (Laban et al. 2025, ERGO) confirma que isto não é um bug de regex incompleta — é a manifestação de um problema estrutural conhecido: **LLMs sobre-indexam em suposições precoces e raramente as abandonam sem um sinal explícito**.

### 3.2 A solução — substituir regex por uma chamada estruturada dedicada

Em vez de tentar enumerar frases de reset (impossível em 3 idiomas + gírias regionais), adiciona-se **um campo à Chamada 1 (Intent Classification) que já existe** no pipeline — não é uma chamada LLM extra, é um campo extra na mesma chamada, custo marginal aproximadamente zero:

```typescript
// Chamada 1 — Intent Classification, schema actualizado
type IntentClassificationResult = {
  intent: IntentEnum
  confidence: number
  nextState: ConversationState
  // NOVO — campo estruturado, substitui a regex de reset
  topicContinuity: {
    isSameTopic: boolean
    // true = continua a tarefa em curso (pesquisa de voo, qualificação de lead, etc)
    // false = mudou de assunto, mesmo que de forma ambígua ("Oi", "espera", "outra coisa")
    confidence: number
    // se confidence < 0.6, a FSM trata como ambíguo e pergunta em vez de assumir
  }
}
```

**Prompt da Chamada 1 (acréscimo):**
```
Além de classificar a intenção, avalia se esta mensagem continua o que estava
em curso ou se é um novo assunto. Sinais de NOVO assunto: saudações isoladas
("oi", "olá"), pedidos de pausa ("espera", "deixa"), referências a algo
completamente não relacionado ao contexto actual. Sinais de CONTINUAÇÃO:
respostas directas a uma pergunta feita, confirmações, fornecimento de dados
que a FSM pediu.
```

**Na FSM (código nosso, determinístico — Camada 2):**
```typescript
if (topicContinuity.isSameTopic === false && topicContinuity.confidence >= 0.6) {
  // Reset com confiança — limpa contexto, mas preserva o que for "frio" vs "quente"
  context = pickFrozenFields(context) // ex: nome do contacto, lifecycleStage — nunca dados da tarefa
  state = 'idle'
} else if (topicContinuity.confidence < 0.6) {
  // Ambíguo — não assume nada, pergunta
  return askClarification("Quer continuar [resumo curto da tarefa em curso] ou começar algo novo?")
} else {
  // Continuação confirmada — mantém contexto normalmente
}
```

Isto resolve directamente os 3 sintomas descritos no README da Verano (greeting não limpa contexto, NLU vê contexto antigo, regex restritiva) com **uma mudança de schema numa chamada que já existe**, sem chamada LLM extra, sem necessidade de acesso a logits/entropia (que a maioria das APIs de inferência não expõe — DeepSeek/Groq incluídos). É a versão "pragmática de produção" do princípio do ERGO: o sinal de drift vem de uma pergunta explícita ao modelo, não de uma medição interna que não temos acesso a expor.

### 3.3 Campos "quentes" vs "frios" no contexto — aplicação directa à Luena

O README da Verano já propõe isto como "solução proposta" não implementada ("time-based decay de contexto — campos quentes vs frios"). Para o AI Engine da Luena, formalizamos isto desde o dia 1 em `aiConversations.qualificationData`:

```typescript
// Campos "frios" — nunca expiram, identidade do contacto
{ name, company, phone, email }

// Campos "quentes" — específicos da tarefa em curso, expiram em reset de tópico
{ need, budget, urgency, painPoints, currentDealId, pendingClarification }
```

Quando `topicContinuity.isSameTopic === false`, só os campos frios sobrevivem ao reset. Isto é o equivalente, para um CRM conversacional, do que a Verano precisa para voos: nome/telefone do lead sobrevive a um "Oi" no meio da conversa; o destino/datas da pesquisa anterior não, a menos que o lead confirme explicitamente que quer continuar (mesmo padrão de `previousSearchContext` + pergunta afirmativa que a Verano já tem — está certo, só falta acoplar correctamente ao novo sinal de `topicContinuity` em vez de à regex antiga).

---

## 4. Guardrail Formal de Tool Calling — fechando o Bug #3

A Verano já tem mitigações reactivas (`buildCleanSearchParams`, `hasEntityInCurrentTurn`, whitelist `validToolNames`). A literatura (MARCO, secção 4 do reading list) formaliza isto num padrão de **três gates sequenciais**, que aplicamos ao `agent-gateway` e ao `ai-engine` da Luena (Persona Operações, system design §7.1):

### 4.1 Gate 1 — Existência da Tool (Function Hallucination)

```typescript
function validateToolExists(suggestedTool: string, availableTools: McpToolDefinition[]): Result<McpToolDefinition, AppError> {
  const tool = availableTools.find(t => t.name === suggestedTool)
  if (!tool) {
    // Não falha silenciosamente — gera reflection prompt para o LLM corrigir
    return Err(ErrorFactory.toolNotFound({ suggested: suggestedTool, available: availableTools.map(t => t.name) }))
  }
  return Ok(tool)
}
```
Quando falha: em vez de devolver erro ao utilizador, **devolve-se ao próprio LLM** numa chamada de correcção: *"A tool '{suggestedTool}' não existe. As tools disponíveis são: {lista}. Escolhe a correcta ou responde sem usar tool."* — isto é o "reflection prompt" do MARCO, e o custo é uma chamada extra só no caso (raro) de falha, não no caminho feliz.

### 4.2 Gate 2 — Validação de Schema (Hallucinated Parameters)

```typescript
function validateToolInput(tool: McpToolDefinition, rawInput: unknown): Result<ValidatedInput, AppError> {
  const parseResult = tool.inputSchema.safeParse(rawInput) // Zod, já é a stack da Luena
  if (!parseResult.success) {
    return Err(ErrorFactory.invalidToolInput({ errors: parseResult.error.issues }))
  }
  return Ok(parseResult.data)
}
```
Mesmo princípio do `buildCleanSearchParams()` da Verano, generalizado: nunca passar o JSON gerado pelo LLM directamente para uma operação real. Zod (já presente na stack Luena) é suficiente — não precisa de biblioteca nova.

### 4.3 Gate 3 — Regras de Negócio Neurosymbólicas (o que o prompt não consegue garantir)

Este é o gate que a Verano **não tem formalizado** e que a Luena precisa de ter desde o dia 1, porque opera sobre dinheiro de deals e dados de clientes reais, não só sugestões de voo:

```typescript
// Hook determinístico — corre ANTES de qualquer tool call ser executada de verdade.
// Nunca confiamos que o LLM "leu e seguiu" uma regra escrita em prosa no system prompt.
const NEUROSYMBOLIC_RULES: Record<string, (input, context) => Result<void, AppError>> = {
  'close_deal_won': (input, ctx) => {
    if (!ctx.deal.value || ctx.deal.value <= 0) {
      return Err(ErrorFactory.businessRuleViolation('Deal sem valor definido não pode ser marcado como ganho'))
    }
    return Ok(undefined)
  },
  'send_whatsapp_template': (input, ctx) => {
    if (input.templateCategory === 'marketing' && ctx.contact.optOutMarketing) {
      return Err(ErrorFactory.businessRuleViolation('Contacto optou por não receber marketing'))
    }
    return Ok(undefined)
  },
  'create_custom_object_record': (input, ctx) => {
    // Exemplo do system design §7.1 — IA tentando remarcar consulta sem confirmação
    if (ctx.objectSlug === 'consultas' && input.data?.estado === 'remarcada' && ctx.confidenceScore < 80) {
      return Err(ErrorFactory.requiresHumanConfirmation('Remarcação com baixa confiança requer aprovação humana'))
    }
    return Ok(undefined)
  },
}
```

Isto **não é uma peça nova de infraestrutura** — é exactamente o mesmo mecanismo que `automation_approvals` + `riskLevel='high'` já fazem para automações disparadas por agente (action plan, Fase 2, regra 8). A diferença é que aqui aplicamos o mesmo princípio à Persona Operações da IA (Fase 3) **antes** dela ganhar autonomia sobre custom objects — não depois de um incidente.

---

## 5. Circuit Breaker sobre Qualidade, não só Disponibilidade

A Verano já tem circuit breaker DeepSeek→Groq (3 falhas → 60s cooldown). É bom, mas só cobre "o provider está em baixo ou a devolver erro HTTP". Falta cobrir "o provider está a responder, mas a resposta é lixo" — JSON malformado repetidamente, ou confidence sistematicamente baixo.

```typescript
type CircuitBreakerState = 'closed' | 'open' | 'half_open'

class QualityAwareCircuitBreaker {
  private consecutiveQualityFailures = 0
  private readonly QUALITY_FAILURE_THRESHOLD = 3

  recordCall(result: { httpOk: boolean; schemaValid: boolean; confidence?: number }) {
    const isQualityFailure = !result.httpOk
      || !result.schemaValid
      || (result.confidence !== undefined && result.confidence < 0.3)

    if (isQualityFailure) {
      this.consecutiveQualityFailures++
      if (this.consecutiveQualityFailures >= this.QUALITY_FAILURE_THRESHOLD) {
        this.openCircuit() // troca de provider OU degrada para fallback determinístico (menu de botões)
      }
    } else {
      this.consecutiveQualityFailures = 0
    }
  }
}
```

Isto é o padrão directo do artigo "5 AI Agent Error Handling Patterns" do reading list: circuit breaker sobre output quality, não só status HTTP. Para a Luena, isto vive no `ai-engine` (chamadas ao LLM de qualificação) e no `mcpServerService` (se um agente externo está sistematicamente a enviar inputs que falham validação, é sinal de mau uso da API, não só "o agente é burro" — vale notificação ao admin do workspace, não só log silencioso).

---

## 6. Observability — Instrumentação desde o Dia 1, não como Reacção

### 6.1 Decisão: Langfuse, integração TypeScript nativa

Seguindo o reading list §5 e §7: adoptamos **Langfuse** (self-hosted, dado que já self-hosteamos infraestrutura para a Luena/KWPay) com o SDK `langfuse-js`. Não muda o runtime (continua Bun/Elysia/TypeScript). Cada chamada ao AI Engine — qualquer das 3 chamadas LLM (intent, entities, response) — vira um `observation` dentro de um `trace` por turno de conversa, agrupado num `session` por `conversationId`.

```typescript
import { Langfuse } from 'langfuse'

const langfuse = new Langfuse({ secretKey, publicKey, baseUrl })

async function handleInboundForAi(conversationId: string) {
  const trace = langfuse.trace({
    sessionId: conversationId,
    name: 'ai-engine.handle-inbound',
    metadata: { workspaceId, aiConfigPersona: aiConfig.personaTemplate },
  })

  const intentSpan = trace.generation({ name: 'intent-classification', input: prompt1 })
  const intentResult = await callLLM(prompt1)
  intentSpan.end({ output: intentResult, metadata: { topicContinuity: intentResult.topicContinuity } })

  // ... entity extraction span, response generation span, tool call spans
  // cada um aninhado no mesmo trace — reconstrói a árvore completa do turno
}
```

### 6.2 A métrica norte — "tempo até resolução", não "tempo de resposta"

Seguindo o caso Honeycomb/Intercom (reading list §6): a métrica que decide se uma mudança ao AI Engine "ajudou" não é latência por chamada LLM individual — é, para a Persona Vendas, **tempo desde a primeira mensagem até ao handoff qualificado** (já temos os campos para isto: `aiConversations.createdAt` até `conversations.aiHandoffAt`), e para a Persona Operações, **taxa de acções correctas sem necessidade de override humano** (já existe `aiActionsLog.wasOverridden` — a métrica é `1 - (count(wasOverridden=true) / count(total))` por `actionType`).

Estas métricas já estão no `insights-spec.md` (`getAiDashboard`) — esta secção só nomeia formalmente *por que* essas são as métricas certas: alinham com o que a Intercom trata como "resolution rate", o padrão da indústria, em vez de métricas de vaidade como "número de mensagens enviadas pela IA".

### 6.3 Alertas automáticos sobre o trace, não só dashboards passivos

```
Se taxa de wasOverridden > 15% num actionType, numa janela de 24h → notifica admin do workspace
  ("a IA está a errar mais do que o normal em X — vale a pena rever o persona/handoff triggers")

Se confidence médio de qualificação cair > 20% face à média móvel de 7 dias → alerta staff
  (pode ser degradação do provider, pode ser mudança no perfil de leads — qualquer dos dois merece olhar)

Se circuit breaker de qualidade abrir > 2x num dia para o mesmo workspace → alerta staff de implementação
  (sinal de que o persona_description daquele cliente pode estar mal configurado, oportunidade de consultoria)
```

---

## 7. Avaliação Sistemática — fechando o Bug #5

### 7.1 Pipeline de avaliação offline (Python, processo separado — reading list §7)

```
luena-eval/                          ← repositório/pasta separada, Python
├── scenarios/
│   ├── vendas_b2b_qualificacao.yaml     # cenários gerados a partir do policy graph (IntellAgent)
│   ├── vendas_b2c_objeção_preco.yaml
│   ├── handoff_keyword_trigger.yaml
│   ├── topic_drift_greeting_mid_task.yaml   # caso directo do bug #1 da Verano
│   └── persona_operacoes_remarcacao.yaml    # Fase 3, custom objects
├── simulator/
│   └── user_simulator.py             # LLM gerando mensagens de "lead sintético" com persona definida
├── judge/
│   └── proxy_state_judge.py          # verifica estado final do CRM (deal.stage, aiActionsLog), não texto
└── ci/
    └── regression_runner.py          # corre contra staging via MCP real, falha o build se regredir
```

Cada cenário define: persona do utilizador sintético, mensagens-alvo a injectar (incluindo deliberadamente um "Oi" a meio de uma tarefa, para testar o fix da secção 3), e o **estado final esperado** no CRM — não o texto da resposta. Isto é exactamente o padrão "proxy state-based evaluation" do reading list §3: o judge não compara strings, compara `{ deal.stage === 'qualificado', aiActionsLog contém qualified_lead com confidence > 70 }`.

### 7.2 Quando corre

- **Em CI, antes de qualquer deploy que toque `ai-engine`, `automations`, ou prompts de persona** — regressão obrigatória contra os cenários salvos, falha o merge se a taxa de sucesso cair.
- **Nightly contra produção real (amostra anonimizada)** — gera novos cenários a partir de conversas reais que tiveram `wasOverridden=true`, fechando o loop entre "o que correu mal em produção" e "o que testamos antes do próximo deploy". Isto é o "flywheel" que a Intercom descreve (reading list §6) — cada falha real em produção tem de se tornar um caso de teste permanente, não só um ticket resolvido e esquecido.

### 7.3 O caso de teste obrigatório que falta hoje na Verano — e que a Luena nasce já tendo

```yaml
# scenarios/topic_drift_greeting_mid_task.yaml
name: "Greeting ambíguo a meio de qualificação de lead"
persona: "Lead que estava a meio de fornecer orçamento, manda 'Oi' sem contexto, depois continua o assunto original"
turns:
  - user: "Quero saber mais sobre o vosso CRM"
  - user: "Temos uma equipa de 15 vendedores"
  - user: "Oi"                                    # o caso que quebra a Verano hoje
  - expect:
      ai_does_not: "perguntar sobre a equipa de 15 vendedores como se nada tivesse acontecido"
      ai_should: "responder ao 'Oi' E manter team_size=15 disponível se o lead voltar ao assunto"
  - user: "Voltando ao que disse, qual o preço para 15 pessoas?"
  - expect:
      qualificationData.teamSize: 15   # campo frio sobreviveu ao reset de tópico (secção 3.3)
      ai_response_mentions: "15"
```

Este é o teste que materializa, em formato executável, o bug #1 documentado no README da Verano. Construir o AI Engine da Luena com este caso de teste a passar desde o primeiro commit é o que separa "aprender com os erros da Verano" de "repeti-los com um schema diferente".

---

## 8. Resumo — Checklist de Implementação para o AI Engine da Luena

| # | Item | Onde no action plan | Fase |
|---|---|---|---|
| 1 | Campo `topicContinuity` na chamada de Intent Classification | `ai-engine.handleInboundForAi` | Fase 0 (mínimo) — substitui keyword-only desde o início |
| 2 | Separação campos frios/quentes em `qualificationData` | `aiConversations` schema (já existe `jsonb`, é convenção de uso) | Fase 1 |
| 3 | Gate 1+2 (existência de tool + schema Zod) antes de qualquer `handleToolCall` | `agent-gateway.mcpServerService` | Fase 3 |
| 4 | Gate 3 neurosymbólico — tabela de regras por tool, nunca só em prompt | `agent-gateway` + reaproveita `automation_approvals` | Fase 3 |
| 5 | Circuit breaker sobre qualidade (schema válido + confidence), não só HTTP | `ai-engine` infra de chamada LLM | Fase 0 |
| 6 | Langfuse instrumentado em toda chamada LLM e tool call | transversal, desde o primeiro commit do `ai-engine` | Fase 0 |
| 7 | Métrica norte = tempo-até-handoff-qualificado / taxa de override, não latência por chamada | `analytics.getAiDashboard` (já especificado) | Fase 1-2 |
| 8 | Alertas automáticos sobre taxa de override e confidence médio | `notifications` + `analytics` | Fase 2 |
| 9 | Pipeline de avaliação offline (Python, IntellAgent-style + proxy-state judge) | repositório separado `luena-eval` | Antes do AI Engine ir para clientes reais — não opcional |
| 10 | Caso de teste `topic_drift_greeting_mid_task` (e equivalentes) obrigatório em CI | `luena-eval/scenarios` | Fase 0, antes do primeiro deploy do AI Engine |

A Persona Operações (Fase 3) herda todos os 10 pontos automaticamente, porque reaproveita o mesmo `mcpServerService.handleToolCall` da Persona Vendas — é precisamente o motivo de desenho de não criar um caminho de código paralelo para a IA (system design §7.1, já decidido): qualquer guardrail que se construa uma vez serve as duas personas para sempre.
