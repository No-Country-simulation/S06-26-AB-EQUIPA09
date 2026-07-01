import { db } from '@/db'
import { createActivityLogRepository } from '../../infrastructure/persistence/activity.repository'
import { logger } from '@/shared/logger/logger'

type AuditMetadata = Record<string, unknown>

const insertAuditLog = async (
  actorId:      string | null,
  actorStaffId: string | null,
  entityType:   string,
  entityId:     string,
  action:       string,
  metadata?:    AuditMetadata,
): Promise<void> => {
  try {
    const repo = createActivityLogRepository(db)
    await repo.insert({ actorId, actorStaffId, action, entityType, entityId, metadata })
  } catch (err) {
    logger.error(err, `auditHelpers: failed (${action} ${entityType} ${entityId})`)
  }
}

export const auditHelpers = {
  create: (actorId: string, entityType: string, entityId: string, metadata?: AuditMetadata) =>
    insertAuditLog(actorId, null, entityType, entityId, `${entityType.toUpperCase()}_CREATED`, metadata),

  update: (actorId: string, entityType: string, entityId: string, metadata?: AuditMetadata) =>
    insertAuditLog(actorId, null, entityType, entityId, `${entityType.toUpperCase()}_UPDATED`, metadata),

  delete: (actorId: string, entityType: string, entityId: string, metadata?: AuditMetadata) =>
    insertAuditLog(actorId, null, entityType, entityId, `${entityType.toUpperCase()}_DELETED`, metadata),

  staffCreate: (staffId: string, entityType: string, entityId: string, metadata?: AuditMetadata) =>
    insertAuditLog(null, staffId, entityType, entityId, `${entityType.toUpperCase()}_CREATED`, metadata),

  staffUpdate: (staffId: string, entityType: string, entityId: string, metadata?: AuditMetadata) =>
    insertAuditLog(null, staffId, entityType, entityId, `${entityType.toUpperCase()}_UPDATED`, metadata),

  staffDelete: (staffId: string, entityType: string, entityId: string, metadata?: AuditMetadata) =>
    insertAuditLog(null, staffId, entityType, entityId, `${entityType.toUpperCase()}_DELETED`, metadata),

  staffAction: (staffId: string, entityType: string, entityId: string, action: string, metadata?: AuditMetadata) =>
    insertAuditLog(null, staffId, entityType, entityId, action, metadata),
}
