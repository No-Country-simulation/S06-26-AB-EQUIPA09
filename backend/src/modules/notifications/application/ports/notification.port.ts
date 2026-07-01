import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type {
  CreateNotificationDTO,
  NotificationResponseDTO,
  NotificationCountDTO,
} from '../dtos/notification.dto'
import type { ListResponse } from '@/shared/types/query.types'

export interface INotificationRepository {
  create(data: CreateNotificationDTO & { userId: string }): Promise<NotificationResponseDTO>
  findById(id: string, recipientId: string): Promise<NotificationResponseDTO | null>
  list(
    userId: string,
    page: number,
    perPage: number,
    filters?: { isRead?: boolean; priority?: string }
  ): Promise<ListResponse<NotificationResponseDTO>>
  update(id: string, data: Partial<NotificationResponseDTO>): Promise<NotificationResponseDTO>
  markAllAsRead(userId: string): Promise<void>
  softDelete(id: string): Promise<void>
  getUnreadCount(userId: string): Promise<NotificationCountDTO>
}

export interface INotificationService {
  createInApp(
    userId: string,
    type: string,
    title: string,
    message?: string | null,
    data?: Record<string, unknown> | null,
    actionUrl?: string | null
  ): Promise<void>
  sendEmail(
    to: string,
    template: string,
    data?: Record<string, unknown> | null,
    subject?: string
  ): Promise<void>
  create(
    userId: string,
    data: CreateNotificationDTO
  ): Promise<Result<NotificationResponseDTO, AppError>>
  getById(
    userId: string,
    notificationId: string
  ): Promise<Result<NotificationResponseDTO, AppError>>
  list(
    userId: string,
    page: number,
    perPage: number,
    filters?: { isRead?: boolean; priority?: string }
  ): Promise<Result<ListResponse<NotificationResponseDTO>, AppError>>
  markAsRead(
    userId: string,
    notificationId: string
  ): Promise<Result<NotificationResponseDTO, AppError>>
  markAllAsRead(userId: string): Promise<Result<void, AppError>>
  delete(userId: string, notificationId: string): Promise<Result<void, AppError>>
  getUnreadCount(userId: string): Promise<Result<NotificationCountDTO, AppError>>
}
