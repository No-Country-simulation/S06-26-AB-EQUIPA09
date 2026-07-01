# SQLens — Radar de Inclusão Digital

Painel de dados públicos para identificar e **priorizar** lacunas de inclusão digital em Luanda, Angola. Construído para o **Desafio B2G (App BiT)**.

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
| Concentração populacional | 40% | Mais gente afetada → maior retorno social por Kwanza investido |
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
- **Mapa robusto a qualquer dataset**: em vez de um centro fixo, o mapa ajusta automaticamente o enquadramento (`FitBounds`) às coordenadas das regiões recebidas — funciona com qualquer cidade/território sem alterar código.

## Stack

| Camada | Tecnologia |
|---|---|
| Build | Vite 7 |
| UI | React 19 + TypeScript |
| Estilos | Tailwind CSS v4 (tokens via `@theme`, sem cores no `tailwind.config`) |
| Routing | React Router 7 |
| Estado servidor | TanStack Query |
| Estado cliente | Zustand |
| Mapa | React Leaflet + tiles CARTO Dark Matter |
| Gráficos | Recharts (radar de comparação) + SVG nativo (radar de cobertura, gauges) |
| Animações | Framer Motion (disponível), CSS keyframes para os indicadores de sinal |

## Estrutura

```
src/
├── components/
│   ├── dashboard/
│   │   ├── CoverageRadar.tsx     # elemento de assinatura — radar SVG de cobertura
│   │   └── PriorityRanking.tsx   # diferencial — ranking do índice de prioridade
│   ├── layout/
│   │   └── Layout.tsx            # sidebar (snapshot + prioridade #1) + topbar
│   ├── map/
│   │   ├── CoberturaTag.tsx
│   │   ├── MapView.tsx           # Leaflet, tiles CARTO, auto-fit de bounds
│   │   └── RegionPanel.tsx       # painel da região + radar comparativo
│   ├── query/
│   │   └── AIQueryBar.tsx        # barra de consulta em linguagem natural
│   └── ui/
│       └── CircularGauge.tsx     # gauge circular reutilizável
├── lib/
│   └── indicadores.ts            # mediaIndicador, regiaoMaisCritica, calcularPrioridades
├── pages/
│   ├── Dashboard.tsx
│   ├── Mapa.tsx
│   └── Consulta.tsx
├── hooks/useApi.ts                # React Query + mock/API toggle
├── store/index.ts                 # Zustand (seleção, filtros, última resposta)
├── data/mock.ts                   # dataset mock de regiões de Luanda
└── types/index.ts
```

## Como correr

```bash
npm install
npm run dev
```

Por omissão usa dados mock (`VITE_USE_MOCK=true` em `src/.env`). Para ligar a uma API real, definir:

```
VITE_USE_MOCK=false
VITE_API_URL=https://a-tua-api
```

A API esperada expõe `GET /mapa` (lista de regiões) e `POST /dados` (consulta em linguagem natural) — ver os tipos em `src/types/index.ts` e o contrato em `src/hooks/useApi.ts`.

### Outros scripts

```bash
npm run build       # tsc -b && vite build
npm run typecheck   # tsc --noEmit
npm run lint
npm run preview     # serve o build de produção
```

## Notas de implementação

- O mapa usa **auto-fit de bounds** (`MapView.tsx`) calculado a partir das coordenadas das regiões recebidas, em vez de um centro fixo — torna a aplicação robusta a qualquer cidade/dataset, sem coordenadas "chumbadas" no código. Centro de fallback (antes dos dados chegarem): Luanda, `[-8.84, 13.23]`.
- Os tiles usam o serviço público CARTO: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` com `subdomains="abcd"`. *(Nota: o path correto do CARTO é `dark_all`, não `dark_matter` — um erro fácil de cometer que deixa o mapa em branco por os tiles devolverem 404.)*
- Cores de estado (crítica / atenção / boa) e todos os tokens visuais estão centralizados em `src/index.css` via `@theme` do Tailwind v4 — para ajustar a paleta, basta editar as variáveis `--color-*` num único sítio.
- `prefers-reduced-motion` é respeitado: as animações de "sinal" (pulso, sweep do radar) desligam-se automaticamente.
- `tsconfig.json` não vinha no scaffold original do projeto — sem ele, `npm run build` falha silenciosamente ao chamar `tsc -b`. Foi adicionado na raiz do projeto (`web/tsconfig.json`).

## Próximos passos sugeridos

- Substituir o dataset mock por ligação real à API Vísent CDRView.
- Exportação de relatórios (PDF/CSV) do ranking de prioridade, por região ou por consulta IA.
- Histórico de consultas anteriores (o tipo `QueryLogEntry` já existe em `types/index.ts`, ainda por persistir/usar), com possibilidade de comparar evolução temporal por região.
- Ajustar os pesos do índice de prioridade (`calcularPrioridades`) com dados reais/feedback de especialistas em políticas públicas, em vez dos pesos iniciais (40/35/25).
