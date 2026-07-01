import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createProgramRepository } from '../../persistence/program.repository'
import { createProgramService } from '@/modules/programs/application/services/program.service'
import { staffAuthMiddleware } from '@/middlewares/staff-auth.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import {
  createProgramSchema,
  updateProgramSchema,
  programIdSchema,
} from '../../../application/dtos/program.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { ProgramResponseDTO } from '../../../application/dtos/program.dto'

const programRepo = createProgramRepository(db)
const programSvc  = createProgramService(programRepo)

export const staffProgramController = new Elysia({ prefix: '/staff/programs' })
  .use(staffAuthMiddleware())

  .post('/',
    async ({ staffAuth, body }): Promise<Result<ProgramResponseDTO, AppError>> => {
      if (!staffAuth.success) return staffAuth
      const v = validateWithZod(createProgramSchema, body, 'StaffProgramController')
      if (!v.success) return v
      return programSvc.create(v.value, staffAuth.value.staffId)
    },
    {
      body: t.Object({
        regionId:     t.Optional(t.String()),
        name:         t.String(),
        description:  t.Optional(t.String()),
        category:     t.String(),
        organization: t.Optional(t.String()),
        municipality: t.Optional(t.String()),
        state:        t.Optional(t.String()),
        url:          t.Optional(t.String()),
        startsAt:     t.Optional(t.String()),
        endsAt:       t.Optional(t.String()),
      }),
      detail: { tags: ['staff-programs'], summary: 'Criar programa' },
    }
  )

  .get('/:id',
    async ({ staffAuth, params }): Promise<Result<ProgramResponseDTO, AppError>> => {
      if (!staffAuth.success) return staffAuth
      const v = validateWithZod(programIdSchema, params, 'StaffProgramController')
      if (!v.success) return v
      return programSvc.getById(v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['staff-programs'], summary: 'Obter programa por ID' },
    }
  )

  .patch('/:id',
    async ({ staffAuth, params, body }): Promise<Result<ProgramResponseDTO, AppError>> => {
      if (!staffAuth.success) return staffAuth
      const pv = validateWithZod(programIdSchema, params, 'StaffProgramController')
      if (!pv.success) return pv
      const bv = validateWithZod(updateProgramSchema, body, 'StaffProgramController')
      if (!bv.success) return bv
      return programSvc.update(pv.value.id, bv.value, staffAuth.value.staffId)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['staff-programs'], summary: 'Actualizar programa' },
    }
  )

  .delete('/:id',
    async ({ staffAuth, params }): Promise<Result<void, AppError>> => {
      if (!staffAuth.success) return staffAuth
      const v = validateWithZod(programIdSchema, params, 'StaffProgramController')
      if (!v.success) return v
      return programSvc.delete(v.value.id, staffAuth.value.staffId)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['staff-programs'], summary: 'Remover programa (soft delete)' },
    }
  )
