import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'
import { processEventForAudit } from '@/modules/activity/events/audit.listener'

export type ProgramCreatedPayload = {
  programId: string
  category:  string
  regionId?: string
  createdAt: Date
}

export type ProgramUpdatedPayload = {
  programId: string
  changes:   Record<string, unknown>
  updatedAt: Date
}

export type ProgramDeletedPayload = {
  programId: string
  deletedAt: Date
}

export type ProgramEventPayload =
  | ProgramCreatedPayload
  | ProgramUpdatedPayload
  | ProgramDeletedPayload

export const ProgramEventNames = {
  PROGRAM_CREATED: 'program.created',
  PROGRAM_UPDATED: 'program.updated',
  PROGRAM_DELETED: 'program.deleted',
} as const

const processProgramEvent = async (job: Job<ProgramEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Program event processed')
  await processEventForAudit(job.name, job.data)
}

export const programEventsQueue = new QueueManager<ProgramEventPayload>({
  name:      'program-events',
  processor: processProgramEvent,
})

export const emitProgramCreated = (
  programId: string,
  category:  string,
  regionId?: string,
) =>
  programEventsQueue.addJob(ProgramEventNames.PROGRAM_CREATED, {
    programId, category, regionId, createdAt: new Date(),
  })

export const emitProgramUpdated = (
  programId: string,
  changes:   Record<string, unknown>,
) =>
  programEventsQueue.addJob(ProgramEventNames.PROGRAM_UPDATED, {
    programId, changes, updatedAt: new Date(),
  })

export const emitProgramDeleted = (programId: string) =>
  programEventsQueue.addJob(ProgramEventNames.PROGRAM_DELETED, {
    programId, deletedAt: new Date(),
  })
