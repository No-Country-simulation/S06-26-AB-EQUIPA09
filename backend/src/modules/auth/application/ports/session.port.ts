import type { DbOrTx } from '@/db/transaction'

// ─────────────────────────────────────────────
// Record
// ─────────────────────────────────────────────

export interface SessionRecord {
  id:           string
  userId:       string
  token:        string
  refreshToken: string | null
  isActive:     boolean
  expiresAt:    Date
}

// ─────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────

export interface ISessionRepository {
  create(data: {
    userId:       string
    token:        string
    refreshToken: string
    userAgent?:   string
    ipAddress?:   string
    expiresAt:    Date
  }, db?: DbOrTx): Promise<SessionRecord>

  findByToken(token: string):               Promise<SessionRecord | null>
  findByRefreshToken(token: string):        Promise<SessionRecord | null>
  revoke(sessionId: string, db?: DbOrTx):   Promise<void>
  revokeAllByUser(userId: string, db?: DbOrTx): Promise<void>
}