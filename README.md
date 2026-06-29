# SQLens — Painel Inteligente de Inclusão Digital e Equidade Social

## Visão Geral

O SQLens é uma plataforma B2G (Business to Government) que utiliza dados geoespaciais, indicadores públicos e Inteligência Artificial para apoiar gestores públicos na tomada de decisões baseadas em evidências.

A plataforma consolida dados do dataset Vísent CDRView com fontes públicas complementares para identificar desigualdades relacionadas à:

* Inclusão Digital
* Empregabilidade
* Formação Profissional
* Saúde Mental
* Mentorias e Iniciativas Sociais

O objetivo é transformar dados dispersos em inteligência acionável para políticas públicas.

---

# Problema

Gestores públicos frequentemente enfrentam dificuldades para cruzar informações de diferentes fontes e identificar regiões que necessitam de intervenção prioritária.

Entre os desafios estão:

* Dados dispersos em múltiplas plataformas
* Falta de visualização territorial integrada
* Dificuldade em realizar consultas complexas
* Ausência de ferramentas acessíveis para análise de impacto social
* Baixa integração entre indicadores sociais e infraestrutura digital

O App BiT resolve esse problema através de um painel inteligente apoiado por IA e geolocalização.

---

# Arquitetura do Projeto

O projeto utiliza uma arquitetura Monorepo baseada em Turborepo e PNPM Workspaces.

Esta abordagem permite:

* Desenvolvimento paralelo entre equipas
* Compartilhamento de código
* Contratos únicos entre frontend e backend
* Menor overhead operacional
* Escalabilidade futura

---

# Estrutura do Monorepo

```text
appbit/
│
├── apps/
│   ├── web/
│   ├── api/
│   └── docs-site/
│
├── packages/
│   ├── contracts/
│   ├── ui/
│   ├── types/
│   ├── shared/
│   └── config/
│
├── data/
│   ├── datasets/
│   ├── pipelines/
│   ├── notebooks/
│   └── exports/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API_CONTRACT.md
│   ├── DATA_DICTIONARY.md
│   └── ADR/
│
├── infra/
│   ├── docker/
│   ├── database/
│   ├── railway/
│   └── github/
│
├── scripts/
│
├── .github/
│   └── workflows/
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

---

# Componentes do Sistema

## apps/web

Aplicação web utilizada pelos gestores públicos.

### Stack

* React
* Vite
* TypeScript
* Tailwind CSS
* TanStack Query
* React Router
* Leaflet
* Recharts
* PWA

### Responsabilidades

* Dashboard
* Mapa Geográfico
* Filtros
* Relatórios
* Interface de Consulta IA

---

## apps/api

API principal da plataforma.

### Stack

* Node.js
* Fastify
* TypeScript
* PostgreSQL
* PostGIS
* Drizzle ORM
* Redis
* Swagger/OpenAPI

### Responsabilidades

* Regras de negócio
* Exposição dos endpoints
* Integração com banco de dados
* Integração com IA
* Cache
* Geração de relatórios

---

## apps/docs-site

Portal interno de documentação.

Pode ser implementado com:

* Docusaurus
* Nextra
* Astro Starlight

Objetivo:

Centralizar toda documentação técnica da equipa.

---

# Packages Compartilhados

## packages/contracts

Fonte oficial dos contratos da API.

Contém:

```text
openapi/
schemas/
requests/
responses/
```

Regra obrigatória:

Nenhum endpoint pode ser implementado antes de existir neste módulo.

---

## packages/types

Tipos compartilhados entre frontend e backend.

Exemplos:

```ts
Region
Indicator
Report
Coverage
```

Benefícios:

* Segurança de tipos
* Menos bugs de integração
* Desenvolvimento paralelo

---

## packages/ui

Biblioteca de componentes reutilizáveis.

Exemplos:

```text
Button
Card
Table
IndicatorCard
MapLegend
AIResponseCard
```

---

## packages/shared

Código compartilhado.

Exemplos:

```text
Validators
Constants
Formatters
Utilities
```

---

## packages/config

Configuração centralizada.

Inclui:

```text
ESLint
Prettier
TypeScript
Tailwind
```

---

# Camada de Dados

## data/datasets

Armazena datasets utilizados pelo projeto.

```text
raw/
processed/
external/
```

---

## data/pipelines

Pipelines ETL.

```text
visent/
datasus/
oms/
regional/
```

Responsável por:

* Ingestão
* Limpeza
* Transformação
* Normalização

---

## data/notebooks

Área exploratória para cientistas de dados.

Ferramentas:

* Jupyter
* Pandas
* GeoPandas
* DuckDB
* Polars

---

## data/exports

Exportações para consumo da API.

```text
postgres/
parquet/
```

---

# Fluxo de Dados

```text
Dataset Vísent
        ↓
