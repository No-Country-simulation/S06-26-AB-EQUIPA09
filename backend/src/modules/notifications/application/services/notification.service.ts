import type { INotificationRepository, INotificationService } from '../ports/notification.port'
import type { IEmailService } from '@/shared/email'
import type {
  CreateNotificationDTO,
  NotificationResponseDTO,
  NotificationCountDTO,
} from '../dtos/notification.dto'
import type { ListResponse } from '@/shared/types/query.types'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import { auditHelpers } from '@/modules/activity/application/services/audit-logger'
import { broadcastToUser } from '@/ws/ws.controller'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { getNotificationTemplate } from '../../config/notification-templates.config'
import { getTemplate } from '@/shared/email/templates'
import { logger } from '@/shared/logger/logger'

const COMPONENT = 'EnhancedNotificationService'

const humanizeTemplateName = (template: string) =>
  template
    .replace(/[_.-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

interface UserEmailInfo {
  email: string
  name: string
}

export const createNotificationService = (
  repository: INotificationRepository,
  emailService: IEmailService,
  getUserEmailInfo: (userId: string) => Promise<UserEmailInfo | null>
): INotificationService => {
  const service: INotificationService = {
    async createInApp(
      userId: string,
      type: string,
      title: string,
      message?: string | null,
      data?: Record<string, unknown> | null,
      actionUrl?: string | null
    ): Promise<void> {
      const template = getNotificationTemplate(type)
      const result = await service.create(userId, {
        type,
        title,
        message,
        data,
        actionUrl,
        priority: template.priority,
      })

      if (!result.success) {
        logger.error(
          { userId, type, error: result.error },
          `${COMPONENT}: Failed to create in-app notification`
        )
      }
    },

    async sendEmail(
      to: string,
      template: string,
      data?: Record<string, unknown> | null,
      subject?: string
    ): Promise<void> {
      const templateName = getTemplate(template) ? template : 'notification'
      const payload = templateName === template
        ? (data ?? {})
        : {
            title: subject ?? humanizeTemplateName(template),
            message: subject ?? `Notificacao ${humanizeTemplateName(template)}`,
            details: Object.entries(data ?? {}).map(([label, value]) => ({
              label,
              value: String(value ?? ''),
            })),
          }

      const result = await emailService.send({
        to,
        template: templateName,
        subject: subject ?? `Modress: ${template}`,
        data: payload,
      })

      if (!result.success) {
        logger.error(
          { to, template, templateName, error: result.error },
          `${COMPONENT}: Failed to send email`
        )
      }
    },

    async create(
      userId: string,
      data: CreateNotificationDTO
    ): Promise<Result<NotificationResponseDTO, AppError>> {
      const notification = await repository.create({ ...data, userId })

      const template = getNotificationTemplate(data.type)

      const shouldSendEmail = template.channels === 'email' || template.channels === 'both'

      if (shouldSendEmail && template.emailTemplate) {
        try {
          const userInfo = await getUserEmailInfo(userId)

          if (!userInfo) {
            logger.warn(
              { userId, notificationType: data.type },
              `${COMPONENT}: User not found, skipping email`
            )
          } else {
            emailService
              .send({
                to: userInfo.email,
                subject: data.title,
                template: template.emailTemplate,
                data: {
                  userName: userInfo.name,
                  userEmail: userInfo.email,
                  title: data.title,
                  message: data.message,
                  ...data.data,
                  actionUrl: data.actionUrl,
                  currentYear: new Date().getFullYear(),
                },
              })
              .then((result) => {
                if (!result.success) {
                  logger.error(
                    {
                      userId,
                      notificationId: notification.id,
                      error: result.error,
                    },
                    `${COMPONENT}: Failed to send notification email`
                  )
                } else {
                  logger.info(
                    {
                      userId,
                      notificationId: notification.id,
                      messageId: result.value.messageId,
                    },
                    `${COMPONENT}: Email sent successfully`
                  )
                }
              })
              .catch((error) => {
                logger.error(
                  { userId, notificationId: notification.id, error },
                  `${COMPONENT}: Unexpected error sending email`
                )
              })
          }
        } catch (error) {
          logger.error(
            { error, userId, notificationType: data.type },
            `${COMPONENT}: Error processing email for notification`
          )
        }
      }

      await Promise.all([
        auditHelpers.create(userId, 'Notification', notification.id, {
          type: notification.type,
          priority: notification.priority,
          emailSent: shouldSendEmail,
        }),
      ])

      // Broadcast notification via WebSocket
      broadcastToUser(userId, {
        type: 'notification',
        notification,
      })

      return Ok(notification)
    },

    async getById(
      userId: string,
      notificationId: string
    ): Promise<Result<NotificationResponseDTO, AppError>> {
      const notification = await repository.findById(notificationId, userId)

      if (!notification) {
        return Err(
          ErrorFactory.notFound(
            'Notificação não encontrada',
            'Notification',
            notificationId,
            COMPONENT
          )
        )
      }

      return Ok(notification)
    },

    async list(
      userId: string,
      page: number,
      perPage: number,
      filters?: { isRead?: boolean; priority?: string }
    ): Promise<Result<ListResponse<NotificationResponseDTO>, AppError>> {
      const result = await repository.list(userId, page, perPage, filters)
      return Ok(result)
    },

    async markAsRead(
      userId: string,
      notificationId: string
    ): Promise<Result<NotificationResponseDTO, AppError>> {
      const existing = await repository.findById(notificationId, userId)

      if (!existing) {
        return Ok({} as NotificationResponseDTO)
      }

      if (existing.isRead) {
        return Ok(existing)
      }

      const notification = await repository.update(notificationId, { isRead: true })

      await Promise.all([
        auditHelpers.update(userId, 'Notification', notificationId, { isRead: true }),
      ])

      return Ok(notification)
    },

    async markAllAsRead(userId: string): Promise<Result<void, AppError>> {
      await repository.markAllAsRead(userId)

      await auditHelpers.update(userId, 'Notification', 'bulk_action', { action: 'mark_all_read' })

      return Ok(undefined)
    },

    async delete(userId: string, notificationId: string): Promise<Result<void, AppError>> {
      const existing = await repository.findById(notificationId, userId)

      if (!existing) {
        return Err(
          ErrorFactory.notFound(
            'Notificação não encontrada',
            'Notification',
            notificationId,
            COMPONENT
          )
        )
      }

      await repository.softDelete(notificationId)

      await Promise.all([
        auditHelpers.delete(userId, 'Notification', notificationId),
      ])

      return Ok(undefined)
    },

    async getUnreadCount(userId: string): Promise<Result<NotificationCountDTO, AppError>> {
      const counts = await repository.getUnreadCount(userId)
      return Ok(counts)
    },
  }

  return service
}
