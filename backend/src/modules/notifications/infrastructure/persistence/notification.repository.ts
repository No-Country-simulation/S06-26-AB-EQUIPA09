import { eq, and, count, desc, isNull } from 'drizzle-orm'
import type { Database } from '@/db'
import { notifications } from '@/db/schema'
import type { INotificationRepository } from '../../application/ports/notification.port'
import { encryptFields, decryptFields, createCryptoConfig } from '@/shared/crypto/crypto-fields'
import { dbExec } from '@/db/db-exec'

const CRYPTO_CONFIG = createCryptoConfig(['title', 'message'])

export const createNotificationRepository = (db: Database): INotificationRepository => ({
  async create(data) {
    return dbExec('create', 'NotificationRepository', async () => {
      return await db.transaction(async (tx) => {
        const encryptedData = encryptFields(data, CRYPTO_CONFIG)

        const [notification] = await tx
          .insert(notifications)
          .values({
            recipientId: data.userId,
            type: data.type,
            priority: data.priority,
            title: encryptedData.title as string,
            message: encryptedData.message as string | null,
            actionUrl: data.actionUrl || null,
            data: data.data || null,
            relatedType: data.relatedType || null,
            relatedId: data.relatedId || null,
          })
          .returning()

        const decrypted = decryptFields(notification, CRYPTO_CONFIG)

        return {
          id: decrypted.id as string,
          userId: notification.recipientId,
          type: notification.type,
          priority: notification.priority,
          title: decrypted.title as string,
          message: decrypted.message as string | null,
          actionUrl: notification.actionUrl,
          data: notification.data as Record<string, unknown> | null,
          relatedType: notification.relatedType,
          relatedId: notification.relatedId,
          isRead: notification.isRead || false,
          readAt: notification.readAt as Date | null,
          createdAt: notification.createdAt as Date,
        }
      })
    })
  },

  async findById(id, recipientId) {
    return dbExec('findById', 'NotificationRepository', async () => {
      let [notification] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.recipientId, recipientId),
            isNull(notifications.deletedAt)
          )
        )
        .limit(1)

      if (!notification) {
        [notification] = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.relatedId, id),
              eq(notifications.recipientId, recipientId),
              isNull(notifications.deletedAt)
            )
          )
          .limit(1)
      }

      if (!notification) return null

      const decrypted = decryptFields(notification, CRYPTO_CONFIG)

      return {
        id: decrypted.id as string,
        userId: notification.recipientId,
        type: notification.type,
        priority: notification.priority,
        title: decrypted.title as string,
        message: decrypted.message as string | null,
        actionUrl: notification.actionUrl,
        data: notification.data as Record<string, unknown> | null,
        relatedType: notification.relatedType,
        relatedId: notification.relatedId,
        isRead: notification.isRead || false,
        readAt: notification.readAt as Date | null,
        createdAt: notification.createdAt as Date,
      }
    })
  },

  async list(userId, page, perPage, filters) {
    return dbExec('list', 'NotificationRepository', async () => {
      const offset = (page - 1) * perPage
      const conditions = [eq(notifications.recipientId, userId), isNull(notifications.deletedAt)]

      if (filters?.isRead !== undefined) {
        conditions.push(eq(notifications.isRead, filters.isRead))
      }
      if (filters?.priority) {
        conditions.push(eq(notifications.priority, filters.priority))
      }

      const whereClause = and(...conditions)

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(notifications)
          .where(whereClause)
          .orderBy(desc(notifications.createdAt))
          .limit(perPage)
          .offset(offset),
        db.select({ count: count() }).from(notifications).where(whereClause),
      ])

      const mappedData = data.map((notification) => {
        const decrypted = decryptFields(notification, CRYPTO_CONFIG)
        return {
          id: decrypted.id as string,
          userId: notification.recipientId,
          type: notification.type,
          priority: notification.priority,
          title: decrypted.title as string,
          message: decrypted.message as string | null,
          actionUrl: notification.actionUrl,
          data: notification.data as Record<string, unknown> | null,
          relatedType: notification.relatedType,
          relatedId: notification.relatedId,
          isRead: notification.isRead || false,
          readAt: notification.readAt as Date | null,
          createdAt: notification.createdAt as Date,
        }
      })

      return {
        data: mappedData,
        pagination: {
          currentPage: page,
          perPage,
          totalItems: totalResult[0].count,
          totalPages: Math.ceil(totalResult[0].count / perPage),
        },
      }
    })
  },

  async update(id, data) {
    return dbExec('update', 'NotificationRepository', async () => {
      const updateData: { isRead?: boolean; readAt?: Date | null } = {}
      if (data.isRead !== undefined) {
        updateData.isRead = data.isRead
        updateData.readAt = data.isRead ? new Date() : null
      }

      const [notification] = await db
        .update(notifications)
        .set(updateData)
        .where(eq(notifications.id, id))
        .returning()

      const decrypted = decryptFields(notification, CRYPTO_CONFIG)
      return {
        id: decrypted.id as string,
        userId: notification.recipientId,
        type: notification.type,
        priority: notification.priority,
        title: decrypted.title as string,
        message: decrypted.message as string | null,
        actionUrl: notification.actionUrl,
        data: notification.data as Record<string, unknown> | null,
        relatedType: notification.relatedType,
        relatedId: notification.relatedId,
        isRead: notification.isRead || false,
        readAt: notification.readAt as Date | null,
        createdAt: notification.createdAt as Date,
      }
    })
  },

  async markAllAsRead(userId) {
    return dbExec('markAllAsRead', 'NotificationRepository', async () => {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(notifications.recipientId, userId),
            eq(notifications.isRead, false),
            isNull(notifications.deletedAt)
          )
        )
    })
  },

  async softDelete(id) {
    return dbExec('softDelete', 'NotificationRepository', async () => {
      await db.update(notifications).set({ deletedAt: new Date() }).where(eq(notifications.id, id))
    })
  },

  async getUnreadCount(userId) {
    return dbExec('getUnreadCount', 'NotificationRepository', async () => {
      const [totalCount, unreadCount] = await Promise.all([
        db
          .select({ count: count() })
          .from(notifications)
          .where(and(eq(notifications.recipientId, userId), isNull(notifications.deletedAt))),
        db
          .select({ count: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.recipientId, userId),
              eq(notifications.isRead, false),
              isNull(notifications.deletedAt)
            )
          ),
      ])

      return {
        total: totalCount[0].count,
        unread: unreadCount[0].count,
      }
    })
  },
})