ETL
        ↓
Transformação
        ↓
PostgreSQL/PostGIS
        ↓
Fastify API
        ↓
Frontend
        ↓
Gestor Público
```

---

# Fluxo da Inteligência Artificial

```text
Pergunta
    ↓
Endpoint /dados
    ↓
AI Service
    ↓
Query Builder
    ↓
Banco de Dados
    ↓
Contexto Estruturado
    ↓
LLM
    ↓
Resposta Explicável
```

A IA não acessa diretamente os datasets.

Toda informação passa pela camada de dados validada.

---

# Banco de Dados

## Tecnologia

* PostgreSQL
* PostGIS

## Tabelas Principais

### regions

```text
id
nome
pais
lat
lng
```

---

### network_coverage

```text
id
region_id
technology
coverage_percentage
```

---

### population_density

```text
id
region_id
period
population_concentration
```

---

### indicators

```text
id
region_id
type
value
source
period
```

---

### data_sources

```text
id
name
source_url
last_update
```

---

# Documentação

Toda documentação oficial encontra-se em:

```text
docs/
```

---

## ARCHITECTURE.md

Contém:

* Diagramas C4
* Fluxos do sistema
* Responsabilidades
* Integrações
* Decisões arquiteturais

---

## API_CONTRACT.md

Contém:

* Endpoints
* Payloads
* Responses
* Errors
* Versionamento

---

## DATA_DICTIONARY.md

Dicionário oficial de dados.

Exemplo:

| Campo         | Origem | Descrição                 |
| ------------- | ------ | ------------------------- |
| concentration | Vísent | Concentração populacional |
| erb_coverage  | Vísent | Cobertura de rede         |
| technology    | Vísent | Tecnologia móvel          |

---

## ADR

Architecture Decision Records.

Documenta decisões importantes da arquitetura.

Exemplos:

```text
001-monorepo.md
002-fastify.md
003-postgis.md
004-ai-provider.md
```

---

# Infraestrutura

## Desenvolvimento Local

Utiliza Docker Compose.

Serviços:

* PostgreSQL
* Redis
* API
* Frontend

---

## Deploy

### Frontend

Vercel

### Backend

Railway

### Banco de Dados

Railway PostgreSQL

### Cache

Railway Redis

---

# CI/CD

GitHub Actions.

Pipelines:

```text
lint
test
build
deploy
```

Executados automaticamente em Pull Requests e Releases.

---

# Convenções de Branches

```text
main
develop

feature/*
bugfix/*
hotfix/*
```

Exemplos:

```text
feature/map-view
feature/ai-query
feature/visent-import
```

---

# Fluxo de Desenvolvimento

1. Criar branch a partir de develop
2. Implementar funcionalidade
3. Abrir Pull Request
4. Revisão
5. Merge para develop
6. Release para main

---

# Roadmap MVP

## Fase 1

* Estrutura do Monorepo
* Banco PostgreSQL
* Importação Vísent
* API Base
* Dashboard Inicial

## Fase 2

* Indicadores
* Visualização Geográfica
* Consultas IA

## Fase 3

* Relatórios PDF
* Exportações
* Comparativos Regionais

## Fase 4

* Multi-idioma
* Alertas
* Novas Fontes de Dados

---

# Boas Práticas

* Nunca versionar arquivos .env
* Nunca expor credenciais
* Todo endpoint deve possuir documentação OpenAPI
* Toda alteração de schema deve possuir migration
* Todo módulo deve possuir testes mínimos
* Utilizar Conventional Commits

Exemplos:

```text
feat: add map endpoint
fix: correct coverage calculation
docs: update architecture docs
```

---

# Missão

Utilizar dados, geolocalização e inteligência artificial para apoiar decisões públicas mais rápidas, transparentes e orientadas por evidências, promovendo inclusão digital e equidade social.
