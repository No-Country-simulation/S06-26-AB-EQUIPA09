import { logger } from '@/shared/logger/logger'

export const broadcastToUser = (userId: string, data: Record<string, unknown>): void => {
  logger.info({ userId, data }, '[WS Stub] broadcastToUser')
}
