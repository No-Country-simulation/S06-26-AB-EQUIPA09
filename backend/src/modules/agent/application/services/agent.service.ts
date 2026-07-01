import type { IQueryLogRepository, IAgentService, QueryLog } from '../ports/agent.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { logger } from '@/shared/logger/logger'
import { SCHEMA_CONTEXT_FOR_AGENT } from '@/db/schema'
import { sql as pgSql } from '@/db'
import { emitAgentQuery, emitAgentError } from '../../events/agent.events'
import { createAgentGuardrails } from './agent-guardrails.service'
import { createAgentCircuitBreaker } from './agent-circuit-breaker.service'
import { createAgentTracer } from './agent-tracer.service'

const COMPONENT = 'AgentService'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

const buildPrompt = (query: string, filters?: { region?: string; indicator?: string; period?: string }): string => {
  let filterText = ''
  if (filters?.region || filters?.indicator || filters?.period) {
    const parts: string[] = []
    if (filters.region)    parts.push(`region = ${filters.region}`)
    if (filters.indicator) parts.push(`indicator = ${filters.indicator}`)
    if (filters.period)    parts.push(`period = ${filters.period}`)
    filterText = `\nUser filters: ${parts.join(', ')}`
  }

  return `You are a read-only SQL analyst. Use only the tables defined in SCHEMA_CONTEXT.
Generate a single SELECT query. Never generate INSERT, UPDATE, DELETE, or DDL.
Respond in JSON: { sql: string, explanation: string }

SCHEMA_CONTEXT:
${SCHEMA_CONTEXT_FOR_AGENT}${filterText}

User query: ${query}`
}

