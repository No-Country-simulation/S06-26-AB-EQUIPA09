import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { ISessionRepository } from '../ports/session.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { verifyToken, type TokenPayload } from '@/shared/auth/auth'
import { sign } from 'jsonwebtoken'
import { env } from '@/config/env'

const JWT_SECRET = env.JWT_SECRET

const COMPONENT   = 'SessionService'
const ACCESS_TTL  = 2 * 24 * 3600  // 2 dias
const REFRESH_TTL = 7 * 24 * 3600  // 7 dias

export interface ISessionService {
  createSession(
    userId:     string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<Result<{ accessToken: string; refreshToken: string }, AppError>>

  refreshSession(
    refreshToken: string
  ): Promise<Result<{ accessToken: string; refreshToken: string }, AppError>>

  revokeSession(token: string):        Promise<Result<void, AppError>>
  revokeAllUserSessions(userId: string): Promise<void>
}

let tokenCounter = 0

const uniqueToken = (payload: TokenPayload, ttl: number): string => {
  const jti = `${Date.now()}-${process.pid}-${++tokenCounter}`
  return sign({ ...payload, jti } as object, JWT_SECRET, { expiresIn: ttl })
}

export const createSessionService = (
  repository: ISessionRepository,
): ISessionService => ({
  async createSession(userId, userAgent, ipAddress) {
    const accessToken  = uniqueToken({ userId, type: 'user' },         ACCESS_TTL)
    const refreshToken = uniqueToken({ userId, type: 'user_refresh' }, REFRESH_TTL)

    await repository.create({
      userId,
      token:        accessToken,
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt: new Date(Date.now() + ACCESS_TTL * 1000),
    })

    return Ok({ accessToken, refreshToken })
  },

  async refreshSession(refreshToken) {
    // 1. Verificar JWT
    const payload = verifyToken(refreshToken)
    if (!payload || payload.type !== 'user_refresh') {
      return Err(
        ErrorFactory.unauthorized('Refresh token inválido ou expirado', 'invalid_token', COMPONENT)
      )
    }

    // 2. Confirmar sessão activa na DB
    const session = await repository.findByRefreshToken(refreshToken)
    if (!session || !session.isActive) {
      return Err(
        ErrorFactory.unauthorized('Sessão inválida ou revogada', 'expired_token', COMPONENT)
      )
    }

    // 3. Rotation — revogar sessão anterior
    await repository.revoke(session.id)

    // 4. Nova sessão
    const { userId } = payload
    const newAccess  = uniqueToken({ userId, type: 'user' },         ACCESS_TTL)
    const newRefresh = uniqueToken({ userId, type: 'user_refresh' }, REFRESH_TTL)

    await repository.create({
      userId,
      token:        newAccess,
      refreshToken: newRefresh,
      expiresAt:    new Date(Date.now() + ACCESS_TTL * 1000),
    })

    return Ok({ accessToken: newAccess, refreshToken: newRefresh })
  },

  async revokeSession(token) {
    const session = await repository.findByToken(token)
    if (!session) return Ok(undefined) 
    await repository.revoke(session.id)
    return Ok(undefined)
  },

  async revokeAllUserSessions(userId) {
    await repository.revokeAllByUser(userId)
  },
})