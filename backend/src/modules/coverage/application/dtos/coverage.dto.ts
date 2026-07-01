import { z } from 'zod'

export type CoverageResponseDTO = {
  id:                       string
  regionId:                 string
  period:                   string
  networkCoverageScore:     number
  maxConcentration:         number
  minConcentration:         number
  avgDaytimeConcentration:  number | null
  avgNighttimeConcentration: number | null
  dominantTechnology:       string | null
  no4gOr5gCoverage:         boolean
  totalRecords:             number
  updatedAt:                Date
}

export type CoverageFiltersDTO = {
  period?:          string
  no4gOr5gCoverage?: boolean
  minScore?:        number
}

export const coverageFiltersSchema = z.object({
  period:          z.string().optional(),
  no4gOr5gCoverage: z.coerce.boolean().optional(),
  minScore:        z.coerce.number().min(0).max(1).optional(),
})

export const regionIdSchema = z.object({
  regionId: z.string().uuid('ID de região inválido'),
})

export const regionPeriodSchema = z.object({
  regionId: z.string().uuid('ID de região inválido'),
  period:   z.string(),
})

export const criticalQuerySchema = z.object({
  period: z.string().optional(),
})
