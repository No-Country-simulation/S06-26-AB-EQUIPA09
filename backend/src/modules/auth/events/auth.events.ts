import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'
import { processEventForAudit } from '@/modules/activity/events/audit.listener'

export type SessionCreatedPayload   = { userId: string; sessionId: string; method: 'email' | 'google'; ipAddress?: string; createdAt: Date }
export type SessionRevokedPayload   = { userId: string; sessionId: string; revokedAt: Date }
export type SessionRefreshedPayload = { userId: string; ipAddress?: string; refreshedAt: Date }

export type AuthEventPayload =
  | SessionCreatedPayload
  | SessionRevokedPayload
  | SessionRefreshedPayload

export const AuthEventNames = {
  SESSION_CREATED:   'auth.session_created',
  SESSION_REVOKED:   'auth.session_revoked',
  SESSION_REFRESHED: 'auth.session_refreshed',
} as const

const processAuthEvent = async (job: Job<AuthEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Auth event processed')
  await processEventForAudit(job.name, job.data)
}

export const authEventsQueue = new QueueManager<AuthEventPayload>({
  name:      'auth-events',
  processor: processAuthEvent,
})

export const emitSessionCreated = (userId: string, sessionId: string, method: 'email' | 'google', ipAddress?: string) =>
  authEventsQueue.addJob(AuthEventNames.SESSION_CREATED, { userId, sessionId, method, ipAddress, createdAt: new Date() })

export const emitSessionRevoked = (userId: string, sessionId: string) =>
  authEventsQueue.addJob(AuthEventNames.SESSION_REVOKED, { userId, sessionId, revokedAt: new Date() })

export const emitSessionRefreshed = (userId: string, ipAddress?: string) =>
  authEventsQueue.addJob(AuthEventNames.SESSION_REFRESHED, { userId, ipAddress, refreshedAt: new Date() })