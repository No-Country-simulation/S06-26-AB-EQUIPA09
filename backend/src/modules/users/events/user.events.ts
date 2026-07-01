import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'
import { processEventForAudit } from '@/modules/activity/events/audit.listener'

// ─────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────

export type UserRegisteredPayload = {
  userId:     string
  method:     'email' | 'google'
  registeredAt: Date
}

export type UserLoginPayload = {
  userId:    string
  method:    'email' | 'google'
  ipAddress?: string
  loggedInAt: Date
}

export type UserProfileUpdatedPayload = {
  userId:    string
  changes:   Record<string, unknown>
  updatedAt: Date
}

export type UserDeletedPayload = {
  userId:    string
  deletedAt: Date
}

export type UserEventPayload =
  | UserRegisteredPayload
  | UserLoginPayload
  | UserProfileUpdatedPayload
  | UserDeletedPayload

// ─────────────────────────────────────────────
// Event names
// ─────────────────────────────────────────────

export const UserEventNames = {
  USER_REGISTERED:       'user.registered',
  USER_LOGIN:            'user.login',
  USER_PROFILE_UPDATED:  'user.profile_updated',
  USER_DELETED:          'user.deleted',
} as const

// ─────────────────────────────────────────────
// Queue
// ─────────────────────────────────────────────

const processUserEvent = async (job: Job<UserEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'User event processed')
  await processEventForAudit(job.name, job.data)
}

export const userEventsQueue = new QueueManager<UserEventPayload>({
  name:      'user-events',
  processor: processUserEvent,
})

// ─────────────────────────────────────────────
// Emitters
// ─────────────────────────────────────────────

export const emitUserRegistered = (
  userId: string,
  method: 'email' | 'google',
) =>
  userEventsQueue.addJob(UserEventNames.USER_REGISTERED, {
    userId, method, registeredAt: new Date(),
  })

export const emitUserLogin = (
  userId:    string,
  method:    'email' | 'google',
  ipAddress?: string
) =>
  userEventsQueue.addJob(UserEventNames.USER_LOGIN, {
    userId, method, ipAddress, loggedInAt: new Date(),
  })

export const emitUserProfileUpdated = (
  userId:  string,
  changes: Record<string, unknown>
) =>
  userEventsQueue.addJob(UserEventNames.USER_PROFILE_UPDATED, {
    userId, changes, updatedAt: new Date(),
  })

export const emitUserDeleted = (userId: string) =>
  userEventsQueue.addJob(UserEventNames.USER_DELETED, {
    userId, deletedAt: new Date(),
  })
