import { Elysia } from 'elysia'
import { db } from '@/db'
import { createUserRepository } from '../../persistence/user.repository'
import { createUserService } from '@/modules/users/application/services/user.service'
import { createSessionRepository } from '@/modules/auth/infrastructure/persistence/session.repository'
import { createSessionService } from '@/modules/auth/application/services/session.service'
import { authMiddleware, requireUser } from '@/middlewares/auth.middleware'
import { rateLimitMiddleware, RateLimitPresets } from '@/middlewares/rate-limit.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import { updateProfileSchema } from '../../../application/dtos/user.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { UserResponseDTO } from '../../../application/dtos/user.dto'

const userRepo    = createUserRepository(db)
const sessionRepo = createSessionRepository(db)
const sessionSvc  = createSessionService(sessionRepo)
const userSvc     = createUserService(userRepo, sessionSvc)

export const usersController = new Elysia({ prefix: '/users' })
  .use(authMiddleware())
  .use(rateLimitMiddleware(RateLimitPresets.API))

  // GET /users/me
  .get('/me',
    async ({ user }): Promise<Result<UserResponseDTO, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx
      return userSvc.getById(userCtx.value.userId)
    },
    { detail: { tags: ['users'], summary: 'Perfil do utilizador autenticado' } }
  )

  // PATCH /users/me
  .patch('/me',
    async ({ user, body }): Promise<Result<UserResponseDTO, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx

      const v = validateWithZod(updateProfileSchema, body, 'UsersController')
      if (!v.success) return v

      return userSvc.updateProfile(userCtx.value.userId, v.value)
    },
    {
      detail: { tags: ['users'], summary: 'Actualizar perfil' },
    }
  )

  // DELETE /users/me
  .delete('/me',
    async ({ user }): Promise<Result<{ message: string }, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx
      const result = await userSvc.deleteAccount(userCtx.value.userId)
      if (!result.success) return result
      return { success: true, value: { message: 'Conta eliminada' } }
    },
    { detail: { tags: ['users'], summary: 'Eliminar conta (soft delete)' } }
  )
