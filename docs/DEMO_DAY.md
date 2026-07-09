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

### Caminho simples pelo front

Também é possível alimentar os dados diretamente pelo front em:

```txt
/staff/ingestion
```

Fluxo:

1. Entrar como staff.
2. Abrir o painel **Upload CVSS**.
3. Selecionar os CSVs originais da pasta `cvss/`.
4. Enviar pelo menos:
   - `antenas_flp.csv` ou `antenas_flp (1).csv`;
   - `tensor_concentracao.csv`.
5. Opcionalmente, enviar também:
   - `tensor_fluxo_vias.csv`;
   - `tensor_od.csv`;
   - `tensor_tempo_deslocamento.csv`;
   - `trajetos_comuns.csv` ou `trajetos_comuns (1).csv`;
   - `sumario_kanon.csv` ou `sumario_kanon (1).csv`.

O endpoint usado pelo front é:

```txt
POST /staff/cvss/upload
```

Esse endpoint chama o mesmo serviço usado por `bun run ingest:cvss`. Ou seja, a ingestão por terminal e a ingestão pelo front seguem o mesmo processo:

- criam/atualizam as regiões em `regions`;
- criam/atualizam as antenas em `base_stations`;
- inserem concentração em `cdrview_records`;
- calculam agregados mensais em `region_coverage`;
- registam as fontes CVSS restantes em `data_sources`.

O upload antigo por data source continua disponível para CSVs já normalizados no formato CDRView, mas o caminho recomendado para a demo é o **Upload CVSS**, porque aceita os ficheiros originais.

### Como vender isto aos jurados

Frase curta:

> Antes, a ingestão dependia de um comando técnico no terminal. Agora qualquer utilizador staff consegue carregar os CSVs originais pela interface, e o sistema executa exatamente o mesmo pipeline validado do backend.

Mensagem principal:

> Isto reduz fricção operacional: o gestor não precisa conhecer Bun, scripts ou formato interno das tabelas. Ele só faz upload dos ficheiros que recebeu, e o sistema transforma esses CSVs técnicos em mapa, cobertura, ranking e consultas por IA.

Pontos fortes para mencionar:

- **Usabilidade:** o processo deixa de depender de um programador.
- **Consistência:** front e terminal usam o mesmo serviço de ingestão, evitando duas lógicas diferentes.
- **Rastreabilidade:** as fontes carregadas ficam registadas em `data_sources`.
- **Decisão pública:** depois do upload, os dados aparecem no dashboard, mapa, cobertura mensal e agente IA.
- **MVP realista:** o produto já cobre uma tarefa operacional completa: receber CSVs, ingerir, calcular indicadores e disponibilizar análise.

## Checklist antes da apresentação

1. Backend ligado.
2. Frontend ligado.
3. Postgres com migrations aplicadas.
4. Staff seed criado.
5. Dados CVSS carregados pelo Upload CVSS no front ou por `bun run ingest:cvss`.
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

Se quiser mostrar a ingestão antes do dashboard:

> Reparem que não estou a preparar a base manualmente. Entro como staff, envio os CSVs originais e o sistema cria as regiões, antenas, concentração e cobertura automaticamente. Isto é importante porque aproxima a ferramenta de um fluxo real de operação pública.

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
