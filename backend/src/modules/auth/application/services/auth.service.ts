import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { IUserRepository } from '@/modules/users/application/ports/user.port'
import type { ISessionService } from './session.service'
import type { RegisterDTO, LoginDTO, AuthResponseDTO } from '../dtos/auth.dto'
import { toPublicUser } from '@/modules/users/application/dtos/user.dto'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { hashPassword, comparePassword } from '@/shared/auth/auth'
import { getEncryption } from '@/shared/crypto/encryption.service'
import { auditHelpers } from '@/modules/activity/events/audit.listener'
import { logger } from '@/shared/logger/logger'
import { withTransaction } from '@/db/transaction'
import {
  emitUserRegistered,
  emitUserLogin,
} from '@/modules/users/events/user.events'

const COMPONENT = 'AuthService'

// ─────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────

export interface IAuthService {
  register(
    data:       RegisterDTO,
    userAgent?: string,
    ipAddress?: string
  ): Promise<Result<AuthResponseDTO, AppError>>

  login(
    data:       LoginDTO,
    userAgent?: string,
    ipAddress?: string
  ): Promise<Result<AuthResponseDTO, AppError>>

  refreshToken(
    refreshToken: string
  ): Promise<Result<{ accessToken: string; refreshToken: string }, AppError>>

  revokeSession(token: string): Promise<Result<void, AppError>>
}

export const createAuthService = (
  userRepository: IUserRepository,
  sessionService: ISessionService,
): IAuthService => {
  const encryption = getEncryption()

  return {
    async register(data, userAgent, ipAddress) {
      const emailHash = encryption.hash(data.email)

      const existing = await userRepository.findByEmailHash(emailHash)
      if (existing) {
        return Err(ErrorFactory.conflict('Email já registado', 'email', data.email, COMPONENT))
      }

      const passwordHash = await hashPassword(data.password)

      const user = await withTransaction(async (tx) => {
        return userRepository.create({
          email: data.email,
          emailHash,
          passwordHash,
          name: data.name,
        }, tx)
      })

      const sessionResult = await sessionService.createSession(user.id, userAgent, ipAddress)
      if (!sessionResult.success) return sessionResult

      Promise.allSettled([
        emitUserRegistered(user.id, 'email'),
        auditHelpers.create(user.id, 'User', user.id, { action: 'REGISTER' }),
      ]).catch(err => logger.error(err, 'Background tasks failed on register'))

      return Ok({
        accessToken:  sessionResult.value.accessToken,
        refreshToken: sessionResult.value.refreshToken,
        user: toPublicUser(user),
      })
    },

    async login(data, userAgent, ipAddress) {
      const emailHash = encryption.hash(data.email)
      const found     = await userRepository.findByEmailHash(emailHash)

      if (!found || !found.passwordHash) {
        return Err(ErrorFactory.unauthorized('Credenciais inválidas', 'invalid_credentials', COMPONENT))
      }

      const valid = await comparePassword(data.password, found.passwordHash)
      if (!valid) {
        return Err(ErrorFactory.unauthorized('Credenciais inválidas', 'invalid_credentials', COMPONENT))
      }

      const sessionResult = await sessionService.createSession(found.id, userAgent, ipAddress)
      if (!sessionResult.success) return sessionResult

      Promise.allSettled([
        emitUserLogin(found.id, 'email', ipAddress),
        auditHelpers.create(found.id, 'User', found.id, { action: 'LOGIN', ipAddress }),
      ]).catch(err => logger.error(err, 'Background tasks failed on login'))

      return Ok({
        accessToken:  sessionResult.value.accessToken,
        refreshToken: sessionResult.value.refreshToken,
        user:         toPublicUser(found),
      })
    },

    async refreshToken(refreshToken) {
      return sessionService.refreshSession(refreshToken)
    },

    async revokeSession(token) {
      return sessionService.revokeSession(token)
    },
  }
}
