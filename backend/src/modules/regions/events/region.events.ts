import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'

export type RegionIngestedPayload = {
  regionId: string
  sourceId: string
  period: string
  ingestedAt: Date
}

export type RegionEventPayload = RegionIngestedPayload

export const RegionEventNames = {
  REGION_INGESTED: 'region.ingested',
} as const

const processRegionEvent = async (job: Job<RegionEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Region event processed')
}

export const regionEventsQueue = new QueueManager<RegionEventPayload>({
  name: 'region-events',
  processor: processRegionEvent,
})

export const emitRegionIngested = (
  regionId: string,
  sourceId: string,
  period: string,
) =>
  regionEventsQueue.addJob(RegionEventNames.REGION_INGESTED, {
    regionId, sourceId, period, ingestedAt: new Date(),
  })
