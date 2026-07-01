import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createIndicatorRepository } from '../../persistence/indicator.repository'
import { createIndicatorDataRepository } from '../../persistence/indicator-data.repository'
import { createIndicatorService } from '../../../application/services/indicator.service'
import { authMiddleware } from '@/middlewares/auth.middleware'
import { rateLimitMiddleware, RateLimitPresets } from '@/middlewares/rate-limit.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import {
  indicatorIdSchema,
  indicatorDataFiltersSchema,
  criticalDataQuerySchema,
} from '../../../application/dtos/indicator.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type {
  IndicatorResponseDTO,
  IndicatorDataResponseDTO,
} from '../../../application/dtos/indicator.dto'
import { regions } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

export const indicatorController = new Elysia({ prefix: '/indicators' })
  .use(authMiddleware())
  .use(rateLimitMiddleware(RateLimitPresets.API))

  .get('/',
    async (): Promise<Result<IndicatorResponseDTO[], AppError>> => {
      const result = await repo.findActive()
      return { success: true, value: result }
    },
    { detail: { tags: ['indicators'], summary: 'Listar indicadores activos' } }
  )

  .get('/:id',
    async ({ params }): Promise<Result<IndicatorResponseDTO, AppError>> => {
      const v = validateWithZod(indicatorIdSchema, params, 'IndicatorController')
      if (!v.success) return v
      const indicator = await repo.findById(v.value.id)
      if (!indicator) {
        return { success: false, error: { type: 'NOT_FOUND', statusCode: 404, message: 'Indicador não encontrado', resource: 'Indicator', resourceId: v.value.id, timestamp: new Date().toISOString() } as AppError }
      }
      return { success: true, value: indicator }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['indicators'], summary: 'Detalhe do indicador' },
    }
  )

  .get('/data',
    async ({ query }): Promise<Result<IndicatorDataResponseDTO[], AppError>> => {
      const v = validateWithZod(indicatorDataFiltersSchema, query, 'IndicatorController')
      if (!v.success) return v
      return svc.listData(v.value)
    },
    {
      query: t.Object({
        regionId:    t.Optional(t.String()),
        indicatorId: t.Optional(t.String()),
        period:      t.Optional(t.String()),
        quality:     t.Optional(t.String()),
      }),
      detail: { tags: ['indicators'], summary: 'Listar data points com filtros' },
    }
  )

  .get('/data/critical',
    async ({ query }): Promise<Result<IndicatorDataResponseDTO[], AppError>> => {
      const v = validateWithZod(criticalDataQuerySchema, query, 'IndicatorController')
      if (!v.success) return v
      return svc.getCritical(v.value.period)
    },
    {
      query: t.Object({ period: t.Optional(t.String()) }),
      detail: { tags: ['indicators'], summary: 'Data points críticos (abaixo do threshold)' },
    }
  )
