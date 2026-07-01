import type { IProgramRepository, IProgramService } from '../ports/program.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { auditHelpers } from '@/modules/activity/application/services/audit-logger'
import { logger } from '@/shared/logger/logger'

const COMPONENT = 'ProgramService'

export const createProgramService = (
  repository: IProgramRepository,
): IProgramService => {
  return {
    async create(data, staffId) {
      const program = await repository.create(data)
      const changes: Record<string, unknown> = {
        category: data.category,
        regionId: data.regionId,
        name:     data.name,
      }

      Promise.allSettled([
        auditHelpers.staffCreate(staffId, 'Program', program.id, {
          action: 'PROGRAM_CREATED',
          ...changes,
          createdBy: staffId,
        }),
      ]).catch(err => logger.error(err, 'Background tasks failed on program create'))

      return Ok(program)
    },

    async update(programId, data, staffId) {
      const program = await repository.findById(programId)
      if (!program) {
        return Err(ErrorFactory.notFound('Programa não encontrado', 'Program', programId, COMPONENT))
      }

      const updated = await repository.update(programId, data)

      const changes: Record<string, unknown> = {}
      if (data.name     !== undefined) changes.name     = true
      if (data.category !== undefined) changes.category = data.category
      if (data.isActive !== undefined) changes.isActive = data.isActive

      Promise.allSettled([
        auditHelpers.staffUpdate(staffId, 'Program', programId, {
          action: 'PROGRAM_UPDATED',
          fields: Object.keys(changes),
        }),
      ]).catch(err => logger.error(err, 'Background tasks failed on program update'))

      return Ok(updated)
    },

    async delete(programId, staffId) {
      const program = await repository.findById(programId)
      if (!program) {
        return Err(ErrorFactory.notFound('Programa não encontrado', 'Program', programId, COMPONENT))
      }

      await repository.softDelete(programId)

      Promise.allSettled([
        auditHelpers.staffDelete(staffId, 'Program', programId, {
          action: 'PROGRAM_DELETED',
        }),
      ]).catch(err => logger.error(err, 'Background tasks failed on program delete'))

      return Ok(undefined)
    },

    async list(filters) {
      const result = await repository.findAll(filters)
      return Ok(result)
    },

    async getByRegion(regionId, filters) {
      const programs = await repository.findByRegion(regionId, filters)
      return Ok(programs)
    },

    async getById(programId) {
      const program = await repository.findById(programId)
      if (!program) {
        return Err(ErrorFactory.notFound('Programa não encontrado', 'Program', programId, COMPONENT))
      }
      return Ok(program)
    },
  }
}
