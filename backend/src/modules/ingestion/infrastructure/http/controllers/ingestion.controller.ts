import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createDataSourceRepository } from '../../persistence/data-source.repository'
import { createCDRViewRecordRepository } from '../../persistence/cdrview-record.repository'
import { createRegionRepository } from '@/modules/regions/infrastructure/persistence/region.repository'
import { createRegionCoverageRepository } from '@/modules/coverage/infrastructure/persistence/region-coverage.repository'
import { createIngestionService } from '@/modules/ingestion/application/services/ingestion.service'
import {
  createCvssIngestionService,
  type CvssIngestionResult,
  type CvssUploadedFile,
} from '@/modules/ingestion/application/services/cvss-ingestion.service'
import {
  staffAuthMiddleware,
  getStaffAuth,
} from '@/middlewares/staff-auth.middleware'
import { rateLimitMiddleware, RateLimitPresets } from '@/middlewares/rate-limit.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import {
  createDataSourceSchema,
  updateDataSourceSchema,
  dataSourceIdSchema,
  triggerIngestionSchema,
  listDataSourcesQuerySchema,
} from '../../../application/dtos/ingestion.dto'
import { Err } from '@/shared/result/types'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import { ErrorFactory } from '@/shared/result/factory'
import type {
  DataSourceResponseDTO,
  IngestionResultDTO,
} from '../../../application/dtos/ingestion.dto'
import type { ListResponse } from '../../../application/ports/ingestion.port'

const dataSourceRepo = createDataSourceRepository(db)
const cdrviewRecordRepo = createCDRViewRecordRepository(db)
const regionRepo = createRegionRepository(db)
const regionCoverageRepo = createRegionCoverageRepository(db)
const ingestionSvc = createIngestionService(dataSourceRepo, regionRepo, cdrviewRecordRepo)
const cvssIngestionSvc = createCvssIngestionService(
  dataSourceRepo,
  regionRepo,
  cdrviewRecordRepo,
  regionCoverageRepo,
)

export const ingestionController = new Elysia({ prefix: '/staff' })
  .use(staffAuthMiddleware())
  .use(rateLimitMiddleware(RateLimitPresets.API))

  .get('/data-sources',
    async ({ query }): Promise<Result<ListResponse<DataSourceResponseDTO[]>, AppError>> => {
      const v = validateWithZod(listDataSourcesQuerySchema, query, 'IngestionController')
      if (!v.success) return v
      return ingestionSvc.listDataSources(v.value.page, v.value.pageSize, {
        isActive: v.value.isActive,
        country: v.value.country,
      })
    },
    {
      query: t.Object({
        page: t.Optional(t.Number()),
        pageSize: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
        country: t.Optional(t.String()),
      }),
      detail: { tags: ['ingestion'], summary: 'Listar fontes de dados' },
    }
  )

  .post('/data-sources',
    async ({ staffAuth, body }): Promise<Result<DataSourceResponseDTO, AppError>> => {
      getStaffAuth({ staffAuth })
      const v = validateWithZod(createDataSourceSchema, body, 'IngestionController')
      if (!v.success) return v
      return ingestionSvc.registerDataSource(v.value)
    },
    {
      body: t.Object({
        slug: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        url: t.Optional(t.String()),
        type: t.Optional(t.String()),
        country: t.Optional(t.String()),
      }),
      detail: { tags: ['ingestion'], summary: 'Registar nova fonte de dados' },
    }
  )

  .get('/data-sources/:id',
    async ({ staffAuth, params }): Promise<Result<DataSourceResponseDTO, AppError>> => {
      getStaffAuth({ staffAuth })
      const v = validateWithZod(dataSourceIdSchema, params, 'IngestionController')
      if (!v.success) return v
      return ingestionSvc.getDataSource(v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['ingestion'], summary: 'Obter fonte de dados por ID' },
    }
  )

  .patch('/data-sources/:id',
    async ({ staffAuth, params, body }): Promise<Result<DataSourceResponseDTO, AppError>> => {
      getStaffAuth({ staffAuth })
      const v = validateWithZod(dataSourceIdSchema, params, 'IngestionController')
      if (!v.success) return v
      const b = validateWithZod(updateDataSourceSchema, body, 'IngestionController')
      if (!b.success) return b
      return ingestionSvc.updateDataSource(v.value.id, b.value)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        url: t.Optional(t.String()),
        type: t.Optional(t.String()),
        country: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: { tags: ['ingestion'], summary: 'Actualizar fonte de dados' },
    }
  )

  .post('/data-sources/:id/trigger',
    async ({ staffAuth, params, body }): Promise<Result<IngestionResultDTO, AppError>> => {
      getStaffAuth({ staffAuth })
      const v = validateWithZod(dataSourceIdSchema, params, 'IngestionController')
      if (!v.success) return v
      const b = validateWithZod(triggerIngestionSchema, body, 'IngestionController')
      if (!b.success) return b
      return ingestionSvc.runCDRViewPipeline(v.value.id, b.value.csvContent)
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ csvContent: t.String() }),
      detail: { tags: ['ingestion'], summary: 'Executar pipeline de ingestão CDRView' },
    }
  )

  .post('/data-sources/:id/trigger-stream',
    async ({ staffAuth, params, request }): Promise<Result<IngestionResultDTO, AppError>> => {
      getStaffAuth({ staffAuth })
      const v = validateWithZod(dataSourceIdSchema, params, 'IngestionController')
      if (!v.success) return v
      if (!request.body) {
        return Err(ErrorFactory.validation('Body CSV é obrigatório', [], 'IngestionController'))
      }
      return ingestionSvc.runCDRViewPipelineStream(v.value.id, request.body, request.signal)
    },
    {
      type: 'none',
      params: t.Object({ id: t.String() }),
      detail: { tags: ['ingestion'], summary: 'Executar pipeline de ingestão CDRView via streaming (CSV)' },
    }
  )

  .post('/cvss/upload',
    async ({ staffAuth, request }): Promise<Result<CvssIngestionResult, AppError>> => {
      getStaffAuth({ staffAuth })

      try {
        const formData = await request.formData()
        const uploaded: CvssUploadedFile[] = []

        for (const value of formData.values()) {
          if (!(value instanceof File)) continue
          if (!value.name.toLowerCase().endsWith('.csv')) continue

          uploaded.push({
            name: value.name,
            content: await value.text(),
          })
        }

        if (uploaded.length === 0) {
          return Err(ErrorFactory.validation('Selecione pelo menos um ficheiro CSV.', [], 'IngestionController'))
        }

        const result = await cvssIngestionSvc.ingestUploadedFiles(uploaded)
        return { success: true, value: result }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha na ingestão CVSS.'
        return Err(ErrorFactory.validation(message, [], 'IngestionController'))
      }
    },
    {
      detail: { tags: ['ingestion'], summary: 'Executar ingestão CVSS por upload de CSVs' },
    }
  )
