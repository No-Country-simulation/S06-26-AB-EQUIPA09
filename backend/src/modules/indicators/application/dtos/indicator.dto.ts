import { z } from 'zod'

export type IndicatorResponseDTO = {
  id:                 string
  slug:               string
  name:               string
  description:        string | null
  category:           string
  unit:               string
  direction:          string
  criticalThresholds: Record<string, unknown> | null
  sourceId:           string | null
  isActive:           boolean
  createdAt:          Date
  updatedAt:          Date
}

export type CreateIndicatorDTO = {
  slug:               string
  name:               string
  description?:       string
  category:           string
  unit:               string
  direction?:         string
  criticalThresholds?: Record<string, unknown>
  sourceId?:          string
}

export type UpdateIndicatorDTO = {
  name?:               string
  description?:        string
  category?:           string
  unit?:               string
  direction?:          string
  criticalThresholds?: Record<string, unknown>
  sourceId?:           string
  isActive?:           boolean
}

export type IndicatorDataResponseDTO = {
  id:              string
  regionId:        string
  indicatorId:     string
  sourceId:        string | null
  period:          string
  value:           number
  normalizedValue: number | null
  quality:         string
  notes:           string | null
  updatedAt:       Date
}

export type UpsertIndicatorDataDTO = {
  regionId:        string
  indicatorId:     string
  period:          string
  value:           number
  normalizedValue?: number
  quality?:        string
  notes?:          string
  sourceId?:       string
}

export type IndicatorDataFiltersDTO = {
  regionId?:    string
  indicatorId?: string
  period?:      string
  quality?:     string
}

export const createIndicatorSchema = z.object({
  slug:               z.string().min(2, 'Slug deve ter pelo menos 2 caracteres').max(100),
  name:               z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  description:        z.string().optional(),
  category:           z.string().min(1, 'Categoria obrigatória').max(50),
  unit:               z.string().min(1, 'Unidade obrigatória').max(50),
  direction:          z.string().default('higher_is_better'),
  criticalThresholds: z.record(z.unknown()).optional(),
  sourceId:           z.string().uuid().optional(),
})

export const updateIndicatorSchema = z.object({
  name:               z.string().min(2).max(200).optional(),
  description:        z.string().optional(),
  category:           z.string().max(50).optional(),
  unit:               z.string().max(50).optional(),
  direction:          z.string().optional(),
  criticalThresholds: z.record(z.unknown()).optional(),
  sourceId:           z.string().uuid().optional(),
  isActive:           z.boolean().optional(),
})

export const indicatorIdSchema = z.object({
  id: z.string().uuid('ID inválido'),
})

export const upsertIndicatorDataSchema = z.object({
  regionId:        z.string().uuid('ID de região inválido'),
  indicatorId:     z.string().uuid('ID de indicador inválido'),
  period:          z.string().min(1, 'Período obrigatório'),
  value:           z.number(),
  normalizedValue: z.number().min(0).max(1).optional(),
  quality:         z.string().default('estimated'),
  notes:           z.string().optional(),
  sourceId:        z.string().uuid().optional(),
})

export const indicatorDataFiltersSchema = z.object({
  regionId:    z.string().uuid().optional(),
  indicatorId: z.string().uuid().optional(),
  period:      z.string().optional(),
  quality:     z.string().optional(),
})

export const criticalDataQuerySchema = z.object({
  period: z.string().optional(),
})
