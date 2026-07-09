# SQLENS Backend — Documentação Técnica

## Índice

1. [Stack e justificações](#1-stack-e-justificações)
2. [Como correr o projeto](#2-como-correr-o-projeto)
3. [Arquitetura](#3-arquitetura)
4. [Padrões de código](#4-padrões-de-código)
5. [Base de dados](#5-base-de-dados)
6. [Rotas da API](#6-rotas-da-api)
7. [Configuração de ambiente](#7-configuração-de-ambiente)

---

## 1. Stack e justificações

Cada escolha de tecnologia resolve um problema concreto que tínhamos. Não é lista de "melhores tecnologias do mercado" — é o que fez sentido para este projeto e prazo.

| Camada | Tecnologia | Problema que resolve |
|---|---|---|
| Runtime | Bun v1.3 | Precisávamos de correr TypeScript sem passo de compilação (`tsc`) separado, e de APIs Web Standard (`fetch`, `ReadableStream`) nativas para o streaming de CSV. Bun trata disto sem configuração extra. |
| Framework | Elysia v1.1 | Queríamos tipagem end-to-end do handler até ao schema de validação, sem escrever DTOs duplicados. Elysia infere tipos do `Context` sem decorators nem `reflect-metadata`. |
| ORM | Drizzle ORM v0.45 | Precisávamos de controlar exatamente o SQL executado (índices compostos, upserts idempotentes). Drizzle não esconde o SQL atrás de uma camada de mapeamento como o Prisma. |
| Base de dados | PostgreSQL 16 (Docker) | Relacional, com suporte maduro a transações e extensões (`uuid-ossp`, `pg_stat_statements`) que usamos para debugging de queries lentas. |
| Cache / Fila | Valkey (Docker) | O BullMQ precisa de um Redis-compatible para persistência de jobs. Usamos Valkey em vez de Redis por causa da licença SSPL do Redis, que tem restrições para uso comercial. |
| Queue | BullMQ v5 | Precisávamos de retry automático, rate limiting e persistência de jobs para eventos assíncronos (ver secção 4.4). |
| LLM | Groq API (`llama-3.3-70b-versatile`) | O agente de queries precisa de baixa latência para ser utilizável em tempo real. A API é compatível com o SDK da OpenAI, o que facilitou a integração. |
| Validação | Zod v3 | Uma única fonte de verdade para o schema — tipo TypeScript inferido (`z.infer`) e validação em runtime vêm do mesmo lugar, sem duplicar DTOs. |
| Logs | Pino v8 | Logs em JSON estruturado por omissão, necessários para integrar com o nosso stack de observabilidade. |
| Auth | JWT + Argon2 (`@node-rs/argon2`) | Argon2id foi o vencedor do Password Hashing Competition e é a recomendação atual da OWASP para hashing de passwords. JWT stateless permite escalar horizontalmente sem partilhar sessão entre instâncias. |

Nota: não afirmamos números de performance ("X vezes mais rápido") sem benchmark próprio — esses números aparecem frequentemente em marketing das próprias ferramentas e não foram validados por nós neste projeto.

---

## 2. Como correr o projeto

### Pré-requisitos

```bash
# Bun runtime
curl -fsSL https://bun.sh/install | bash

# Docker (PostgreSQL + Valkey)
docker pull postgres:16-alpine
docker pull valkey/valkey:8

docker run -d --name global_postgres \
  -e POSTGRES_USER=edgar \
  -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_DB=chronusv2 \
  -p 5432:5432 \
  postgres:16-alpine

docker run -d --name global_redis \
  -p 6379:6379 \
  valkey/valkey:8
```

> A password `123456` acima é apenas para desenvolvimento local. Não usar em staging ou produção.

### Setup

```bash
cd /home/edgar/Desktop/HACKATHONBIT44/backend

bun install

cp .env.example .env   # ajustar valores conforme a secção 7

bun db:generate         # gera migrações a partir de schema.ts
bun db:migrate          # aplica migrações

bun run src/db/seed.ts  # opcional — cria staff user + indicadores base
```

### Desenvolvimento

```bash
bun dev          # com hot-reload
bun src/index.ts # sem hot-reload
```

Servidor em `http://localhost:3080`, documentação Swagger em `http://localhost:3080/docs`.

### Scripts

| Comando | Descrição |
|---|---|
| `bun dev` | Dev com watch |
| `bun start` | Produção (`dist/index.js`) |
| `bun run build` | Build para `./dist` |
| `bun run lint` | ESLint |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:generate` | Gera migrações Drizzle |
| `bun run db:migrate` | Aplica migrações |
| `bun run db:push` | Push direto do schema (dev only) |
| `bun run db:seed` | Seed da BD |
| `bun test` | Testes (Vitest) |

### Testes

```bash
bash tests/api-test.sh          # 26 endpoints
bash tests/real-data-test.sh    # com CSVs reais (antenas_flp.csv, trajetos_comuns.csv)
```

---

## 3. Arquitetura

### Problema

Numa aplicação que mistura HTTP, base de dados, filas e uma API de LLM externa, é fácil que a lógica de negócio fique dependente de detalhes de implementação — trocar de ORM ou de framework HTTP passa a exigir reescrever regras de negócio junto. Isto torna testes lentos (precisam de BD real) e mudanças arriscadas.

### Abordagem: Clean Architecture / Ports & Adapters

Cada módulo é dividido em três camadas, com dependência numa única direção — o domínio nunca importa código de infraestrutura:

```
Infrastructure  (controllers HTTP, repositórios, publishers de eventos)
      │  depende de
      ▼
Application     (services com regras de negócio, DTOs)
      │  depende de
      ▼
Domain / Ports  (interfaces, tipos Result)
      │
      ▼
    nada
```

Na prática, isto significa: o `service` recebe interfaces (`ports`), não implementações concretas. O repository Drizzle é uma implementação dessas interfaces, injetada no controller.

### Estrutura de um módulo

```
modules/regions/
├── application/
│   ├── dtos/region.dto.ts
│   ├── ports/region.port.ts
│   └── services/region.service.ts
├── events/region.events.ts
└── infrastructure/
    ├── http/controllers/
    └── persistence/
```

### Porquê vale o custo extra de indireção

- Testar `region.service.ts` não exige BD real — basta um mock da interface `IRegionRepository`.
- Se decidirmos migrar de Drizzle para outro ORM, a mudança fica confinada à camada `infrastructure/persistence`.
- Novos membros da equipa conseguem localizar regras de negócio sem depender de conhecer o framework HTTP.

O custo é real: mais ficheiros, mais indireção para seguir o fluxo de uma request. Para um projeto pequeno de curta duração isto pode ser overhead desnecessário — a escolha fez sentido aqui porque o projeto tem múltiplos módulos com regras de negócio não triviais (alerts, coverage, ingestion).

### Mapa de dependências entre módulos

```
staff        → (nenhuma)
auth         → IUserRepository, IStaffRepository
regions      → (nenhuma)
ingestion    → IRegionRepository, IDataSourceRepository
coverage     → IRegionRepository
indicators   → IDataSourceRepository
programs     → IRegionRepository
alerts       → IIndicatorRepository, IRegionRepository, IIndicatorDataRepository
agent        → IQueryLogRepository, IUserRepository
notifications → (nenhuma — apenas workers BullMQ)
```

Nenhum módulo importa outro módulo diretamente — apenas interfaces definidas dentro do próprio módulo consumidor. Isto é o que permite testar módulos isoladamente.

---

## 4. Padrões de código

### 4.1 Result Pattern (`Ok` / `Err`)

**Problema:** exceções em TypeScript não são tipadas — um `catch` não sabe o que pode ter sido lançado, e é fácil esquecer de tratar um erro esperado (validação, conflito, não encontrado), deixando-o escapar como 500 genérico.

**Solução:** toda a lógica de negócio devolve `Result<T, E>` em vez de lançar:

```typescript
type Result<T, E = AppError> =
  | { success: true; value: T }
  | { success: false; error: E }
```

```typescript
const result = await staffSvc.login(data)
if (!result.success) return result
const token = result.value.token
```

O handler global do Elysia continua a existir, mas só apanha o que é realmente inesperado (bug, falha de infraestrutura) — não erros de negócio previstos.

**Trade-off:** o caller é forçado, pelo compilador, a verificar `.success` antes de aceder a `.value`. Isto tem custo de verbosidade (mais `if` explícitos), mas remove uma classe inteira de bugs de "esqueci-me do try/catch".

Ver `Result Pattern — How to Use` para o guia completo de `ErrorFactory`, `dbExec`, e utilitários (`map`, `flatMap`, `matchError`).

### 4.2 Injeção de dependência manual

**Problema:** DI containers (como os do NestJS) resolvem dependências em runtime — se uma falha, só se descobre ao correr a aplicação, não em compile-time.

**Solução:** dependências são passadas explicitamente por funções `create*`:

```typescript
const staffRepo   = createStaffRepository(db)
const sessionRepo = createStaffSessionRepository(db)
const svc         = createStaffService(staffRepo, sessionRepo)
```

**Trade-off:** perde-se a conveniência de um container automático (registo global, auto-wiring), mas ganha-se rastreabilidade — dá para seguir `Ctrl+clique` desde o controller até à implementação real, sem magia de reflexão.

### 4.3 Transaction Sovereignty

**Problema:** se um repository abre transações internamente, não é possível compor duas operações de repositórios diferentes numa única transação atómica.

**Solução:** quem decide abrir uma transação é sempre o `service`; o repository aceita uma conexão opcional (`DbOrTx`):

```typescript
// Service
async register(data, staffId) {
  return withTransaction(db, async (tx) => {
    const user = await userRepo.create(data, tx)
    const session = await sessionRepo.create({ userId: user.id }, tx)
    return user
  })
}

// Repository
async create(data, dbOrTx?: DbOrTx) {
  const conn = dbOrTx ?? db
  const [row] = await conn.insert(users).values(data).returning()
  return row
}
```

Isto evita duplicar cada método de repository em duas versões (com e sem transação).

### 4.4 Eventos de domínio via fila (BullMQ)

**Problema:** operações pesadas disparadas por uma request (recalcular cobertura, enviar notificação, escrever audit log) não devem bloquear a resposta HTTP nem falhar a request principal se falharem.

**Solução:** eventos são publicados numa fila e processados por workers separados.

```
Service → emit*() → QueueManager (BullMQ) → Redis → Worker → activity_log / notification / coverage.recompute
```

Componentes:

- **`shared/queue/queue.ts`** — cria a queue + worker com conexão Redis, configurado com retry exponencial (3 tentativas), concorrência 5, e limpeza automática de jobs concluídos/falhados.
- **Pasta `events/` por módulo** — payload tipado, constantes de nome de evento (ex.: `staff.created`), e funções `emit*` que chamam `QueueManager.addJob`.
- **Módulo `activity`** — consumidor central. `processEventForAudit()` usa um mapa `EVENT_META` para saber como extrair `entityId`/`actorId` de cada tipo de payload e grava em `activity_log`.
- **`auditHelpers`** — escrita síncrona e direta de audit log, usada em paralelo ao evento assíncrono como fallback caso a fila falhe.

```typescript
Promise.allSettled([
  emitStaffCreated(staffId, createdBy, email),
  auditHelpers.create(createdBy, 'Staff', staffId, { email }),
]).catch(err => logger.error(err, 'Background tasks failed on staff create'))
```

**Porquê nunca usar `await` direto:** se o `await emitStaffCreated(...)` falhar, a request inteira falharia por causa de um efeito secundário (audit log) que não devia impedir a operação principal de ter sucesso.

**Trade-off assumido:** existe uma janela onde o evento pode não ter sido processado ainda (fila com atraso) — para audit log isto é aceitável; para operações que exigem consistência imediata, este padrão não deve ser usado.

Existem ainda dois pontos de extensão previstos mas não implementados: `TelemetryExporter` (exportação para sistemas externos) e `ReactiveHandler` (notificações em tempo real) — ambos são interfaces definidas, sem handlers registados no momento.

### 4.5 Streaming de CSV (Web Streams API)

**Problema:** os ficheiros de ingestão (dados CDRView) podem ter milhões de linhas. Carregar o ficheiro inteiro para memória antes de processar não escala — um ficheiro de 200MB+ pode esgotar a memória do processo.

**Solução:** pipeline de streams que processa chunk a chunk:

```
request.body (ReadableStream) → parseCSVStream (TransformStream) → batchWritable (WritableStream) → insert em lotes de 500
```

O parser decodifica cada chunk com `new TextDecoder().decode(chunk, { stream: true })`, que trata corretamente caracteres multi-byte cortados entre dois chunks.

O backpressure do `pipeTo` regula automaticamente a velocidade de leitura do ficheiro contra a velocidade de escrita na base de dados — não é preciso implementar throttling manual.

**Porquê existem dois endpoints de ingestão:**

- `trigger` — recebe o CSV como string dentro do body JSON. Simples, mas só serve para ficheiros pequenos (recomenda-se <1MB), já que o JSON inteiro tem de ser parseado de uma vez.
- `trigger-stream` — recebe o `ReadableStream` bruto do body HTTP (`type: 'none'` no Elysia). Sem limite prático de tamanho.

### 4.6 Circuit Breaker no agente LLM

**Problema:** se a API da Groq estiver em baixo (ou a devolver respostas inválidas), continuar a tentar chamá-la em cada request desperdiça chamadas pagas e aumenta a latência para o utilizador.

**Solução:** `agent-circuit-breaker.service.ts` implementa três estados:

```
CLOSED (normal) --3 falhas consecutivas--> OPEN (rejeita chamadas)
OPEN --cooldown de 30s--> HALF-OPEN (permite 1 chamada de teste)
HALF-OPEN --sucesso--> CLOSED
HALF-OPEN --falha--> OPEN (reinicia cooldown)
```

Uma particularidade deste circuit breaker é que conta como "falha" não só erros HTTP, mas também SQL inválido gerado pelo LLM — a falha é definida pela qualidade do resultado, não apenas pela disponibilidade do serviço.

### 4.7 Guardrails do agente (3 camadas)

**Problema:** o agente traduz linguagem natural em queries SQL. Sem validação, um input malicioso ou mal formado pode gerar SQL destrutivo (DDL/DML) ou consumir recursos desnecessariamente.

**Solução:** `agent-guardrails.service.ts` valida em três gates sequenciais, cada um podendo travar o pedido antes de chegar ao seguinte:

1. Validação de input — query não vazia, dentro do tamanho máximo.
2. Schema Zod — payload no formato esperado.
3. Verificação SQL — regex para detetar comandos DDL/DML e limite de comprimento da query gerada.

Se qualquer gate falhar, a API da Groq nem chega a ser chamada — isto poupa custo e reduz superfície de ataque.

### 4.8 `jti` nos JWT (anti-replay / anti-colisão)

**Problema:** `sessions.token` tem uma constraint `UNIQUE` na base de dados. Como a assinatura JWT é determinística (mesmo payload + mesmo secret = mesmo token), dois logins simultâneos do mesmo utilizador, com o mesmo payload, gerariam o mesmo token — violando a constraint.

**Solução:** cada token inclui um `jti` (JWT ID) único:

```typescript
const jti = `${Date.now()}-${process.pid}-${++tokenCounter}`
sign({ ...payload, jti }, secret, { expiresIn: ttl })
```

**Alternativa descartada:** remover a constraint `UNIQUE`. Foi rejeitada porque a constraint é o que garante que não existem tokens duplicados por bug ou race condition — preferimos resolver a causa raiz (determinismo do JWT) a enfraquecer a integridade do schema.

---

## 5. Base de dados

### Schema (17 tabelas)

```
staff_users              → staff_sessions
users                    → sessions
regions                  → base_stations
                         → cdrview_records
                         → region_coverage
                         → indicator_data
                         → programs
data_sources             → cdrview_records (via region)
indicators               → indicator_data
                         → alert_configs
alert_configs            → alert_logs
query_logs
notifications
activity_log
```

### Índices relevantes

| Índice | Tipo | Motivo |
|---|---|---|
| `regions_zone_id_idx` | UNIQUE | `zone_id` é a chave natural do dataset CDRView |
| `base_stations_station_id_idx` | UNIQUE | `station_id` é a chave natural do dataset |
| `cdrview_records_region_period_idx` | Composto | Otimiza queries de cobertura por região + período |
| `indicator_data_unique_idx` | UNIQUE `(region_id, indicator_id, period)` | Permite upsert idempotente |
| `region_coverage_region_period_idx` | UNIQUE `(region_id, period)` | Permite upsert idempotente |

### Migrações

Geradas com `bun db:generate` (Drizzle Kit), aplicadas com `bun db:migrate`, ficam em `./drizzle/`.

Seed automático: no arranque, se não existir nenhum staff user, um é criado a partir de `STAFF_SEED_EMAIL` e `STAFF_SEED_PASSWORD`.

---

## 6. Rotas da API

### Staff (auth: cookie `staff_token`)

```
POST   /staff/login
POST   /staff/refresh
POST   /staff/logout
GET    /staff/me
GET    /staff/members
POST   /staff/members
PATCH  /staff/members/:id/deactivate
GET    /staff/activity-log
```

### Staff — Ingestão

```
GET    /staff/data-sources
POST   /staff/data-sources
GET    /staff/data-sources/:id
PATCH  /staff/data-sources/:id
POST   /staff/data-sources/:id/trigger
POST   /staff/data-sources/:id/trigger-stream
```

### Staff — Indicadores

```
GET    /staff/indicators
POST   /staff/indicators
GET    /staff/indicators/:id
PATCH  /staff/indicators/:id
POST   /staff/indicators/:id/data
```

### Staff — Programas

```
GET    /staff/programs
POST   /staff/programs
GET    /staff/programs/:id
PATCH  /staff/programs/:id
DELETE /staff/programs/:id
```

### Staff — Agente

```
GET    /staff/agent/query-logs
```

### Utilizador Público (auth: Bearer `access_token`)

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /users/me
PATCH  /users/me
DELETE /users/me
```

### Utilizador Público — Dados

```
GET    /regions
GET    /regions/:id
GET    /regions/:id/stations
GET    /regions/meta/states
GET    /regions/meta/municipalities
GET    /coverage
GET    /coverage/:regionId
GET    /coverage/critical
GET    /indicators
GET    /indicators/data
GET    /programs
GET    /programs/:id
GET    /alerts/configs
POST   /alerts/configs
PATCH  /alerts/configs/:id
DELETE /alerts/configs/:id
GET    /alerts/logs
GET    /notifications
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
POST   /agent/query
```

**Porquê cookie para staff e Bearer para utilizador público:** staff usa cookie `httpOnly` + `sameSite: lax`, para que num cenário de XSS o atacante não consiga ler o token via JavaScript. O utilizador público usa Bearer porque o frontend precisa de ler o token para gerir expiração da sessão na UI — uma troca deliberada entre conveniência de frontend e superfície de risco, aceitável porque o utilizador público tem permissões mais limitadas que o staff.

---

## 7. Configuração de ambiente

Ver `.env` na raiz do projeto.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DB_HOST` | Sim | Host da PostgreSQL |
| `DB_PORT` | Sim | Porta (5432) |
| `DB_USER` | Sim | User da BD |
| `DB_PASSWORD` | Sim | Password |
| `DB_DATABASE` | Sim | Nome da BD (`chronusv2`) |
| `DATABASE_URL` | Não | Full connection string (ex.: Neon). If present, it overrides DB_* settings |
| `JWT_SECRET` | Sim | Mínimo 32 caracteres |
| `REDIS_HOST` | Sim | Host do Valkey/Redis |
| `REDIS_PORT` | Sim | Porta (6379) |
| `GROQ_API_KEY` | Sim | Chave da API Groq |
| `GROQ_MODEL` | Não | Default: `llama-3.3-70b-versatile` |
| `STAFF_SEED_EMAIL` | Não | Staff criado no bootstrap |
| `STAFF_SEED_PASSWORD` | Não | Password do staff seed |
| `CORS_ORIGINS` | Sim | Origens permitidas (separadas por vírgula) |

**Porquê o modelo LLM vem do `.env` e não está hardcoded:** o código já teve `DEFAULT_MODEL = 'mixtral-8x7b-32768'` fixo no código-fonte. Esse modelo foi descontinuado pela Groq sem aviso. Ler de `process.env.GROQ_MODEL` permite trocar de modelo editando uma variável, sem recompilar nem fazer deploy de código novo.

### Usando uma base de dados Neon (hosted)

Passos resumidos para migrar a base de dados local para o Neon e executar as migrações:

1. Crie um projecto no Neon (https://console.neon.tech/) e, depois, crie um branch / database.
2. Copie a connection string fornecida pelo Neon (algo como `postgresql://user:pass@xxx.neon.tech:5432/dbname?sslmode=require`).
3. Defina essa string como `DATABASE_URL` nas variáveis de ambiente do seu ambiente de execução (local `.env`, CI, ou variáveis do deploy). Alternativamente, use `NEON_DATABASE_URL`.
4. Certifique-se que `DB_SSL=true` ou que a query string contenha `sslmode=require`.
5. Execute as migrações apontando para o Neon:

```bash
# no terminal, com a env carregada (ou export DATABASE_URL=...)
bun db:migrate
```

6. Opcional: correr seed

```bash
bun run db:seed
```

7. Inicie a aplicação; ela passará a usar exclusivamente a base de dados remota (Neon) enquanto `DATABASE_URL` estiver presente.

Notas:
- Não inclua credenciais reais no repositório. Use secrets no CI / deploy.
- O código já suporta `DATABASE_URL` e `NEON_DATABASE_URL`; se estes estiverem presentes, eles têm prioridade sobre `DB_*`.
