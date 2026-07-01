import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createProgramRepository } from '../../persistence/program.repository'
import { createProgramService } from '@/modules/programs/application/services/program.service'
import { authMiddleware } from '@/middlewares/auth.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import { programFiltersSchema, programIdSchema } from '../../../application/dtos/program.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { ProgramResponseDTO } from '../../../application/dtos/program.dto'
import type { ListResponse } from '../../../application/ports/program.port'

const programRepo = createProgramRepository(db)
const programSvc  = createProgramService(programRepo)

export const programController = new Elysia({ prefix: '/programs' })
  .use(authMiddleware())

  .get('/',
    async ({ query }): Promise<Result<ListResponse<ProgramResponseDTO[]>, AppError>> => {
      const v = validateWithZod(programFiltersSchema, query, 'ProgramController')
      if (!v.success) return v
      return programSvc.list(v.value)
    },
    {
      query: t.Object({
        regionId:     t.Optional(t.String()),
        category:     t.Optional(t.String()),
        state:        t.Optional(t.String()),
        municipality: t.Optional(t.String()),
        isActive:     t.Optional(t.Boolean()),
        page:         t.Optional(t.Number()),
        pageSize:     t.Optional(t.Number()),
      }),
      detail: { tags: ['programs'], summary: 'Listar programas' },
    }
  )

  .get('/:id',
    async ({ params }): Promise<Result<ProgramResponseDTO, AppError>> => {
      const v = validateWithZod(programIdSchema, params, 'ProgramController')
      if (!v.success) return v
      return programSvc.getById(v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['programs'], summary: 'Detalhe do programa' },
    }
  )
