import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'
import { processEventForAudit } from '@/modules/activity/events/audit.listener'

export type IndicatorCreatedPayload = {
  indicatorId: string
  slug: string
  name: string
  createdBy: string
  createdAt: Date
}

export type IndicatorDataUpsertedPayload = {
  dataId:      string
  indicatorId: string
  regionId:    string
  period:      string
  value:       number
  upsertedBy:  string
  updatedAt:   Date
}

export type IndicatorEventPayload =
  | IndicatorCreatedPayload
  | IndicatorDataUpsertedPayload

export const IndicatorEventNames = {
  INDICATOR_CREATED:      'indicator.created',
  INDICATOR_DATA_UPSERTED: 'indicator.data_upserted',
} as const

const processIndicatorEvent = async (job: Job<IndicatorEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Indicator event processed')
  await processEventForAudit(job.name, job.data)
}

export const indicatorEventsQueue = new QueueManager<IndicatorEventPayload>({
  name:      'indicator-events',
  processor: processIndicatorEvent,
})

export const emitIndicatorCreated = async (
  indicatorId: string,
  slug: string,
  name: string,
  createdBy: string,
) =>
  indicatorEventsQueue.addJob(IndicatorEventNames.INDICATOR_CREATED, {
    indicatorId, slug, name, createdBy, createdAt: new Date(),
  })

export const emitIndicatorDataUpserted = async (
  dataId: string,
  indicatorId: string,
  regionId: string,
  period: string,
  value: number,
  upsertedBy: string,
) =>
  indicatorEventsQueue.addJob(IndicatorEventNames.INDICATOR_DATA_UPSERTED, {
    dataId, indicatorId, regionId, period, value, upsertedBy, updatedAt: new Date(),
  })
