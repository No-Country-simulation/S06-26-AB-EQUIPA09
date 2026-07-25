import { sql } from '@/db'
import { logger } from '@/shared/logger/logger'

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await sql`DELETE FROM sessions WHERE expires_at < NOW() OR (is_active = false AND revoked_at < NOW() - INTERVAL '7 days')`
    const userCount = result.count ?? 0

    const staffResult = await sql`DELETE FROM staff_sessions WHERE expires_at < NOW() OR (is_active = false AND revoked_at < NOW() - INTERVAL '7 days')`
    const staffCount = staffResult.count ?? 0

    const total = userCount + staffCount
    if (total > 0) {
      logger.info({ userCount, staffCount }, 'Expired sessions cleaned up')
    }
    return total
  } catch (err) {
    logger.error({ err }, 'Failed to clean up expired sessions')
    return 0
  }
}

export function startSessionCleanup(): NodeJS.Timeout {
  // Run immediately on startup
  cleanupExpiredSessions()

  // Then every hour
  const interval = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS)
  // Don't block process exit
  if (interval.unref) interval.unref()

  return interval
}
