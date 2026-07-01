import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { regions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createIndicatorRepository } from '../../persistence/indicator.repository'
import { createIndicatorDataRepository } from '../../persistence/indicator-data.repository'
import { createIndicatorService } from '../../../application/services/indicator.service'
import { staffAuthMiddleware, getStaffAuth } from '@/middlewares/staff-auth.middleware'
import { rateLimitMiddleware, RateLimitPresets } from '@/middlewares/rate-limit.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import {
  createIndicatorSchema,
  updateIndicatorSchema,
  indicatorIdSchema,
  upsertIndicatorDataSchema,
} from '../../../application/dtos/indicator.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type {
  IndicatorResponseDTO,
  IndicatorDataResponseDTO,
} from '../../../application/dtos/indicator.dto'
import type { ListResponse } from '../../../application/ports/indicator.port'

const repo = createIndicatorRepository(db)
const dataRepo = createIndicatorDataRepository(db)

const regionRepo = {
  async findById(id: string) {
    const [row] = await db
      .select({ id: regions.id })
      .from(regions)
      .where(eq(regions.id, id))
      .limit(1)
    return row ?? null
  },
}

const indicatorRepo = {
  async findById(id: string) {
    const row = await repo.findById(id)
    return row ?? null
  },
}

const svc = createIndicatorService(repo, dataRepo, regionRepo, indicatorRepo)

export const staffIndicatorController = new Elysia({ prefix: '/staff/indicators' })
  .use(staffAuthMiddleware())
  .use(rateLimitMiddleware(RateLimitPresets.API))

  .get('/',
    async ({ query, staffAuth }): Promise<Result<ListResponse<IndicatorResponseDTO[]>, AppError>> => {
      getStaffAuth({ staffAuth })
      const { page = 1, perPage = 20, category, isActive } = query as { page?: number; perPage?: number; category?: string; isActive?: string }
      const isActiveBool = isActive !== undefined ? isActive === 'true' : undefined
      return svc.listIndicators(page, perPage, { category, isActive: isActiveBool })
    },
    {
      query: t.Object({
        page:     t.Optional(t.Number()),
        perPage:  t.Optional(t.Number()),
        category: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
      }),
      detail: { tags: ['staff-indicators'], summary: 'Listar indicadores' },
    }
  )

  .post('/',
    async ({ staffAuth, body }): Promise<Result<IndicatorResponseDTO, AppError>> => {
      const { staffId } = getStaffAuth({ staffAuth })
      const v = validateWithZod(createIndicatorSchema, body, 'StaffIndicatorController')
      if (!v.success) return v
      return svc.createIndicator(v.value, staffId)
    },
    {
      body: t.Object({
        slug:               t.String(),
        name:               t.String(),
        description:        t.Optional(t.String()),
        category:           t.String(),
        unit:               t.String(),
        direction:          t.Optional(t.String()),
        criticalThresholds: t.Optional(t.Record(t.String(), t.Unknown())),
        sourceId:           t.Optional(t.String()),
      }),
      detail: { tags: ['staff-indicators'], summary: 'Criar indicador' },
    }
  )

  .patch('/:id',
    async ({ staffAuth, params, body }): Promise<Result<IndicatorResponseDTO, AppError>> => {
      const { staffId } = getStaffAuth({ staffAuth })
      const vParams = validateWithZod(indicatorIdSchema, params, 'StaffIndicatorController')
      if (!vParams.success) return vParams
      const vBody = validateWithZod(updateIndicatorSchema, body, 'StaffIndicatorController')
      if (!vBody.success) return vBody
      return svc.updateIndicator(vParams.value.id, vBody.value, staffId)
    },
    {
      params: t.Object({ id: t.String() }),
      body:   t.Object({
        name:               t.Optional(t.String()),
        description:        t.Optional(t.String()),
        category:           t.Optional(t.String()),
        unit:               t.Optional(t.String()),
        direction:          t.Optional(t.String()),
        criticalThresholds: t.Optional(t.Record(t.String(), t.Unknown())),
        sourceId:           t.Optional(t.String()),
        isActive:           t.Optional(t.Boolean()),
      }),
      detail: { tags: ['staff-indicators'], summary: 'Actualizar indicador' },
    }
  )

  .get('/:id',
    async ({ staffAuth, params }): Promise<Result<IndicatorResponseDTO, AppError>> => {
      getStaffAuth({ staffAuth })
      const v = validateWithZod(indicatorIdSchema, params, 'StaffIndicatorController')
      if (!v.success) return v
      return svc.getIndicator(v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['staff-indicators'], summary: 'Obter indicador por ID' },
    }
  )

  .post('/:id/data',
    async ({ staffAuth, params, body }): Promise<Result<IndicatorDataResponseDTO, AppError>> => {
      const { staffId } = getStaffAuth({ staffAuth })
      const vParams = validateWithZod(indicatorIdSchema, params, 'StaffIndicatorController')
      if (!vParams.success) return vParams
      const vBody = validateWithZod(upsertIndicatorDataSchema, body, 'StaffIndicatorController')
      if (!vBody.success) return vBody
      return svc.upsertData(vParams.value.id, vBody.value, staffId)
    },
    {
      params: t.Object({ id: t.String() }),
      body:   t.Object({
        regionId:        t.String(),
        indicatorId:     t.String(),
        period:          t.String(),
        value:           t.Number(),
        normalizedValue: t.Optional(t.Number()),
        quality:         t.Optional(t.String()),
        notes:           t.Optional(t.String()),
        sourceId:        t.Optional(t.String()),
      }),
      detail: { tags: ['staff-indicators'], summary: 'Upsert data point de indicador' },
    }
  )
