# ARCHITECTURE

> **Nota:** este documento nasceu como plano inicial. Os diagramas e decisões abaixo foram atualizados para a stack real (Bun + Elysia + Drizzle + PostgreSQL + Valkey); detalhes de implementação estão em `backend/README.md` e `README_FRONT.md`. Os dados reais são da região metropolitana de Florianópolis (SC, Brasil).

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
│ web/                 │
│ React 19 + Vite      │
└─────────┬────────────┘
          │ HTTPS (cookies httpOnly)
          ▼

┌──────────────────────┐        ┌──────────────────────┐
│ backend/             │ ─────▶ │ LLM (Groq ou Cohere) │
│ Bun + Elysia         │  SQL   │ API compatível OpenAI│
└───┬─────────┬────────┘        └──────────────────────┘
    │         │
    ▼         ▼

 PostgreSQL   Valkey
  (Drizzle)   (BullMQ)

    ▲
    │ ingestão por streaming

┌──────────────────────┐
│ CSVs CVSS / CDRView  │
│ (upload ou CLI)      │
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
PostgreSQL
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

## PostgreSQL + Drizzle

Motivação:

* Relacional, transações e índices compostos
* SQL explícito (upserts idempotentes na ingestão)
* Sem PostGIS por agora: as coordenadas (`lat`/`lng`) bastam para o mapa

## Bun + Elysia

Motivação:

* TypeScript sem passo de build separado
* Streams Web nativos para ler CSVs grandes
* Tipagem do handler ao schema de validação

---

# Escalabilidade Futura

* Multi-país
* Multi-tenant
* Novas fontes públicas
* Modelos IA especializados
* Alertas automáticos
