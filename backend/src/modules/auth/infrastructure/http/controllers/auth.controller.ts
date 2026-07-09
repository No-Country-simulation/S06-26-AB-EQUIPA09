import { Context, Elysia, t } from 'elysia'
import { db } from '@/db'
import { createUserRepository } from '@/modules/users/infrastructure/persistence/user.repository'
import { createSessionRepository } from '../../persistence/session.repository'
import { createSessionService } from '@/modules/auth/application/services/session.service'
import { createAuthService } from '@/modules/auth/application/services/auth.service'
import { rateLimitMiddleware, RateLimitPresets } from '@/middlewares/rate-limit.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '../../../application/dtos/auth.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { AuthResponseDTO } from '../../../application/dtos/auth.dto'

// ─────────────────────────────────────────────
// Instâncias
// ─────────────────────────────────────────────

const userRepo    = createUserRepository(db)
const sessionRepo = createSessionRepository(db)
const sessionSvc  = createSessionService(sessionRepo)
const authSvc     = createAuthService(userRepo, sessionSvc)

// ─────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────


const setAuthCookie = (ctx: Context, token: string) => {
  const isProduction = process.env.NODE_ENV === 'production'

  ctx.cookie.auth_token.set({
    value:    token,
    httpOnly: true,
    secure:   isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge:   2 * 24 * 3600,
    path:     '/',
  })
}
 
const removeAuthCookie = (ctx: Context) => {
  const isProduction = process.env.NODE_ENV === 'production'

  ctx.cookie.auth_token.set({
    value:    '',
    httpOnly: true,
    secure:   isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge:   0,
    path:     '/',
  })
}
 

// ─────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────

export const authController = new Elysia({ prefix: '/auth' })
  .use(rateLimitMiddleware(RateLimitPresets.AUTH))

  // POST /auth/register
  .post(
  '/register',
  async (
    ctx
  ): Promise<
    Result<
      {
        user: AuthResponseDTO['user']
        accessToken: string
        refreshToken: string
      },
      AppError
    >
  > => {
    const v = validateWithZod(registerSchema, ctx.body, 'AuthController')
    if (!v.success) return v

    const userAgent = ctx.request.headers.get('user-agent') ?? undefined
    const ipAddress = ctx.request.headers.get('x-forwarded-for') ?? undefined

    const result = await authSvc.register(v.value, userAgent, ipAddress)
    if (!result.success) return result

    setAuthCookie(ctx, result.value.accessToken)

    return {
      success: true,
      value: {
        user: result.value.user,
        accessToken: result.value.accessToken,
        refreshToken: result.value.refreshToken,
      },
    }
  },
  {
    body: t.Object({
      email: t.String(),
      password: t.String(),
      name: t.String(),
    }),
    detail: {
      tags: ['auth'],
      summary: 'Registar utilizador',
    },
  }
)
  // POST /auth/login
  .post(
  '/login',
  async (
    ctx
  ): Promise<
    Result<
      {
        user: AuthResponseDTO['user']
        accessToken: string
        refreshToken: string
      },
      AppError
    >
  > => {
    const v = validateWithZod(loginSchema, ctx.body, 'AuthController')
    if (!v.success) return v

    const ipAddress = ctx.request.headers.get('x-forwarded-for') ?? undefined
    const { recordAuthFailure } = await import('@/middlewares/rate-limit.middleware')

    const userAgent = ctx.request.headers.get('user-agent') ?? undefined
    const result = await authSvc.login(v.value, userAgent, ipAddress)

    if (!result.success) {
      if (ipAddress) {
        await recordAuthFailure(v.value.email, ipAddress).catch(() => {})
      }
      return result
    }

    setAuthCookie(ctx, result.value.accessToken)

    return {
      success: true,
      value: {
        user: result.value.user,
        accessToken: result.value.accessToken,
        refreshToken: result.value.refreshToken,
      },
    }
  },
  {
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
    detail: {
      tags: ['auth'],
      summary: 'Login',
    },
  }
)

  // POST /auth/refresh
  .post('/refresh',
    async (ctx): Promise<Result<{ refreshToken: string }, AppError>> => {
      const v = validateWithZod(refreshTokenSchema, ctx.body, 'AuthController')
      if (!v.success) return v

      const result = await authSvc.refreshToken(v.value.refreshToken)
      if (!result.success) return result

      setAuthCookie(ctx, result.value.accessToken)
      return { success: true, value: { refreshToken: result.value.refreshToken } }
    },
    {
      body: t.Object({ refreshToken: t.String() }),
      detail: { tags: ['auth'], summary: 'Renovar tokens' },
    }
  )

  // POST /auth/logout
  .post('/logout',
    async (ctx): Promise<Result<{ message: string }, AppError>> => {
      removeAuthCookie(ctx)
      const token = ctx.request.headers.get('authorization')?.replace('Bearer ', '')
      if (token) await authSvc.revokeSession(token)
      return { success: true, value: { message: 'Sessão terminada' } }
    },
    { detail: { tags: ['auth'], summary: 'Logout' } }
  )

  // GET /auth/ws-token
  .get('/ws-token',
    async (ctx): Promise<Result<{ token: string }, AppError>> => {
      const cookieVal = ctx.cookie['auth_token']
      const rawToken = typeof cookieVal === 'object' && cookieVal && 'value' in cookieVal 
        ? String(cookieVal.value) 
        : String(cookieVal ?? '')
      
      if (!rawToken) {
        return {
          success: false,
          error: {
            type: 'UNAUTHORIZED',
            statusCode: 401,
            message: 'Não autenticado',
            reason: 'missing_token',
            component: 'AuthController',
            timestamp: new Date().toISOString(),
          },
        }
      }

      const { verifyToken, signToken } = await import('@/shared/auth/auth')
      const payload = verifyToken(rawToken)
      if (!payload || payload.type !== 'user') {
        return {
          success: false,
          error: {
            type: 'UNAUTHORIZED',
            statusCode: 401,
            message: 'Token inválido',
            reason: 'invalid_token',
            component: 'AuthController',
            timestamp: new Date().toISOString(),
          },
        }
      }

      const wsToken = signToken({ userId: payload.userId, type: 'user' }, 5 * 60)
      return { success: true, value: { token: wsToken } }
    },
    { detail: { tags: ['auth'], summary: 'Gerar token para WebSocket' } }
  )


