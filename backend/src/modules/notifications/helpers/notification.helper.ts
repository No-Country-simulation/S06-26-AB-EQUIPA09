import type { INotificationService } from '../application/ports/notification.port'
import type { IUserRepository } from '@/modules/users/application/ports/user.port'
import { logger } from '@/shared/logger/logger'

const COMPONENT = 'NotificationHelpers'

export interface IModressNotificationHelpers {
  notifyUserRegistered(userId: string): Promise<void>
  notifyAccountUpdated(userId: string, changes: Record<string, unknown>): Promise<void>
  notifyAccountDeleted(userId: string): Promise<void>
}

// ─────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────

export const createModressNotificationHelpers = (
  notificationService: INotificationService,
  userRepository:      IUserRepository,
): IModressNotificationHelpers => {

  const safe = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (err) {
      logger.error({ name, err }, `${COMPONENT}: notification failed silently`)
    }
  }

  const getUserEmail = async (userId: string) => {
    const user = await userRepository.findById(userId)
    return user ? { email: user.email, name: user.name } : null
  }

  return {
    async notifyUserRegistered(userId) {
      await safe('notifyUserRegistered', async () => {
        const user = await getUserEmail(userId)
        if (!user) return

        await notificationService.createInApp(
          userId,
          'user.registered',
          'Bem-vindo',
          `A tua conta foi criada com sucesso, ${user.name}.`,
          {},
          '/dashboard',
        )
      })
    },

    async notifyAccountUpdated(userId, changes) {
      await safe('notifyAccountUpdated', async () => {
        await notificationService.createInApp(
          userId,
          'account.updated',
          'Perfil actualizado',
          'Os dados da tua conta foram actualizados.',
          { changes },
          '/profile',
        )
      })
    },

    async notifyAccountDeleted(userId) {
      await safe('notifyAccountDeleted', async () => {
        await notificationService.createInApp(
          userId,
          'account.deleted',
          'Conta eliminada',
          'A tua conta foi eliminada.',
          {},
          '/',
        )
      })
    },
  }
}