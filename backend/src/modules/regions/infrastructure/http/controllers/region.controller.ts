import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createRegionRepository } from '../../persistence/region.repository'
import { createRegionService } from '@/modules/regions/application/services/region.service'
import { authMiddleware } from '@/middlewares/auth.middleware'
import { rateLimitMiddleware, RateLimitPresets } from '@/middlewares/rate-limit.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import {
  regionFiltersSchema,
  regionIdSchema,
  stationFiltersSchema,
  stateQuerySchema,
  municipalityQuerySchema,
} from '../../../application/dtos/region.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { RegionResponseDTO, BaseStationResponseDTO } from '../../../application/dtos/region.dto'

const regionRepo = createRegionRepository(db)
const regionSvc = createRegionService(regionRepo)

export const regionsController = new Elysia({ prefix: '/regions' })
  .use(authMiddleware())
  .use(rateLimitMiddleware(RateLimitPresets.API))

  .get('/meta/states',
    async ({ query }): Promise<Result<string[], AppError>> => {
      const v = validateWithZod(stateQuerySchema, query, 'RegionsController')
      if (!v.success) return v
      return regionSvc.listStates(v.value.country)
    },
    {
      query: t.Object({ country: t.Optional(t.String()) }),
      detail: { tags: ['regions'], summary: 'Listar estados distintos' },
    }
  )

  .get('/meta/municipalities',
    async ({ query }): Promise<Result<string[], AppError>> => {
      const v = validateWithZod(municipalityQuerySchema, query, 'RegionsController')
      if (!v.success) return v
      return regionSvc.listMunicipalities(v.value.state)
    },
    {
      query: t.Object({ state: t.String() }),
      detail: { tags: ['regions'], summary: 'Listar municípios de um estado' },
    }
  )

  .get('/',
    async ({ query }): Promise<Result<{ data: RegionResponseDTO[]; total: number }, AppError>> => {
      const v = validateWithZod(regionFiltersSchema, query, 'RegionsController')
      if (!v.success) return v
      return regionSvc.listRegions(v.value)
    },
    {
      query: t.Object({
        state: t.Optional(t.String()),
        municipality: t.Optional(t.String()),
        country: t.Optional(t.String()),
        page: t.Optional(t.Number()),
        pageSize: t.Optional(t.Number()),
      }),
      detail: { tags: ['regions'], summary: 'Listar regiões com filtros' },
    }
  )

  .get('/:id',
    async ({ params }): Promise<Result<RegionResponseDTO, AppError>> => {
      const v = validateWithZod(regionIdSchema, params, 'RegionsController')
      if (!v.success) return v
      return regionSvc.getRegion(v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['regions'], summary: 'Detalhe de uma região' },
    }
  )

  .get('/:id/stations',
    async ({ params, query }): Promise<Result<BaseStationResponseDTO[], AppError>> => {
      const v = validateWithZod(regionIdSchema, params, 'RegionsController')
      if (!v.success) return v
      const s = validateWithZod(stationFiltersSchema, query, 'RegionsController')
      if (!s.success) return s
      return regionSvc.getBaseStations(v.value.id, s.value)
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        technology: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: { tags: ['regions'], summary: 'Estações base de uma região' },
    }
  )
