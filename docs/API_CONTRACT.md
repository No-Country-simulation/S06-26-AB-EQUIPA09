# API_CONTRACT

# API Versioning

Base URL

```http
/api/v1
```

---

# Padrão de Resposta

## Success

```json
{
  "success": true,
  "data": {}
}
```

## Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem"
  }
}
```

---

# POST /dados

Consulta inteligente.

## Request

```json
{
  "consulta": "Onde faltam programas de formação?",
  "filtros": {
    "regiao": "Luanda",
    "indicador": "TRAINING"
  },
  "idioma": "pt"
}
```

## Response

```json
{
  "success": true,
  "data": {
    "resposta_ia": "...",
    "dados": [],
    "fontes": []
  }
}
```

---

# GET /mapa

## Response

```json
{
  "success": true,
  "data": {
    "regioes": [
      {
        "id": "1",
        "nome": "Luanda",
        "lat": -8.83,
        "lng": 13.24,
        "concentracao": 82,
        "cobertura_rede": 71
      }
    ]
  }
}
```

---

# GET /regioes

## Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "nome": "Luanda"
    }
  ]
}
```

---

# GET /indicadores

## Response

```json
{
  "success": true,
  "data": [
    "EMPLOYMENT",
    "TRAINING",
    "MENTAL_HEALTH",
    "MENTORING",
    "SOCIAL_EXPERIENCES"
  ]
}
```

---

# POST /relatorios

## Request

```json
{
  "regiao": "Luanda",
  "indicadores": [
    "EMPLOYMENT",
    "TRAINING"
  ],
  "formato": "pdf"
}
```

## Response

```json
{
  "success": true,
  "data": {
    "download_url": "/reports/report-001.pdf"
  }
}
```

---

# OpenAPI Source Of Truth

```text
packages/contracts/openapi
```

Toda alteração de endpoint deve ser refletida primeiro no OpenAPI.

---

# Error Codes

| Code                   | HTTP |
| ---------------------- | ---- |
| INVALID_REQUEST        | 400  |
| REGION_NOT_FOUND       | 404  |
| INDICATOR_NOT_FOUND    | 404  |
| DATA_NOT_AVAILABLE     | 404  |
| AI_SERVICE_UNAVAILABLE | 503  |
| INTERNAL_ERROR         | 500  |

---

# Contract Rules

1. Frontend nunca consome endpoints não documentados.
2. Backend nunca cria endpoints sem contrato.
3. Toda mudança deve atualizar OpenAPI.
4. Contratos são versionados.
