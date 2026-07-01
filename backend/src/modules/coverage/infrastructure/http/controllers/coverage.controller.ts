import { Elysia, t } from 'elysia'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { cdrviewRecords, regions } from '@/db/schema'
import { createRegionCoverageRepository } from '../../persistence/region-coverage.repository'
import { createCoverageService } from '../../../application/services/coverage.service'
import { authMiddleware } from '@/middlewares/auth.middleware'
import { rateLimitMiddleware, RateLimitPresets } from '@/middlewares/rate-limit.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import {
  coverageFiltersSchema,
  regionIdSchema,
  regionPeriodSchema,
  criticalQuerySchema,
} from '../../../application/dtos/coverage.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { CoverageResponseDTO } from '../../../application/dtos/coverage.dto'

const repo = createRegionCoverageRepository(db)

const cdrviewRepo = {
  async findByRegionAndPeriod(regionId: string, period: string) {
    const rows = await db
      .select({
        peopleCount:       cdrviewRecords.peopleCount,
        signalStrength:    cdrviewRecords.signalStrength,
        networkTechnology: cdrviewRecords.networkTechnology,
        hourOfDay:         cdrviewRecords.hourOfDay,
      })
      .from(cdrviewRecords)
      .where(and(
        eq(cdrviewRecords.regionId, regionId),
        eq(cdrviewRecords.period, new Date(period)),
      ))
    return rows
  },
}

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

const svc = createCoverageService(repo, cdrviewRepo, regionRepo)

export const coverageController = new Elysia({ prefix: '/coverage' })
  .use(authMiddleware())
  .use(rateLimitMiddleware(RateLimitPresets.API))

  .get('/',
    async ({ query }): Promise<Result<CoverageResponseDTO[], AppError>> => {
      const v = validateWithZod(coverageFiltersSchema, query, 'CoverageController')
      if (!v.success) return v
      return svc.listCoverage(v.value)
    },
    {
      query: t.Object({
        period:          t.Optional(t.String()),
        no4gOr5gCoverage: t.Optional(t.Boolean()),
        minScore:        t.Optional(t.Number()),
      }),
      detail: { tags: ['coverage'], summary: 'Listar coberturas com filtros' },
    }
  )

  .get('/:regionId',
    async ({ params }): Promise<Result<CoverageResponseDTO[], AppError>> => {
      const v = validateWithZod(regionIdSchema, params, 'CoverageController')
      if (!v.success) return v
      const result = await repo.findByRegion(v.value.regionId)
      return { success: true, value: result }
    },
    {
      params: t.Object({ regionId: t.String() }),
      detail: { tags: ['coverage'], summary: 'Listar períodos de cobertura de uma região' },
    }
  )

  .get('/:regionId/:period',
    async ({ params }): Promise<Result<CoverageResponseDTO, AppError>> => {
      const v = validateWithZod(regionPeriodSchema, params, 'CoverageController')
      if (!v.success) return v
      return svc.getCoverage(v.value.regionId, v.value.period)
    },
    {
      params: t.Object({ regionId: t.String(), period: t.String() }),
      detail: { tags: ['coverage'], summary: 'Detalhe de cobertura por região e período' },
    }
  )

  .get('/critical',
    async ({ query }): Promise<Result<CoverageResponseDTO[], AppError>> => {
      const v = validateWithZod(criticalQuerySchema, query, 'CoverageController')
      if (!v.success) return v
      return svc.getCriticalZones(v.value.period)
    },
    {
      query: t.Object({ period: t.Optional(t.String()) }),
      detail: { tags: ['coverage'], summary: 'Zonas críticas sem cobertura 4G/5G' },
    }
  )
