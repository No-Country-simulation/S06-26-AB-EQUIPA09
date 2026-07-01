import { z } from 'zod'

export type AlertConfigResponseDTO = {
  id:               string
  userId:           string
  indicatorId:      string
  indicator: {
    id:       string
    slug:     string
    name:     string
    unit:     string
    category: string
  }
  regionId:         string | null
  region: {
    id:           string
    name:         string
    municipality: string
    state:        string
  } | null
  criticalThreshold: number
  isActive:         boolean
  channel:          string
  lastCheckedAt:    Date | null
  createdAt:        Date
}

export type CreateAlertConfigDTO = {
  indicatorId:       string
  regionId?:         string
  criticalThreshold: number
  channel?:          string
}

export type AlertLogResponseDTO = {
  id:               string
  configId:         string
  regionId:         string
  region: {
    id:           string
    name:         string
    municipality: string
    state:        string
  }
  indicatorId:      string
  indicator: {
    id:       string
    slug:     string
    name:     string
    unit:     string
    category: string
  }
  currentValue:      number
  criticalThreshold: number
  period:            string
  sentAt:            Date
  channel:           string
}

export type AlertLogFiltersDTO = {
  from?:    Date
  to?:      Date
  page?:    number
  pageSize?: number
}

export const createAlertConfigSchema = z.object({
  indicatorId:       z.string().uuid('Indicador inválido'),
  regionId:          z.string().uuid('Região inválida').optional(),
  criticalThreshold: z.number().min(0).max(1, 'Threshold deve estar entre 0 e 1'),
  channel:           z.enum(['email', 'in_app']).default('in_app'),
})

export const updateAlertConfigSchema = z.object({
  indicatorId:       z.string().uuid('Indicador inválido').optional(),
  regionId:          z.string().uuid('Região inválida').optional(),
  criticalThreshold: z.number().min(0).max(1).optional(),
  isActive:          z.boolean().optional(),
  channel:           z.enum(['email', 'in_app']).optional(),
})

export const alertLogFiltersSchema = z.object({
  from:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  to:       z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  page:     z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export const alertConfigIdSchema = z.object({
  id: z.string().uuid('ID inválido'),
})
