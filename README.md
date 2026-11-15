# SQLens — Radar de Inclusão Digital

Painel de dados públicos para identificar e **priorizar** lacunas de inclusão digital na **região metropolitana de Florianópolis (SC, Brasil)** — Florianópolis, São José, Palhoça e Biguaçu. Construído para o **Desafio B2G (App BiT)**, sobre dados reais de antenas e concentração de pessoas (Vísent CDRView / CVSS).

> Onde faltam formações, emprego formal, iniciativas sociais, mentorias e apoio à saúde mental — e onde isso coincide com baixa cobertura de rede? O SQLens cruza esses dados por região, transforma-os num índice de prioridade acionável, e responde a perguntas em linguagem natural.

---

## Conceito

O nome do produto e o problema que resolve são, literalmente, sobre **cobertura** — de rede, de programas, de oportunidades. Em vez de mais um dashboard claro genérico, a interface foi desenhada à volta dessa ideia:

- **Radar de cobertura** (página inicial): cada região é um ponto plotado pela sua cobertura de rede real — quanto mais perto do centro, mais urgente a região. É o elemento de assinatura do produto, clicável, e leva diretamente ao mapa com a região já selecionada.
- **Tema "mission control"**: fundo escuro, tipografia serifada (Fraunces) para números e títulos, monoespaçada (JetBrains Mono) para todos os valores e dados — para comunicar precisão e seriedade, adequado a um painel usado por gestores públicos para decidir onde investir.
- **Mapa** com tiles escuros (CARTO Dark Matter), coerente com o resto da aplicação, e enquadramento automático aos dados (em vez de coordenadas fixas).

## Diferencial: Índice de Prioridade de Investimento

O maior risco de um dashboard de dados públicos é mostrar muitos números sem dizer **onde agir primeiro**. Por isso o SQLens não se fica pela visualização — calcula um **índice de prioridade (0–100)** por região (`src/lib/indicadores.ts → calcularPrioridades`), combinando três sinais normalizados:

| Sinal | Peso | Porquê |
|---|---|---|
| Concentração populacional | 40% | Mais gente afetada → maior retorno social por real investido |
| Défice de cobertura de rede | 35% | Sem rede, nenhum programa digital chega — é o obstáculo estrutural mais difícil de contornar |
| Défice médio nos indicadores sociais | 25% | Mede a lacuna de programas (formação, emprego, mentoria, saúde mental) já existentes |

O resultado é um **ranking explicável**: cada região aparece com o seu score e o motivo dominante ("cobertura de rede é o principal obstáculo", "alta concentração populacional amplifica o impacto", etc.). Isto aparece em dois sítios:

- **Dashboard** → cartão "Prioridade de investimento" com o top 5 nacional.
- **Sidebar** → destaque permanente da região #1, com atalho directo para investigar no mapa.

É o que transforma o SQLens de "visualizador de dados" em **ferramenta de apoio à decisão** — o tipo de diferencial que um júri B2G costuma valorizar.

## Outros diferenciais

- **Comparação região vs. média nacional**: ao selecionar uma região no mapa, o painel lateral mostra um radar chart (Recharts) sobreposto à média nacional por categoria — torna visível, de relance, *onde* uma região está pior do que a média do país, não apenas *que valor* tem cada indicador.
- **Snapshot ao vivo na sidebar**: contagem de regiões, regiões críticas e cobertura média sempre visíveis, sem precisar de navegar até ao Dashboard.
- **Consulta em linguagem natural**: pergunta-se em português corrente (ex. *"Onde faltam programas de formação para jovens de baixa renda?"*) e o agente devolve uma resposta com evidências e tabela de dados de suporte.
- **Upload CVSS pelo front**: a equipa staff pode enviar os CSVs originais pela interface, sem terminal. O backend usa o mesmo serviço do comando `bun run ingest:cvss`, mantendo consistência entre demo técnica e uso real.
- **Mapa robusto a qualquer dataset**: em vez de um centro fixo, o mapa ajusta automaticamente o enquadramento (`FitBounds`) às coordenadas das regiões recebidas — funciona com qualquer cidade/território sem alterar código.

Para a apresentação, esta é uma mensagem forte:

> O SQLens não é só um dashboard bonito em cima de dados preparados por programadores. Ele já inclui um fluxo operacional simples: o staff faz upload dos CSVs recebidos, o sistema ingere, calcula cobertura e torna os dados consultáveis no mapa e no agente IA.

## Stack

Monorepo (`chronus`) com duas aplicações:

