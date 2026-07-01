import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'
import { processEventForAudit } from '@/modules/activity/events/audit.listener'

export type AlertFiredPayload = {
  configId:         string
  userId:           string
  indicatorId:      string
  regionId:         string
  period:           string
  currentValue:     number
  threshold:        number
  channel:          string
  firedAt:          Date
}

export type AlertEventPayload =
  | AlertFiredPayload

export const AlertEventNames = {
  ALERT_FIRED: 'alert.fired',
} as const

const processAlertEvent = async (job: Job<AlertEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Alert event processed')
  await processEventForAudit(job.name, job.data)
}

export const alertEventsQueue = new QueueManager<AlertEventPayload>({
  name:      'alert-events',
  processor: processAlertEvent,
})

export const emitAlertFired = (
  configId:    string,
  userId:      string,
  indicatorId: string,
  regionId:    string,
  period:      string,
  currentValue: number,
  threshold:   number,
  channel:     string,
) =>
  alertEventsQueue.addJob(AlertEventNames.ALERT_FIRED, {
    configId, userId, indicatorId, regionId, period,
    currentValue, threshold, channel, firedAt: new Date(),
  })
