import { z } from 'zod'

export type ProgramResponseDTO = {
  id:           string
  regionId:     string | null
  name:         string
  description:  string | null
  category:     string
  organization: string | null
  municipality: string | null
  state:        string | null
  url:          string | null
  isActive:     boolean
  startsAt:     Date | null
  endsAt:       Date | null
  metadata:     Record<string, unknown>
  createdAt:    Date
  updatedAt:    Date
}

export type CreateProgramDTO = {
  regionId?:     string
  name:          string
  description?:  string
  category:      string
  organization?: string
  municipality?: string
  state?:        string
  url?:          string
  startsAt?:     Date
  endsAt?:       Date
  metadata?:     Record<string, unknown>
}

export type ProgramFiltersDTO = {
  regionId?:     string
  category?:     string
  state?:        string
  municipality?: string
  isActive?:     boolean
  page?:         number
  pageSize?:     number
}

export const createProgramSchema = z.object({
  regionId:     z.string().uuid().optional(),
  name:         z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description:  z.string().optional(),
  category:     z.enum(['training', 'employability', 'structured_experiences', 'mentorships', 'mental_health']),
  organization: z.string().optional(),
  municipality: z.string().optional(),
  state:        z.string().optional(),
  url:          z.string().url().optional().or(z.literal('')),
  startsAt:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  endsAt:       z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  metadata:     z.record(z.unknown()).optional(),
})

export const updateProgramSchema = z.object({
  regionId:     z.string().uuid().optional(),
  name:         z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  description:  z.string().optional(),
  category:     z.enum(['training', 'employability', 'structured_experiences', 'mentorships', 'mental_health']).optional(),
  organization: z.string().optional(),
  municipality: z.string().optional(),
  state:        z.string().optional(),
  url:          z.string().url().optional().or(z.literal('')),
  isActive:     z.boolean().optional(),
  startsAt:     z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  endsAt:       z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  metadata:     z.record(z.unknown()).optional(),
})

export const programFiltersSchema = z.object({
  regionId:     z.string().uuid().optional(),
  category:     z.enum(['training', 'employability', 'structured_experiences', 'mentorships', 'mental_health']).optional(),
  state:        z.string().optional(),
  municipality: z.string().optional(),
  isActive:     z.coerce.boolean().optional(),
  page:         z.coerce.number().min(1).default(1),
  pageSize:     z.coerce.number().min(1).max(100).default(20),
})

export const programIdSchema = z.object({
  id: z.string().uuid('ID inválido'),
})