| Camada | Tecnologia |
|---|---|
| **Frontend** (`web/`) | Vite 7, React 19, TypeScript, Tailwind v4, React Router 7, TanStack Query, Zustand, React Leaflet (CARTO), Recharts |
| **Backend** (`backend/`) | Bun, Elysia, Drizzle ORM, PostgreSQL 16, Valkey + BullMQ, Zod, Pino, JWT + Argon2 |
| **Agente de IA** | LLM compatível com OpenAI — Groq (`llama-3.3-70b-versatile`) ou Cohere (`command-a-03-2025`) — com guardrails, retry com reflexão e circuit breaker |
| **Infra** | Docker Compose (`infra/` para dev, `docker-compose.prod.yml` para produção), GitHub Actions (`.github/workflows/ci.yml`), Vercel/Nginx para o front |

## Estrutura

```
.
├── backend/            # API Bun + Elysia (módulos por camadas: application / infrastructure)
│   ├── src/modules/    # auth, staff, users, regions, coverage, indicators, programs,
│   │                   # ingestion, alerts, notifications, activity, agent
│   ├── src/middlewares # auth, staff-auth, rate-limit, logger, result
│   ├── scripts/        # ingest-cvss.ts, cleanup-coverage-periods.ts
│   └── data/           # CSVs de exemplo (antenas, trajetos, sumário k-anonimato)
├── web/                # SPA React (landing, login, /app/*, /staff/*)
│   └── src/            # pages, components, hooks (useApi, useAuth, useStaffApi), store, lib, data/mock.ts
├── cvss/               # CSVs CVSS originais (antenas, tensores de concentração/fluxo/OD)
├── docs/               # arquitetura, contrato da API, dicionário de dados, deploy, demo day
├── infra/              # docker-compose de desenvolvimento (Postgres + Valkey)
├── README_BAC.md       # documentação técnica do backend (= backend/README.md)
└── README_FRONT.md     # documentação técnica do frontend
```

## Como correr localmente