export const createAgentService = (
  queryLogRepo: IQueryLogRepository,
): IAgentService => {
  const guardrails = createAgentGuardrails()
  const circuitBreaker = createAgentCircuitBreaker()
  const tracer = createAgentTracer()

  return {
    async query(data, userId, ipAddress) {
      const traceId = tracer.startTrace(userId ?? 'anonymous', {
        component: COMPONENT,
        userId: userId ?? null,
        ipAddress: ipAddress ?? null,
      })

      tracer.startSpan(traceId, 'gate1-input-validation', { query: data.query, filters: data.filters })

      const gate1 = guardrails.validateGate1({ query: data.query, filters: data.filters as Record<string, string | undefined> })
      if (!gate1.success) {
        tracer.endSpan(traceId, 'gate1-input-validation', undefined, gate1.error.message)
        tracer.flushTrace(traceId)
        return gate1
      }
      tracer.endSpan(traceId, 'gate1-input-validation', { passed: true })

      if (!circuitBreaker.isAvailable()) {
        const err = Err(ErrorFactory.externalService(
          'O assistente de IA está temporariamente indisponível devido a falhas consecutivas. Tenta novamente dentro de alguns instantes.',
          'Groq', undefined, 'circuit_breaker', COMPONENT,
        ))
        tracer.endSpan(traceId, 'llm-call', undefined, 'circuit_breaker_open')
        tracer.flushTrace(traceId)
        return err
      }

      const startMs = Date.now()
      let groqModel = DEFAULT_MODEL
      let tokensUsed: number | null = null
      let generatedSql: string | null = null
      let sqlValid = false
      let result: Record<string, unknown>[] | null = null
      let aiResponse = ''
      let error: string | null = null
      let rowsReturned = 0

      try {
        tracer.startSpan(traceId, 'llm-call', { model: DEFAULT_MODEL })

        const groqResponse = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [
              { role: 'system', content: 'You are a read-only SQL analyst. Respond in JSON format only.' },
              { role: 'user', content: buildPrompt(data.query, data.filters) },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        })

        if (!groqResponse.ok) {
          const errorBody = await groqResponse.text()
          error = `Groq API error: ${groqResponse.status} — ${errorBody}`
          aiResponse = error

          circuitBreaker.recordCall({
            httpOk: false,
            schemaValid: false,
            latencyMs: Date.now() - startMs,
            tokensUsed: null,
          })

          tracer.endSpan(traceId, 'llm-call', undefined, error)
          tracer.flushTrace(traceId)
          return Err(ErrorFactory.externalService(
            'Erro ao comunicar com o assistente de IA',
            'Groq', errorBody, 'query', COMPONENT,
          ))
        }

        const groqBody = await groqResponse.json() as {
          model?: string
          usage?: { total_tokens?: number }
          choices?: Array<{ message?: { content?: string } }>
        }

        groqModel = groqBody.model ?? DEFAULT_MODEL
        tokensUsed = groqBody.usage?.total_tokens ?? null

        const content = groqBody.choices?.[0]?.message?.content
        if (!content) {
          error = 'Resposta vazia da IA'
          aiResponse = error
          circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
          tracer.endSpan(traceId, 'llm-call', undefined, error)
          tracer.flushTrace(traceId)
          return Err(ErrorFactory.externalService('Resposta vazia do assistente', 'Groq', undefined, 'query', COMPONENT))
        }

        tracer.endSpan(traceId, 'llm-call', { model: groqModel, tokensUsed, contentLength: content.length })

        tracer.startSpan(traceId, 'gate2-schema-validation', { rawContent: content.substring(0, 200) })

        let parsed: { sql?: string; explanation?: string }
        try {
          const raw = JSON.parse(content)
            const gate2 = guardrails.validateGate2(raw)
          if (!gate2.success) {
            error = 'Resposta da IA não segue o formato JSON esperado'
            aiResponse = content
            generatedSql = null

            circuitBreaker.recordCall({
              httpOk: true,
              schemaValid: false,
              latencyMs: Date.now() - startMs,
              tokensUsed,
            })

            tracer.endSpan(traceId, 'gate2-schema-validation', undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.validation(
              'O assistente devolveu uma resposta em formato inesperado',
              [], COMPONENT,
            ))
          }
          parsed = raw as { sql?: string; explanation?: string }
        } catch {
          error = 'Não foi possível interpretar a resposta da IA como JSON'
          aiResponse = content
          generatedSql = null
          circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
          tracer.endSpan(traceId, 'gate2-schema-validation', undefined, error)
          tracer.flushTrace(traceId)
          return Err(ErrorFactory.business('Resposta inválida do assistente', 'PARSE_ERROR', COMPONENT))
        }

        generatedSql = parsed.sql?.trim() ?? null
        aiResponse = parsed.explanation ?? content
        tracer.endSpan(traceId, 'gate2-schema-validation', { hasSql: !!generatedSql, explanation: aiResponse.substring(0, 100) })

        tracer.startSpan(traceId, 'gate3-sql-validation', { sql: generatedSql?.substring(0, 200) })

        if (generatedSql) {
          const gate3 = guardrails.validateGate3(generatedSql)
          if (!gate3.success) {
            error = gate3.error.message
            sqlValid = false
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, 'gate3-sql-validation', undefined, error)
            tracer.flushTrace(traceId)
            return gate3
          }

          sqlValid = true

          const neuroSymbolic = guardrails.validateNeurosymbolic(generatedSql, data.filters)
          if (!neuroSymbolic.success) {
            error = neuroSymbolic.error.message
            sqlValid = false
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, 'gate3-sql-validation', undefined, error)
            tracer.flushTrace(traceId)
            return neuroSymbolic
          }

          tracer.endSpan(traceId, 'gate3-sql-validation', { sqlValid: true })

          tracer.startSpan(traceId, 'sql-execution', { sql: generatedSql.substring(0, 200) })

          try {
            const dbResult = await pgSql.unsafe(generatedSql)
            const rows = Array.isArray(dbResult) ? dbResult : []
            result = rows as Record<string, unknown>[]
            rowsReturned = rows.length
            tracer.endSpan(traceId, 'sql-execution', { rowsReturned })
          } catch (err) {
            error = `Erro ao executar SQL: ${err instanceof Error ? err.message : String(err)}`
            sqlValid = false
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, 'sql-execution', undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.business('Erro ao executar consulta SQL gerada', 'SQL_EXECUTION_ERROR', COMPONENT))
          }
        } else {
          error = 'Não foi possível gerar SQL a partir da pergunta'
          circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
          tracer.endSpan(traceId, 'gate3-sql-validation', undefined, error)
          tracer.flushTrace(traceId)
          return Err(ErrorFactory.business('O assistente não conseguiu gerar uma consulta SQL', 'NO_SQL_GENERATED', COMPONENT))
        }

        circuitBreaker.recordCall({
          httpOk: true,
          schemaValid: true,
          latencyMs: Date.now() - startMs,
          tokensUsed,
        })
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
        logger.error({ err, query: data.query }, 'Agent query failed')
        circuitBreaker.recordCall({ httpOk: false, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed: null })
        tracer.endSpan(traceId, 'llm-call', undefined, error)
        tracer.flushTrace(traceId)
        return Err(ErrorFactory.internalError('Erro interno ao processar pergunta', err, COMPONENT))
      }

      const latencyMs = Date.now() - startMs

      tracer.startSpan(traceId, 'persist-log', { latencyMs })

      try {
        const log = await queryLogRepo.create({
          userId:       userId ?? null,
          query:        data.query,
          filters:      data.filters as QueryLog['filters'] ?? {},
          generatedSql,
          sqlValid,
          aiResponse,
          rowsReturned,
          latencyMs,
          groqModel,
          tokensUsed,
          error:        error ?? null,
          ipAddress:    ipAddress ?? null,
        })

        if (error) {
          emitAgentError(log.id, userId ?? null, error)
        } else {
          emitAgentQuery(log.id, userId ?? null, latencyMs, sqlValid, rowsReturned)
        }

        tracer.endSpan(traceId, 'persist-log', { logId: log.id })
        tracer.flushTrace(traceId)

        return Ok({
          queryId:      log.id,
          query:        data.query,
          generatedSql,
          sqlValid,
          result,
          aiResponse,
          rowsReturned,
          latencyMs,
          groqModel,
          tokensUsed,
          error,
        })
      } catch (err) {
        logger.error({ err }, 'Failed to persist query_log')
        tracer.endSpan(traceId, 'persist-log', undefined, 'persist_failed')
        tracer.flushTrace(traceId)
        return Ok({
          queryId:      'unlogged',
          query:        data.query,
          generatedSql,
          sqlValid,
          result,
          aiResponse,
          rowsReturned,
          latencyMs,
          groqModel,
          tokensUsed,
          error,
        })
      }
    },

    async getLog(queryId) {
      const log = await queryLogRepo.findById(queryId)
      if (!log) {
        return Err(ErrorFactory.notFound('Query log não encontrado', 'QueryLog', queryId, COMPONENT))
      }
      return Ok(log)
    },

    async listLogs(filters) {
      const result = await queryLogRepo.findAll(filters)
      return Ok(result)
    },

    async listMyLogs(userId, filters) {
      const page    = filters?.page ?? 1
      const perPage = filters?.pageSize ?? 20
      const result = await queryLogRepo.findAll({
        userId,
        page,
        pageSize: perPage,
      })
      return Ok(result)
    },
  }
}
