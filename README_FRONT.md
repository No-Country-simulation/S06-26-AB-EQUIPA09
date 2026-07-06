# SQLens — Documentação Técnica (Frontend)

> Painel de dados públicos de cobertura territorial (Luanda/Angola) — projeto para o desafio App BiT B2G.
> Este documento existe para que qualquer membro da equipa consiga abrir o repositório, entender a arquitetura e continuar o desenvolvimento sem precisar perguntar "onde é que isto está?".

---

## 1. Stack e como correr o projeto

| Camada | Tecnologia |
|---|---|
| Framework | React 19 + Vite 7 |
| Linguagem | TypeScript 5.8 (strict mode) |
| Routing | React Router DOM v7 |
| Estado global (auth + UI) | Zustand 5 (com persist) |
| Dados do servidor | TanStack Query 5 (React Query) + Axios |
| Estilos | Tailwind CSS v4 (via `@tailwindcss/vite`, tema definido em `index.css`) |
| Mapas | Leaflet + React-Leaflet |
| Gráficos | Recharts |

```bash
npm install
npm run dev        # servidor de desenvolvimento (Vite)
npm run build       # tsc -b && vite build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src
```

### Variáveis de ambiente (`.env`)

```
VITE_API_URL=http://localhost:3001
VITE_USE_MOCK=false
```

- **`VITE_API_URL`** — base URL da API do backend.
- **`VITE_USE_MOCK`** — quando `true`, a app usa dados fixos de `src/data/mock.ts` em vez de chamar o backend (útil para desenvolver o frontend sem a API no ar, ou para demonstrações). Também **desativa a exigência de login** no `ProtectedRoute` (ver secção 4 — atualmente essa parte está com um bug, ver secção 7).

---

## 2. Estrutura de pastas

```
src/
├── App.tsx                    # rotas da aplicação
├── main.tsx                   # entry point
├── index.css                  # tema Tailwind (cores, fontes, variáveis CSS)
├── types/index.ts             # tipos de domínio (Regiao, Indicador, DadosResponse...)
├── data/mock.ts                # dados fictícios usados quando VITE_USE_MOCK=true
├── lib/indicadores.ts         # funções puras de cálculo (médias, ranking de prioridade)
├── store/
│   ├── index.ts                # ⚠️ ESTE é o store usado pela app (Zustand: useAuthStore, useAppStore)
│   ├── hooks.ts                # hooks tipados do Redux (useAppDispatch/useAppSelector) — não usados atualmente
│   └── api/                    # ⚠️ camada RTK Query (Redux Toolkit) — código morto, ver secção 6
├── hooks/
│   ├── useAuth.ts              # instância do axios + hooks de login/registo/logout (usado de facto)
│   └── useApi.ts                # hooks de dados (regiões, consulta IA, programas, indicadores)
├── components/
│   ├── auth/ProtectedRoute.tsx
│   ├── layout/Layout.tsx        # sidebar + navegação + rodapé com sessão do utilizador
│   ├── map/                     # MapView, RegionPanel, CoberturaTag
│   ├── dashboard/               # CoverageRadar, PriorityRanking
│   ├── query/AIQueryBar.tsx     # barra de consulta em linguagem natural (agente IA)
│   └── ui/CircularGauge.tsx
└── pages/
    ├── Login.tsx                # login + registo (toggle no mesmo formulário)
    ├── Dashboard.tsx             # visão geral (rota "/")
    ├── Mapa.tsx                  # mapa territorial com filtros
    ├── Consulta.tsx              # interface de consulta ao agente IA
    └── Perfil.tsx                 # dados do utilizador autenticado
```

---

## 3. Rotas (`App.tsx`)

| Caminho | Página | Protegida? |
|---|---|---|
| `/login` | `Login.tsx` | Não |
| `/` (index) | `Dashboard.tsx` | Sim |
| `/mapa` | `Mapa.tsx` | Sim |
| `/consulta` | `Consulta.tsx` | Sim |
| `/perfil` | `Perfil.tsx` | Sim |
| `*` | redireciona para `/` | — |

As rotas protegidas partilham o `Layout` (sidebar com navegação + sessão) através de uma rota-pai envolvida em `ProtectedRoute`.

Depois de um login com sucesso, o `Login.tsx` chama `navigate('/')` — **não** `navigate('/dashboard')`, porque o Dashboard é a rota `index`, servida diretamente em `/`.

---

## 4. Autenticação — como funciona hoje

Fluxo pensado (e a razão da arquitetura):

1. `POST /auth/login` (ou `/auth/register`) devolve **`{ user, refreshToken }`**. O backend **não devolve `accessToken` no corpo da resposta de login**.
2. O `accessToken` de curta duração é obtido sob demanda: quando um pedido autenticado falha com **401**, um interceptor do Axios chama `POST /auth/refresh` com o `refreshToken` guardado, recebe um novo `accessToken`, repete o pedido original, e guarda o token no store para os pedidos seguintes.
3. O estado de sessão (`user`, `accessToken`, `refreshToken`) vive no **Zustand** (`useAuthStore`, em `src/store/index.ts`), persistido em `localStorage` sob a chave `sqlens-auth`.

Ficheiros envolvidos:

- **`src/hooks/useAuth.ts`**
  - Cria a instância `api` do Axios (`baseURL = VITE_API_URL`).
  - Interceptor de *request*: injeta `Authorization: Bearer <accessToken>` em todos os pedidos, se houver token.
  - Interceptor de *response*: em caso de `401`, tenta o refresh automático descrito acima; se falhar, limpa a sessão e redireciona para `/login`.
  - Exporta `useLogin`, `useRegister`, `useLogout` (mutations do React Query que chamam `setAuth`/`clearAuth` do Zustand).

