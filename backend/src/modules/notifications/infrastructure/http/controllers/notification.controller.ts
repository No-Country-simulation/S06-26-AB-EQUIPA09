import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createNotificationRepository } from '../../persistence/notification.repository'
import { createNotificationService } from '@/modules/notifications/application/services/notification.service'
import { validateWithZod } from '@/shared/result/zod-integration'
import { authMiddleware, requireUser } from '@/middlewares/auth.middleware'
import { rateLimitMiddleware, RateLimitPresets } from '@/middlewares/rate-limit.middleware'
import { emailService } from '@/shared/email'
import { createUserRepository } from '@/modules/users/infrastructure/persistence/user.repository'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { ListResponse } from '@/shared/types/query.types'
import {
  listNotificationsQuerySchema,
  type NotificationCountDTO,
  type NotificationResponseDTO,
} from '@/modules/notifications/application/dtos/notification.dto'
import { userIdSchema } from '@/modules/users/application/dtos/user.dto'


const notificationRepo = createNotificationRepository(db)
const userRepo         = createUserRepository(db)

const getUserEmailInfo = async (userId: string) => {
  const user = await userRepo.findById(userId)
  if (!user) return null
  return { email: user.email, name: user.name }
}

const notificationSvc = createNotificationService(
  notificationRepo,
  emailService,
  getUserEmailInfo
)

// ─────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────

export const notificationController = new Elysia({ prefix: '/notifications' })
  .use(authMiddleware())
  .use(rateLimitMiddleware(RateLimitPresets.API))

  // GET /notifications
  .get('/',
    async ({ user, query }): Promise<Result<ListResponse<NotificationResponseDTO>, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx

      const v = validateWithZod(listNotificationsQuerySchema, query, 'NotificationController')
      if (!v.success) return v

      return notificationSvc.list(userCtx.value.userId, v.value.page, v.value.perPage, {
        isRead:   v.value.isRead,
        priority: v.value.priority,
      })
    },
    {
      query: t.Object({
        page:     t.Optional(t.Numeric()),
        perPage:  t.Optional(t.Numeric()),
        isRead:   t.Optional(t.Boolean()),
        priority: t.Optional(t.String()),
      }),
      detail: { tags: ['notifications'], summary: 'Listar notificações' },
    }
  )

  // GET /notifications/unread-count
  .get('/unread-count',
    async ({ user }): Promise<Result<NotificationCountDTO, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx
      return notificationSvc.getUnreadCount(userCtx.value.userId)
    },
    { detail: { tags: ['notifications'], summary: 'Contagem de não lidas' } }
  )

  // GET /notifications/:id
  .get('/:id',
    async ({ user, params }): Promise<Result<NotificationResponseDTO, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx

      const v = validateWithZod(userIdSchema, params, 'NotificationController')
      if (!v.success) return v

      return notificationSvc.getById(userCtx.value.userId, v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['notifications'], summary: 'Detalhe da notificação' },
    }
  )

  // PATCH /notifications/read-all
  .patch('/read-all',
    async ({ user }): Promise<Result<{ message: string }, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx

      const result = await notificationSvc.markAllAsRead(userCtx.value.userId)
      if (!result.success) return result

      return { success: true, value: { message: 'Todas as notificações marcadas como lidas' } }
    },
    { detail: { tags: ['notifications'], summary: 'Marcar todas como lidas' } }
  )

  // PATCH /notifications/:id/read
  .patch('/:id/read',
    async ({ user, params }): Promise<Result<NotificationResponseDTO, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx

      const v = validateWithZod(userIdSchema, params, 'NotificationController')
      if (!v.success) return v

      return notificationSvc.markAsRead(userCtx.value.userId, v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['notifications'], summary: 'Marcar notificação como lida' },
    }
  )

  // DELETE /notifications/:id
  .delete('/:id',
    async ({ user, params }): Promise<Result<void, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx

      const v = validateWithZod(userIdSchema, params, 'NotificationController')
      if (!v.success) return v

      return notificationSvc.delete(userCtx.value.userId, v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['notifications'], summary: 'Eliminar notificação (soft delete)' },
    }
  )
