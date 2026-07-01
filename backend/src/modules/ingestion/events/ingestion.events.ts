import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'
import { processEventForAudit } from '@/modules/activity/events/audit.listener'

export type DataSourceCreatedPayload = {
  sourceId: string
  slug: string
  name: string
  createdAt: Date
}

export type DataSourceIngestedPayload = {
  sourceId: string
  recordsInserted: number
  regionsUpserted: number
  stationsUpserted: number
  ingestedAt: Date
}

export type IngestionEventPayload =
  | DataSourceCreatedPayload
  | DataSourceIngestedPayload

export const IngestionEventNames = {
  DATA_SOURCE_CREATED: 'data_source.created',
  DATA_SOURCE_INGESTED: 'data_source.ingested',
} as const

const processIngestionEvent = async (job: Job<IngestionEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Ingestion event processed')
  await processEventForAudit(job.name, job.data)
}

export const ingestionEventsQueue = new QueueManager<IngestionEventPayload>({
  name: 'ingestion-events',
  processor: processIngestionEvent,
})

export const emitDataSourceCreated = (
  sourceId: string,
  slug: string,
  name: string,
) =>
  ingestionEventsQueue.addJob(IngestionEventNames.DATA_SOURCE_CREATED, {
    sourceId, slug, name, createdAt: new Date(),
  })

export const emitDataSourceIngested = (
  sourceId: string,
  recordsInserted: number,
  regionsUpserted: number,
  stationsUpserted: number,
) =>
  ingestionEventsQueue.addJob(IngestionEventNames.DATA_SOURCE_INGESTED, {
    sourceId, recordsInserted, regionsUpserted, stationsUpserted, ingestedAt: new Date(),
  })