Pré-requisitos: [Bun](https://bun.sh) ≥ 1.3, Node ≥ 22 e Docker.

```bash
# 1. Postgres + Valkey
docker compose -f infra/docker-compose.yml up -d

# 2. Backend (porta 3001) — copie e ajuste o .env
cp backend/.env.example backend/.env
cd backend && bun install && bun run db:migrate && bun run db:seed   # seed cria o utilizador staff
cd .. && ./run-backend.sh

# 3. Frontend (porta 5173), noutro terminal
cd web && npm install && npm run dev
```

Ou, a partir da raiz, `bun run dev` arranca backend e front em paralelo.

- **Dados:** como staff (`/staff/login`, credenciais do `.env`: `STAFF_SEED_EMAIL`/`STAFF_SEED_PASSWORD`) use *Upload CSV*, ou rode `cd backend && bun run ingest:cvss`.
- **Agente de IA:** defina **uma** chave no `backend/.env` — `GROQ_API_KEY` ou `COHERE_API_KEY` (opcionalmente `LLM_PROVIDER=groq|cohere`). Sem chave, o painel funciona, mas a *Consulta IA* responde que o assistente não está disponível.
- **Mock no front:** `VITE_USE_MOCK=true` (em `web/.env`) usa o dataset mock de Florianópolis em vez da API; para a API real use `VITE_USE_MOCK=false` e `VITE_API_URL=http://localhost:3001`.
- Documentação interativa da API: `http://localhost:3001/docs` (Swagger).

## Qualidade e testes

```bash
cd backend && bun run typecheck && bun run lint && bun run test:run   # 103 testes (Vitest)
cd web     && npm run typecheck && npm run lint && npm test && npm run build   # 36 testes (Vitest + Testing Library)

# E2E (Playwright) — precisa da stack a correr (Postgres, backend :3001, front :5173)
cd web && npx playwright install chromium   # uma vez
cd web && E2E_STAFF_EMAIL=... E2E_STAFF_PASSWORD=... E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run e2e
```

O backend tem testes para: guardrails/análise estática do SQL do agente, execução read-only com timeout (precisa do Postgres local), seleção de provedor LLM, proteção de **todas** as rotas `/staff/*`, `/agent/*`, `/regions`, `/coverage` sem sessão (`401`), rate limit (`429`) validação do período na ingestão e cálculo dos indicadores públicos.

O frontend tem testes unitários e de componente (`npm test`: mapeadores da API, índice de prioridade, mensagens de erro, página de login, barra de consulta ao agente) e **E2E com Playwright** (`web/e2e/`): login staff (credenciais erradas, sessão que sobrevive ao reload, logout, proteção das rotas) e fluxo do utilizador (login → dashboard → mapa). As specs que precisam de credenciais são ignoradas se as variáveis `E2E_*` não estiverem definidas. O login tem rate limit (5 tentativas / 15 min por IP, em memória): a suíte faz no máximo 3 por execução — reinicie o backend para zerar o contador.

## Segurança — o que está garantido

- O backend autentica pelo cookie httpOnly `auth_token` (utilizador) / `staff_token` (staff); o front envia-o com `withCredentials: true` (o header `Authorization: Bearer` é ignorado pelo backend). Todas as rotas de dados e `/agent/*` exigem login de utilizador; `/staff/*` exige sessão staff (cookie `staff_token` httpOnly). Os hooks de guarda usam `as: 'scoped'` — ver `backend/README.md §4.9`.
- Rate limit: 5 tentativas de auth / 15 min por IP; 60 pedidos de API / min.
- O SQL gerado pelo LLM passa por 5 camadas (autenticação, validação de input, schema, análise estática com allowlist de tabelas, execução em transação `READ ONLY` com `statement_timeout` e limite de linhas) — ver `backend/README.md §4.7`.
- Password com Argon2id, JWT com `jti`, campos sensíveis cifrados.

## Notas de implementação

- O mapa usa **auto-fit de bounds** (`MapView.tsx`) calculado a partir das coordenadas das regiões recebidas, em vez de um centro fixo — funciona com qualquer cidade/dataset. Centro de fallback (antes dos dados chegarem): Florianópolis, `[-27.6, -48.55]`.
- Os tiles usam o serviço público CARTO (`dark_all`). O CARTO passou a exibir a marca *"API KEY REQUIRED"* em alguns tiles do estilo gratuito; para uso em produção, configure uma chave CARTO ou troque o `TileLayer` por outro provedor.
- O front pagina `GET /regions` com **`pageSize`** (máx. 100); o parâmetro `perPage` não existe nessa API e fazia o painel mostrar só 20 das 23 regiões.
- Cores de estado e tokens visuais estão centralizados em `web/src/index.css` via `@theme` do Tailwind v4. `prefers-reduced-motion` é respeitado.
- A cobertura por região/período (`region_coverage.period`, formato `YYYY-MM`) é validada na ingestão e no repositório; dados antigos com período `"undefined"` limpam-se com `cd backend && bun run db:cleanup-periods --apply`.

## Dados e limitações conhecidas

- Os dados reais carregados são do **Brasil** (região de Florianópolis); o texto da interface e os exemplos refletem isso.
- **Indicadores e programas reais** (`cd backend && bun run data:load-public`, idempotente; `--offline` usa o snapshot `backend/data/public-sources/snapshot.json`; `--dry-run` não escreve):
  - `taxa-emprego-formal` — pessoal ocupado assalariado (IBGE/CEMPRE 2021) ÷ população (Censo 2022), por município.
  - `indice-saude-mental` — CAPS por 100 mil hab. (DATASUS/CNES) como % da meta de 0,70 do Ministério da Saúde. Hoje todos os municípios atingem a meta, logo o índice é 100.
  - **Programas:** os 12 CAPS do CNES nos 4 municípios, cada um ligado à região (cluster de antenas) mais próxima pelas coordenadas do CNES.
  - As fontes são **municipais**; o valor do município é atribuído a todas as suas regiões (isto fica registado em `indicator_data.notes`). Os valores têm `quality = official`.
- **Sem fonte pública direta (IBGE/DATASUS), portanto sem dados:** formação tech, iniciativas sociais e mentoria. Nada foi inventado: o dashboard mostra "—" nesses medidores até o staff os inserir (`/staff/indicadores`, `/staff/programas`).
- O índice de prioridade usa pesos iniciais (40/35/25) a validar com especialistas em políticas públicas.
- O agente usa a mesma role Postgres da aplicação; criar uma role só com `SELECT` nas tabelas permitidas é o próximo reforço (ver `backend/README.md §4.7`).

## Próximos passos sugeridos

- Completar os indicadores sem fonte direta (formação tech, iniciativas, mentoria) com outras fontes (INEP, MTE/RAIS, cadastros municipais) e refinar os existentes para granularidade de bairro (setores censitários do Censo 2022).
- Exportação de relatórios (PDF/CSV) do ranking, por região ou por consulta IA.
- Histórico de consultas do agente na interface (o endpoint `GET /agent/history` já existe).
- Ampliar o E2E (consulta ao agente com LLM simulado, upload de CSV) e testes de componente do mapa.
