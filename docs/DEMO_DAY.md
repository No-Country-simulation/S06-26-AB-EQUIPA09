# Demo Day — roteiro de 5 minutos

## Objetivo

Mostrar que o SQLens transforma dados CDRView em uma visão operacional para decisão pública:

- onde há concentração de pessoas;
- onde a cobertura de rede é mais fraca;
- que regiões merecem prioridade;
- como o agente de IA responde perguntas em linguagem natural sobre os dados.

## Dados usados no demo

Para o demo, não é necessário baixar os ficheiros grandes do repositório dos dados.

Usar os CSVs pequenos/médios já presentes em `cvss/`:

- `antenas_flp (1).csv`
- `tensor_concentracao.csv`
- `tensor_fluxo_vias.csv`
- `tensor_od.csv`
- `tensor_tempo_deslocamento.csv`
- `trajetos_comuns (1).csv`
- `sumario_kanon (1).csv`

O script atual importa para o modelo da aplicação:

- antenas e zonas para `regions` e `base_stations`;
- concentração por antena/dia/período para `cdrview_records`;
- agregados mensais para `region_coverage`;
- registo das fontes restantes em `data_sources`.

Os ficheiros grandes `tensor_mobilidade.csv` e `tensor_sequencias.csv` só são necessários se a apresentação exigir análise individual por sessão/assinante ou trajetos completos. Para o MVP, usar os agregados é suficiente.

## Como alimentar os dados

### Caminho recomendado para o demo

```bash
cd backend
bun db:migrate
bun db:seed
bun run ingest:cvss
```

Se a pasta estiver noutro local:

```bash
bun run ingest:cvss /caminho/para/cvss
```

### Upload pelo front

Existe upload no front em:

```txt
/staff/ingestion
```

Fluxo:

1. Entrar como staff.
2. Criar um `data source`.
3. Fazer upload de um CSV.

Limitação importante: o upload pelo front chama `/staff/data-sources/:id/trigger-stream` e espera o formato CDRView normalizado:

```csv
zone_id,name,municipality,state,country,lat,lng,station_id,technology,carrier,power_dbm,period,people_count,network_technology,signal_strength,hour_of_day,day_of_week,estimated_population,area_km2
```

Os ficheiros nativos da pasta `cvss/`, como `tensor_concentracao.csv`, `tensor_od.csv` e `tensor_fluxo_vias.csv`, não devem ser enviados diretamente por esse upload sem transformação. Para eles, usar `bun run ingest:cvss`.

## Checklist antes da apresentação

1. Backend ligado.
2. Frontend ligado.
3. Postgres com migrations aplicadas.
4. Staff seed criado.
5. `bun run ingest:cvss` executado com sucesso.
6. `GROQ_API_KEY` configurada no `.env` do backend.
7. Confirmar que `/regions`, `/coverage` e `/agent/query` respondem.

## Roteiro de 5 minutos

### 0:00–0:40 — Problema

Explicar em uma frase:

> Gestores públicos têm dados de mobilidade e cobertura, mas esses dados normalmente ficam em CSVs técnicos. O SQLens transforma isso em mapa, prioridade e perguntas em linguagem natural.

### 0:40–1:40 — Dashboard

Mostrar:

- regiões carregadas;
- concentração populacional;
- radar de cobertura;
- ranking de prioridade.

Mensagem principal:

> O sistema identifica onde há mais pessoas afetadas e onde a infraestrutura digital tem maior défice.

### 1:40–2:40 — Mapa

Mostrar:

- distribuição espacial das regiões;
- filtros por nível de cobertura;
- regiões críticas/atenção/boas.

Mensagem principal:

> A decisão deixa de ser por tabela e passa a ser por território.

### 2:40–4:20 — Agente IA

Fazer 2 ou 3 perguntas no máximo. Não tentar muitas perguntas ao vivo.

Perguntas recomendadas:

1. `Quais regiões têm maior concentração de pessoas e menor cobertura de rede?`
2. `Mostra as 5 zonas com pior cobertura de rede.`
3. `Onde a concentração diurna é maior?`
4. `Quais municípios têm mais regiões críticas?`
5. `Qual região deve ser priorizada para investimento em conectividade?`

Perguntas alternativas se houver tempo:

1. `Compara a concentração diurna e noturna por região.`
2. `Quais zonas têm maior concentração máxima no período de março de 2026?`
3. `Mostra as regiões com cobertura abaixo de 70%.`
4. `Quais fontes de dados foram usadas na ingestão?`
5. `Quantos registros CDRView foram carregados por região?`

Mensagem principal:

> O agente não inventa uma resposta livre: ele gera SQL read-only sobre as tabelas permitidas, executa e devolve explicação com base nos dados.

### 4:20–5:00 — Fecho

Resumo:

> Em cinco minutos, saímos de CSVs técnicos para um painel territorial e um analista de IA consultável. A próxima etapa é adicionar tabelas dedicadas para fluxo OD, corredores viários e, se necessário, os ficheiros grandes de mobilidade individual.

## O que pode continuar zerado

É esperado que algumas áreas fiquem zeradas se ainda não houver dados específicos:

- indicadores sociais em `indicator_data`;
- programas públicos em `programs`;
- métricas de trajetos individuais;
- segmentação demográfica por assinante.

Não é erro da ingestão CDRView. Esses dados exigem fontes/tabelas próprias ou seeds adicionais.

Depois da ingestão `cvss`, não devem ficar zerados:

- regiões;
- antenas;
- concentração;
- cobertura mensal;
- data sources.

