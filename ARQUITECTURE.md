# ARCHITECTURE

# App BiT — Arquitetura da Plataforma

## Objetivo

Este documento descreve a arquitetura técnica da plataforma App BiT, os fluxos de dados, integrações externas, responsabilidades dos módulos e decisões arquiteturais.

---

# Visão Geral

O App BiT é uma plataforma B2G que combina:

* Dados geoespaciais
* Dados públicos
* Inteligência Artificial
* Visualização geográfica

para apoiar gestores públicos na tomada de decisão baseada em evidências.

---

# C4 — Nível 1 (System Context)

```text
┌──────────────────────┐
│ Gestor Público       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      App BiT         │
└───────┬─────┬────────┘
        │     │
        │     │
        ▼     ▼

 Vísent      Fontes Públicas
 CDRView     DATASUS
             OMS
             INE
             Gov APIs

        │
        ▼

      LLM
```

---

# C4 — Nível 2 (Containers)

```text
┌──────────────────────┐
│ apps/web             │
│ React + Vite         │
└─────────┬────────────┘
          │ HTTPS
          ▼

┌──────────────────────┐
│ apps/api             │
│ Fastify              │
└───┬─────────┬────────┘
    │         │
    ▼         ▼

 PostgreSQL   Redis
  + PostGIS

    ▲
    │

┌──────────────────────┐
│ data/pipelines       │
│ Python ETL           │
└──────────────────────┘
```

---

# C4 — Nível 3 (API Components)

```text
API

├── Auth Module
├── Dados Module
├── Mapa Module
├── Indicadores Module
├── Relatorios Module
└── AI Module
```

---

# Fluxo de Dados

```text
Dataset Vísent
      ↓
Pipeline ETL
      ↓
Transformação
      ↓
Validação
      ↓
PostgreSQL/PostGIS
      ↓
API
      ↓
Frontend
      ↓
Usuário
```

---

# Fluxo IA

```text
Consulta
     ↓
POST /dados
     ↓
AI Service
     ↓
Query Builder
     ↓
Banco de Dados
     ↓
Context Builder
     ↓
LLM
     ↓
Resposta Estruturada
```

---

# Integrações Externas

| Sistema        | Tipo              |
| -------------- | ----------------- |
| Vísent CDRView | Dataset Principal |
| DATASUS        | Saúde             |
| OMS            | Saúde Global      |
| INE            | Estatísticas      |
| OpenAI         | IA                |

---

# Responsabilidades

## apps/web

* Dashboard
* Mapa
* Relatórios
* Interface IA

## apps/api

* Regras de negócio
* Segurança
* IA
* Persistência

## data

* ETL
* Limpeza
* Transformação

## packages/contracts

* OpenAPI
* Schemas

---

# Decisões Arquiteturais

## Monorepo

Motivação:

* Menor overhead
* Desenvolvimento paralelo
* Compartilhamento de tipos

## PostgreSQL + PostGIS

Motivação:

* Dados geográficos
* Consultas espaciais

## Fastify

Motivação:

* Alta performance
* Simplicidade

## Turborepo

Motivação:

* Cache
* Build incremental
* Escalabilidade

---

# Escalabilidade Futura

* Multi-país
* Multi-tenant
* Novas fontes públicas
* Modelos IA especializados
* Alertas automáticos
