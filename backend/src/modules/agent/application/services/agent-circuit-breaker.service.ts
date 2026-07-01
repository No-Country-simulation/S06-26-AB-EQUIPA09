import { logger } from '@/shared/logger/logger'

const COMPONENT = 'AgentCircuitBreaker'

type BreakerState = 'closed' | 'open' | 'half_open'

export interface CallRecord {
  httpOk: boolean
  schemaValid: boolean
  latencyMs: number
  tokensUsed: number | null
}

export interface BreakerStatus {
  state: BreakerState
  consecutiveFailures: number
  lastFailureAt: Date | null
  nextRetryAt: Date | null
  totalCalls: number
  totalFailures: number
}

export const createAgentCircuitBreaker = (
  options?: {
    qualityThreshold?: number
    cooldownMs?: number
    maxConsecutiveFailures?: number
    maxFailureRate?: number
  },
) => {
  const COOLDOWN_MS = options?.cooldownMs ?? 60_000
  const MAX_CONSECUTIVE_FAILURES = options?.maxConsecutiveFailures ?? 3
  const MAX_FAILURE_RATE = options?.maxFailureRate ?? 0.5

  let state: BreakerState = 'closed'
  let consecutiveFailures = 0
  let totalCalls = 0
  let totalFailures = 0
  let lastFailureAt: Date | null = null
  let nextRetryAt: Date | null = null
  let windowStartAt = Date.now()

  const isQualityFailure = (record: CallRecord): boolean => {
    if (!record.httpOk) return true
    if (!record.schemaValid) return true
    return false
  }

  const openCircuit = (reason: string) => {
    state = 'open'
    nextRetryAt = new Date(Date.now() + COOLDOWN_MS)
    logger.warn({
      component: COMPONENT,
      reason,
      consecutiveFailures,
      cooldownMs: COOLDOWN_MS,
      nextRetryAt: nextRetryAt.toISOString(),
    }, 'Circuit breaker opened')
  }

  const closeCircuit = () => {
    state = 'closed'
    consecutiveFailures = 0
    windowStartAt = Date.now()
    logger.info({ component: COMPONENT }, 'Circuit breaker closed')
  }

  const halfOpenCircuit = () => {
    state = 'half_open'
    logger.info({ component: COMPONENT }, 'Circuit breaker half-open — testing provider')
  }

  return {
    isAvailable(): boolean {
      if (state === 'closed') return true
      if (state === 'half_open') return true
      if (state === 'open' && nextRetryAt && Date.now() >= nextRetryAt.getTime()) {
        halfOpenCircuit()
        return true
      }
      return false
    },

    recordCall(record: CallRecord): void {
      totalCalls++

      if (isQualityFailure(record)) {
        consecutiveFailures++
        totalFailures++
        lastFailureAt = new Date()

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          openCircuit(`${consecutiveFailures} falhas consecutivas de qualidade`)
        }
      } else {
        if (state === 'half_open') {
          closeCircuit()
        }
        consecutiveFailures = 0
      }

      const windowDuration = Date.now() - windowStartAt
      if (windowDuration > 300_000) {
        const failureRate = totalCalls > 0 ? totalFailures / totalCalls : 0
        if (failureRate >= MAX_FAILURE_RATE && totalCalls >= 10) {
          openCircuit(`Taxa de falha ${(failureRate * 100).toFixed(1)}% acima do limite ${(MAX_FAILURE_RATE * 100).toFixed(0)}%`)
        }
        windowStartAt = Date.now()
        totalCalls = 0
        totalFailures = 0
      }
    },

    getStatus(): BreakerStatus {
      return {
        state,
        consecutiveFailures,
        lastFailureAt,
        nextRetryAt,
        totalCalls,
        totalFailures,
      }
    },

    reset(): void {
      closeCircuit()
      totalCalls = 0
      totalFailures = 0
      lastFailureAt = null
      nextRetryAt = null
    },
  }
}

export type AgentCircuitBreaker = ReturnType<typeof createAgentCircuitBreaker>
