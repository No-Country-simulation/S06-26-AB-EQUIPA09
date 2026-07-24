import { Elysia } from 'elysia'
import { db } from '@/db'
import { createDataSourceRepository } from '../../persistence/data-source.repository'
import { createCDRViewRecordRepository } from '../../persistence/cdrview-record.repository'
import { createRegionRepository } from '@/modules/regions/infrastructure/persistence/region.repository'
import { createRegionCoverageRepository } from '@/modules/coverage/infrastructure/persistence/region-coverage.repository'
import {
  createCvssIngestionService,
  type CvssUploadedFile,
} from '@/modules/ingestion/application/services/cvss-ingestion.service'
import { authMiddleware } from '@/middlewares/auth.middleware'
import { Err, Ok } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'

const COMPONENT = 'UploadController'

const dataSourceRepo = createDataSourceRepository(db)
const cdrviewRecordRepo = createCDRViewRecordRepository(db)
const regionRepo = createRegionRepository(db)
const regionCoverageRepo = createRegionCoverageRepository(db)
const cvssIngestionSvc = createCvssIngestionService(
  dataSourceRepo,
  regionRepo,
  cdrviewRecordRepo,
  regionCoverageRepo,
)

export const uploadController = new Elysia({ prefix: '/api/upload' })
  .use(authMiddleware())

  .post('/csv',
    async ({ request }): Promise<Result<{ message: string; filesProcessed: number }, AppError>> => {
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
          return Err(ErrorFactory.validation(
            'Nenhum ficheiro CSV encontrado.',
            [{ field: 'files', message: 'Envie pelo menos um CSV', rule: 'required' }],
            COMPONENT,
          ))
        }

        await cvssIngestionSvc.ingestUploadedFiles(uploaded)

        return Ok({
          message: `${uploaded.length} ficheiro(s) processado(s) com sucesso.`,
          filesProcessed: uploaded.length,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha no processamento do CSV.'
        return Err(ErrorFactory.validation(message, [], COMPONENT))
      }
    },
    {
      detail: {
        tags: ['upload'],
        summary: 'Upload de ficheiros CSV para ingestão',
      },
    },
  )