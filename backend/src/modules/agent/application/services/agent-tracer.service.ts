import { logger } from '@/shared/logger/logger'
import { randomUUID } from 'crypto'

const COMPONENT = 'AgentTracer'

export interface TraceSpan {
  name: string
  startMs: number
  endMs?: number
  durationMs?: number
  input?: unknown
  output?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

export interface AgentTrace {
  traceId: string
  sessionId: string
  spans: TraceSpan[]
  metadata: Record<string, unknown>
}

export const createAgentTracer = () => {
  const traces = new Map<string, AgentTrace>()

  const startTrace = (sessionId: string, metadata?: Record<string, unknown>): string => {
    const traceId = randomUUID()
    traces.set(traceId, {
      traceId,
      sessionId,
      spans: [],
      metadata: metadata ?? {},
    })
    return traceId
  }

  const startSpan = (traceId: string, name: string, input?: unknown): string => {
    const trace = traces.get(traceId)
    if (!trace) {
      logger.warn({ traceId, component: COMPONENT }, 'Tentativa de iniciar span em trace inexistente')
      return ''
    }
    const span: TraceSpan = {
      name,
      startMs: Date.now(),
      input,
    }
    trace.spans.push(span)
    return name
  }

  const endSpan = (traceId: string, name: string, output?: unknown, error?: string) => {
    const trace = traces.get(traceId)
    if (!trace) return

    const span = trace.spans.find(s => s.name === name && !s.endMs)
    if (!span) return

    span.endMs = Date.now()
    span.durationMs = span.endMs - span.startMs
    span.output = output
    span.error = error
  }

  const flushTrace = (traceId: string) => {
    const trace = traces.get(traceId)
    if (!trace) return

    const totalDuration = trace.spans.length > 0
      ? Math.max(...trace.spans.filter(s => s.durationMs !== undefined).map(s => s.durationMs!))
      : 0

    const errorSpans = trace.spans.filter(s => s.error)
    const hasErrors = errorSpans.length > 0

    if (hasErrors) {
      logger.error({
        component: COMPONENT,
        traceId: trace.traceId,
        sessionId: trace.sessionId,
        totalDurationMs: totalDuration,
        spanCount: trace.spans.length,
        errorSpans: errorSpans.map(s => ({ name: s.name, error: s.error })),
        metadata: trace.metadata,
        spans: trace.spans.map(s => ({
          name: s.name,
          durationMs: s.durationMs,
          hasError: !!s.error,
        })),
      }, `Agent trace ${traceId} — ${errorSpans.length} span(s) com erro`)
    } else {
      logger.info({
        component: COMPONENT,
        traceId: trace.traceId,
        sessionId: trace.sessionId,
        totalDurationMs: totalDuration,
        spanCount: trace.spans.length,
        metadata: trace.metadata,
        spans: trace.spans.map(s => ({
          name: s.name,
          durationMs: s.durationMs,
        })),
      }, `Agent trace ${traceId} concluído`)
    }

    traces.delete(traceId)
  }

  return { startTrace, startSpan, endSpan, flushTrace }
}

export type AgentTracer = ReturnType<typeof createAgentTracer>
