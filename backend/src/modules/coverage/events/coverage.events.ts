import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'
import { processEventForAudit } from '@/modules/activity/events/audit.listener'

export type CoverageRecomputedPayload = {
  regionId:             string
  period:               string
  networkCoverageScore: number
  no4gOr5gCoverage:     boolean
  updatedAt:            Date
}

export type CoverageEventPayload =
  | CoverageRecomputedPayload

export const CoverageEventNames = {
  COVERAGE_RECOMPUTED: 'coverage.recomputed',
} as const

const processCoverageEvent = async (job: Job<CoverageEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Coverage event processed')
  await processEventForAudit(job.name, job.data)
}

export const coverageEventsQueue = new QueueManager<CoverageEventPayload>({
  name:      'coverage-events',
  processor: processCoverageEvent,
})

export const emitCoverageRecomputed = async (
  regionId:             string,
  period:               string,
  networkCoverageScore: number,
  no4gOr5gCoverage:     boolean,
) =>
  coverageEventsQueue.addJob(CoverageEventNames.COVERAGE_RECOMPUTED, {
    regionId, period, networkCoverageScore, no4gOr5gCoverage, updatedAt: new Date(),
  })
