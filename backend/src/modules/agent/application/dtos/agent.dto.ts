import { z } from 'zod'

export type AgentQueryDTO = {
  query:   string
  filters?: {
    region?:    string
    indicator?: string
    period?:    string
  }
}

export type AgentResponseDTO = {
  queryId:      string
  query:        string
  generatedSql: string | null
  sqlValid:     boolean
  result:       Record<string, unknown>[] | null
  aiResponse:   string
  rowsReturned: number
  latencyMs:    number
  groqModel:    string
  tokensUsed:   number | null
  error:        string | null
}

export type QueryLogFiltersDTO = {
  userId?:   string
  from?:     Date
  to?:       Date
  hasError?: boolean
  page?:     number
  pageSize?: number
}

export const agentQuerySchema = z.object({
  query: z.string().min(1, 'A pergunta não pode estar vazia').max(2000, 'A pergunta é muito longa'),
  filters: z.object({
    region:    z.string().optional(),
    indicator: z.string().optional(),
    period:    z.string().optional(),
  }).optional(),
})

export const queryLogFiltersSchema = z.object({
  userId:   z.string().uuid().optional(),
  from:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  to:       z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  hasError: z.coerce.boolean().optional(),
  page:     z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export const queryLogIdSchema = z.object({
  id: z.string().uuid('ID inválido'),
})