- **`src/store/index.ts`**
  - `useAuthStore`: `accessToken`, `refreshToken`, `user`, `setAuth()`, `clearAuth()`, `isAuthenticated()`.
  - **O critério de "autenticado" é `!!user`, não `!!accessToken`** — importante, porque o `accessToken` só existe depois do primeiro refresh (ver secção 7, é aqui que está o bug pendente).

- **`src/components/auth/ProtectedRoute.tsx`**
  - Decide se redireciona para `/login` com base no estado de autenticação.

---

## 5. Camada de dados (`hooks/useApi.ts`)

Todos os hooks de dados seguem o mesmo padrão: se `VITE_USE_MOCK=true`, devolvem dados de `src/data/mock.ts`; caso contrário, chamam o backend através da instância `api` (mesma instância do Axios usada na autenticação, já com os interceptors de token).

| Hook | Endpoint(s) | Uso |
|---|---|---|
| `useRegioes()` | `GET /regions`, `GET /coverage`, `GET /indicators/data` (em paralelo) | Combina as três respostas em `Regiao[]` através de `mapBackendRegioes()` — normaliza nomes de campo divergentes entre backend e frontend (ex.: `region_id` vs `regionId`, `coverage_score` vs `coverageScore`) |
| `useConsultaAgente()` | `POST /agent/query` | Envia pergunta em linguagem natural, recebe SQL gerado + resultado + resposta da IA, normalizado por `mapAgentResponse()` |
| `usePrograms(regionId?)` | `GET /programs` | Lista de programas sociais, opcionalmente filtrados por região |
| `useIndicadores()` | `GET /indicators` | Lista de indicadores disponíveis |

**Ponto de atenção para quem for integrar novos endpoints:** o backend usa nomes de campo em `camelCase` inconsistentes com o `snake_case`/PT usados nos tipos internos (`src/types/index.ts`). As funções `mapBackendRegioes()` e `mapAgentResponse()` fazem essa tradução com fallbacks (`??`) para tolerar pequenas variações — se o backend mudar um nome de campo, é aqui que se ajusta, não nos componentes.

---

## 6. Sistema de design (`index.css`)

O tema é definido com `@theme` do Tailwind v4 (cores, tipografia) — **não inventar cores soltas**, usar sempre as variáveis já definidas:

| Categoria | Variáveis |
|---|---|
| Superfícies (fundo escuro, "ink") | `--color-ink-950` (fundo da página) → `--color-ink-700` (mais claro), `--color-ink-border` / `--color-ink-border-soft` |
| Texto ("mist") | `--color-mist-50` (quase branco) → `--color-mist-600` (cinza apagado, usado em labels/eyebrows) |
| Acento de marca ("signal", verde-água) | `--color-signal-400/500/600`, `--color-signal-glow` (para sombras/glow) |
| Semântica de estado (cobertura) | `--color-status-good` / `-warn` / `-bad`, cada uma com variante `-soft` para fundos |
| Tipografia | `--font-display` (Fraunces, serifada — títulos), `--font-sans` (Inter — corpo), `--font-mono` (JetBrains Mono — labels uppercase, valores numéricos, "eyebrows") |

Padrões visuais recorrentes nos componentes já construídos (Dashboard, Login, Perfil):
- Cards: `bg-ink-900 rounded-2xl border border-ink-border-soft`
- Labels/eyebrows: `font-mono text-[11px] uppercase tracking-wider text-mist-600`
- Títulos: `font-display font-bold text-mist-50 tracking-tight`
- Botão primário: `bg-signal-500 text-ink-950 hover:bg-signal-400`

Há também classes utilitárias globais em `index.css`: `.animate-fade-up` (entrada suave), `.signal-ping` (pulso de indicador "online"), `.radar-sweep` (animação do radar do Dashboard) — todas respeitam `prefers-reduced-motion`.

Estilos do Leaflet (mapa) também são sobrescritos em `index.css` para combinar com o tema escuro (`.leaflet-container`, `.leaflet-tooltip`, etc.).

---

## 7. Páginas — resumo funcional

- **`Dashboard.tsx`** (`/`) — KPIs (regiões analisadas, cobertura crítica, população total), barra de consulta rápida, gauges por indicador, radar de cobertura (`CoverageRadar`), ranking de prioridade de investimento (`PriorityRanking`, calculado por `calcularPrioridades()` em `lib/indicadores.ts`), e lista de regiões com atalho para o mapa.
- **`Mapa.tsx`** (`/mapa`) — mapa Leaflet com filtro por indicador ativo e por nível de cobertura; ao selecionar uma região abre `RegionPanel` com detalhe.
- **`Consulta.tsx`** (`/consulta`) — interface de pergunta em linguagem natural ao agente IA (`AIQueryBar`), com exemplos pré-definidos e tabela com os dados da última resposta.
- **`Login.tsx`** (`/login`) — formulário único com toggle entre "Entrar" e "Registar".
- **`Perfil.tsx`** (`/perfil`) — dados do utilizador autenticado, com formulário de edição (o `PATCH /users/me` ainda está comentado/por ligar ao backend — ver `handleSave()` no componente).

---

## 8. Próximos passos sugeridos

1. Remover os `console.log` de depuração do `useLogin`.
2. Decidir o destino de `src/store/api/` (RTK Query) — remover ou documentar como plano futuro.
3. Ligar o `PATCH /users/me` na página de Perfil (`updateProfile`, já definido em `store/api/auth.api.ts` como referência de contrato, mesmo que não seja esse o código chamado de facto — replicar a chamada via Axios em `useApi.ts` ou `useAuth.ts` para manter consistência com o resto da app).
4. Confirmar com o backend o comportamento exato de `/auth/refresh` (formato da resposta, tempo de vida do `accessToken`) e testar o fluxo de expiração/renovação de ponta a ponta.
