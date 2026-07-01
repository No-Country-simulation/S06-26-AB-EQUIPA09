import { z } from 'zod'

export type RegionResponseDTO = {
  id: string
  zoneId: string
  name: string
  municipality: string
  state: string
  country: string
  lat: number
  lng: number
  estimatedPopulation: number | null
  areaKm2: number | null
  createdAt: Date
}

export type BaseStationResponseDTO = {
  id: string
  stationId: string
  regionId: string
  technology: '2G' | '3G' | '4G' | '5G'
  carrier: string | null
  lat: number
  lng: number
  powerDbm: number | null
  isActive: boolean
}

export type RegionFiltersDTO = {
  state?: string
  municipality?: string
  country?: string
  page?: number
  pageSize?: number
}

export const regionFiltersSchema = z.object({
  state: z.string().optional(),
  municipality: z.string().optional(),
  country: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export const stationFiltersSchema = z.object({
  technology: z.enum(['2G', '3G', '4G', '5G']).optional(),
  isActive: z.coerce.boolean().optional(),
})

export const regionIdSchema = z.object({
  id: z.string().uuid('ID de região inválido'),
})

export const stateQuerySchema = z.object({
  country: z.string().optional(),
})

export const municipalityQuerySchema = z.object({
  state: z.string().min(1, 'Estado é obrigatório'),
})
