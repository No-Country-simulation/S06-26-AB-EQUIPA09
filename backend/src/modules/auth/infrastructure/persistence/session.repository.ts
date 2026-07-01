import { eq } from 'drizzle-orm'
import type { Database } from '@/db'
import { sessions } from '@/db/schema'
import type { ISessionRepository, SessionRecord } from '../../application/ports/session.port'
import { dbExec } from '@/db/db-exec'

const toRecord = (row: typeof sessions.$inferSelect): SessionRecord => ({
  id:           row.id,
  userId:       row.userId,
  token:        row.token,
  refreshToken: row.refreshToken ?? null,
  isActive:     row.isActive,
  expiresAt:    row.expiresAt,
})

export const createSessionRepository = (db: Database): ISessionRepository => ({
  async create(data, tx) {
    return dbExec('create', 'SessionRepository', async () => {
      const conn = tx ?? db
      const [row] = await conn
        .insert(sessions)
        .values({
          userId:       data.userId,
          token:        data.token,
          refreshToken: data.refreshToken,
          userAgent:    data.userAgent,
          ipAddress:    data.ipAddress,
          expiresAt:    data.expiresAt,
          isActive:     true,
        })
        .returning()
      return toRecord(row)
    })
  },

  async findByToken(token) {
    return dbExec('findByToken', 'SessionRepository', async () => {
      const [row] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.token, token))
        .limit(1)
      return row ? toRecord(row) : null
    })
  },

  async findByRefreshToken(token) {
    return dbExec('findByRefreshToken', 'SessionRepository', async () => {
      const [row] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.refreshToken, token))
        .limit(1)
      return row ? toRecord(row) : null
    })
  },

  async revoke(sessionId, tx) {
    return dbExec('revoke', 'SessionRepository', async () => {
      const conn = tx ?? db
      await conn
        .update(sessions)
        .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(sessions.id, sessionId))
    })
  },

  async revokeAllByUser(userId, tx) {
    return dbExec('revokeAllByUser', 'SessionRepository', async () => {
      const conn = tx ?? db
      await conn
        .update(sessions)
        .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(sessions.userId, userId))
    })
  },
})