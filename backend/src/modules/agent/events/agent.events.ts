import { QueueManager } from '@/shared/queue/queue'
import { logger } from '@/shared/logger/logger'
import type { Job } from 'bullmq'
import { processEventForAudit } from '@/modules/activity/events/audit.listener'

export type AgentQueryPayload = {
  queryId:     string
  userId:      string | null
  latencyMs:   number
  sqlValid:    boolean
  rowsReturned: number
  queriedAt:   Date
}

export type AgentErrorPayload = {
  queryId: string
  userId:  string | null
  error:   string
  erroredAt: Date
}

export type AgentEventPayload =
  | AgentQueryPayload
  | AgentErrorPayload

export const AgentEventNames = {
  AGENT_QUERY: 'agent.query',
  AGENT_ERROR: 'agent.error',
} as const

const processAgentEvent = async (job: Job<AgentEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Agent event processed')
  await processEventForAudit(job.name, job.data)
}

export const agentEventsQueue = new QueueManager<AgentEventPayload>({
  name:      'agent-events',
  processor: processAgentEvent,
})

export const emitAgentQuery = (
  queryId:     string,
  userId:      string | null,
  latencyMs:   number,
  sqlValid:    boolean,
  rowsReturned: number,
) =>
  agentEventsQueue.addJob(AgentEventNames.AGENT_QUERY, {
    queryId, userId, latencyMs, sqlValid, rowsReturned, queriedAt: new Date(),
  })

export const emitAgentError = (
  queryId: string,
  userId:  string | null,
  error:   string,
) =>
  agentEventsQueue.addJob(AgentEventNames.AGENT_ERROR, {
    queryId, userId, error, erroredAt: new Date(),
  })
