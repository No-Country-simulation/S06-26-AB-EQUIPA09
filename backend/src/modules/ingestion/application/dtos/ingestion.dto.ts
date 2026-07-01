import { z } from 'zod'

export type DataSourceResponseDTO = {
  id: string
  slug: string
  name: string
  description: string | null
  url: string | null
  type: string
  country: string
  isActive: boolean
  lastIngestedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CreateDataSourceDTO = {
  slug: string
  name: string
  description?: string | null
  url?: string | null
  type?: string
  country?: string
}

export type UpdateDataSourceDTO = {
  name?: string
  description?: string | null
  url?: string | null
  type?: string
  country?: string
  isActive?: boolean
}

export type CDRViewRowDTO = {
  regionId: string
  stationId: string | null
  period: Date
  hourOfDay: number
  dayOfWeek: number
  peopleCount: number
  networkTechnology: string | null
  signalStrength: number | null
}

export type IngestionResultDTO = {
  recordsInserted: number
  regionsUpserted: number
  stationsUpserted: number
  sourceId: string
}

export type StreamingProgress = {
  rowsProcessed: number
  recordsInserted: number
  regionsUpserted: number
  stationsUpserted: number
  batchNumber: number
}

export const createDataSourceSchema = z.object({
  slug: z.string().min(2, 'Slug deve ter pelo menos 2 caracteres').max(100),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  description: z.string().optional().nullable(),
  url: z.string().url('URL inválida').optional().nullable(),
  type: z.string().max(50).default('csv'),
  country: z.string().max(10).default('BR'),
})

export const updateDataSourceSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().optional().nullable(),
  url: z.string().url('URL inválida').optional().nullable(),
  type: z.string().max(50).optional(),
  country: z.string().max(10).optional(),
  isActive: z.boolean().optional(),
})

export const dataSourceIdSchema = z.object({
  id: z.string().uuid('ID de fonte de dados inválido'),
})

export const triggerIngestionSchema = z.object({
  csvContent: z.string().min(1, 'Conteúdo CSV é obrigatório'),
})

export const listDataSourcesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  isActive: z.coerce.boolean().optional(),
  country: z.string().optional(),
})
