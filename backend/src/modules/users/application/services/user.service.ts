import type { IUserRepository, IUserService } from '../ports/user.port'
import type { ISessionService } from '@/modules/auth/application/services/session.service'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { auditHelpers } from '@/modules/activity/application/services/audit-logger'
import { logger } from '@/shared/logger/logger'

const COMPONENT = 'UserService'

export const createUserService = (
  repository:     IUserRepository,
  sessionService: ISessionService,
): IUserService => {
  return {
    async getById(userId) {
      const user = await repository.findById(userId)
      if (!user) {
        return Err(ErrorFactory.notFound('Utilizador não encontrado', 'User', userId, COMPONENT))
      }
      return Ok(user)
    },

    async updateProfile(userId, data) {
      const user = await repository.findById(userId)
      if (!user) {
        return Err(ErrorFactory.notFound('Utilizador não encontrado', 'User', userId, COMPONENT))
      }

      const updated = await repository.update(userId, data)

      // Registar apenas campos alterados no audit/event
      const changes: Record<string, unknown> = {}
      if (data.name     !== undefined) changes.name     = true
      if (data.phone    !== undefined) changes.phone    = true
      if (data.locale   !== undefined) changes.locale   = data.locale
      if (data.timezone !== undefined) changes.timezone = data.timezone
      if (data.avatar   !== undefined) changes.avatar   = true

      Promise.allSettled([
        auditHelpers.update(userId, 'User', userId, { fields: Object.keys(changes) }),
      ]).catch(err => logger.error(err, 'Background tasks failed on updateProfile'))

      return Ok(updated)
    },

    async deleteAccount(userId) {
      const user = await repository.findById(userId)
      if (!user) {
        return Err(ErrorFactory.notFound('Utilizador não encontrado', 'User', userId, COMPONENT))
      }

      await repository.softDelete(userId)

      // Revogar todas as sessões activas do utilizador
      Promise.allSettled([
        auditHelpers.delete(userId, 'User', userId),
        sessionService.revokeAllUserSessions(userId),
      ]).catch(err => logger.error(err, 'Background tasks failed on deleteAccount'))

      return Ok(undefined)
    },
  }
}