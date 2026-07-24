import type { IQueryLogRepository, IAgentService, QueryLog } from '../ports/agent.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { logger } from '@/shared/logger/logger'
import { SCHEMA_CONTEXT_FOR_AGENT } from '@/db/schema'
import { sql as pgSql } from '@/db'
import { createAgentGuardrails } from './agent-guardrails.service'
import { createAgentCircuitBreaker } from './agent-circuit-breaker.service'
import { createAgentTracer } from './agent-tracer.service'

const COMPONENT = 'AgentService'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const MAX_RETRIES = 2

const buildPrompt = (query: string, filters?: { region?: string; indicator?: string; period?: string }): string => {
  let filterText = ''
  if (filters?.region || filters?.indicator || filters?.period) {
    const parts: string[] = []
    if (filters.region)    parts.push(`region = ${filters.region}`)
    if (filters.indicator) parts.push(`indicator = ${filters.indicator}`)
    if (filters.period)    parts.push(`period = ${filters.period}`)
    filterText = `\nUser filters: ${parts.join(', ')}`
  }

  return `You are a specialist in the Visent CDRView telecom database.
Your only job is to answer questions by querying the tables defined in SCHEMA_CONTEXT.
Generate a single SELECT query. Never generate INSERT, UPDATE, DELETE, or DDL.
Respond in JSON: { sql: string, explanation: string }

CRITICAL: The "explanation" must answer the user's question with the ACTUAL DATA your SQL will return.
List the real values (region names, scores, numbers) from the database.
Do NOT explain what the SQL does, what tables it uses, or what columns mean.
Just state the facts found in the data. Be concise.
If no data is found, say "Não foram encontrados dados."

SCHEMA_CONTEXT:
${SCHEMA_CONTEXT_FOR_AGENT}${filterText}

User query: ${query}`
}

const buildReflectionPrompt = (
  query: string,
  previousSql: string,
  errorMessage: string,
): string => {
  return `You are a specialist in the Visent CDRView telecom database.
Your previous query was rejected. Fix it based on the error below.
Respond in JSON: { sql: string, explanation: string }

CRITICAL: The "explanation" must answer the user's question directly in Portuguese.
Do NOT describe the SQL, the query, the tables, or the joins.
Just state the data facts.

Previous query:
${previousSql}

Error:
${errorMessage}

SCHEMA_CONTEXT:
${SCHEMA_CONTEXT_FOR_AGENT}

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

      if (!process.env.GROQ_API_KEY) {
        tracer.endSpan(traceId, 'llm-call', undefined, 'missing_groq_api_key')
        tracer.flushTrace(traceId)
        return Err(ErrorFactory.externalService(
          'GROQ_API_KEY não está configurada no backend',
          'Groq', undefined, 'configuration', COMPONENT,
        ))
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
      let messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: 'You are a specialist in the Visent CDRView telecom database. Answer in Portuguese. Respond in JSON format only.' },
        { role: 'user', content: buildPrompt(data.query, data.filters) },
      ]

      try {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          tracer.startSpan(traceId, `llm-call-attempt-${attempt}`, { model: DEFAULT_MODEL })

          const groqResponse = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: DEFAULT_MODEL,
              messages,
              temperature: 0.1,
              response_format: { type: 'json_object' },
            }),
          })

          if (!groqResponse.ok) {
            const errorBody = await groqResponse.text()
            error = `Groq API error: ${groqResponse.status} — ${errorBody}`
            aiResponse = error
            circuitBreaker.recordCall({ httpOk: false, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed: null })
            tracer.endSpan(traceId, `llm-call-attempt-${attempt}`, undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.externalService('Erro ao comunicar com o assistente de IA', 'Groq', errorBody, 'query', COMPONENT))
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
            tracer.endSpan(traceId, `llm-call-attempt-${attempt}`, undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.externalService('Resposta vazia do assistente', 'Groq', undefined, 'query', COMPONENT))
          }

          tracer.endSpan(traceId, `llm-call-attempt-${attempt}`, { model: groqModel, tokensUsed, contentLength: content.length })

          tracer.startSpan(traceId, `gate2-schema-validation-${attempt}`, { rawContent: content.substring(0, 200) })

          let parsed: { sql?: string; explanation?: string }
          try {
            const raw = JSON.parse(content)
            const gate2 = guardrails.validateGate2(raw)
            if (!gate2.success) {
              error = 'Resposta da IA não segue o formato JSON esperado'
              if (attempt < MAX_RETRIES) {
                messages.push({ role: 'assistant', content })
                messages.push({ role: 'user', content: `A resposta não está no formato JSON esperado. Responde apenas com JSON no formato { sql: string, explanation: string }.` })
                tracer.endSpan(traceId, `gate2-schema-validation-${attempt}`, undefined, error)
                continue
              }
              circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
              tracer.endSpan(traceId, `gate2-schema-validation-${attempt}`, undefined, error)
              tracer.flushTrace(traceId)
              return Err(ErrorFactory.validation('O assistente devolveu uma resposta em formato inesperado', [], COMPONENT))
            }
            parsed = raw as { sql?: string; explanation?: string }
          } catch {
            error = 'Não foi possível interpretar a resposta da IA como JSON'
            if (attempt < MAX_RETRIES) {
              messages.push({ role: 'assistant', content })
              messages.push({ role: 'user', content: `A resposta não é um JSON válido. Responde apenas com JSON no formato { sql: string, explanation: string }.` })
              tracer.endSpan(traceId, `gate2-schema-validation-${attempt}`, undefined, error)
              continue
            }
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, `gate2-schema-validation-${attempt}`, undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.business('Resposta inválida do assistente', 'PARSE_ERROR', COMPONENT))
          }

          generatedSql = parsed.sql?.trim() ?? null
          aiResponse = parsed.explanation ?? content
          tracer.endSpan(traceId, `gate2-schema-validation-${attempt}`, { hasSql: !!generatedSql, explanation: aiResponse.substring(0, 100) })

          tracer.startSpan(traceId, `gate3-sql-validation-${attempt}`, { sql: generatedSql?.substring(0, 200) })

          if (!generatedSql) {
            error = 'Não foi possível gerar SQL a partir da pergunta'
            if (attempt < MAX_RETRIES) {
              messages.push({ role: 'assistant', content })
              messages.push({ role: 'user', content: `A resposta não inclui uma query SQL. Gera uma consulta SELECT válida e inclui o campo "sql".` })
              tracer.endSpan(traceId, `gate3-sql-validation-${attempt}`, undefined, error)
              continue
            }
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, `gate3-sql-validation-${attempt}`, undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.business('O assistente não conseguiu gerar uma consulta SQL', 'NO_SQL_GENERATED', COMPONENT))
          }

          const gate3 = guardrails.validateGate3(generatedSql)
          if (!gate3.success) {
            error = gate3.error.message
            sqlValid = false
            if (attempt < MAX_RETRIES) {
              messages.push({ role: 'assistant', content })
              messages.push({ role: 'user', content: buildReflectionPrompt(data.query, generatedSql, gate3.error.message) })
              tracer.endSpan(traceId, `gate3-sql-validation-${attempt}`, undefined, error)
              continue
            }
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, `gate3-sql-validation-${attempt}`, undefined, error)
            tracer.flushTrace(traceId)
            return gate3
          }

          const neuroSymbolic = guardrails.validateNeurosymbolic(generatedSql, data.filters)
          if (!neuroSymbolic.success) {
            error = neuroSymbolic.error.message
            sqlValid = false
            if (attempt < MAX_RETRIES) {
              messages.push({ role: 'assistant', content })
              messages.push({ role: 'user', content: buildReflectionPrompt(data.query, generatedSql, neuroSymbolic.error.message) })
              tracer.endSpan(traceId, `gate3-sql-validation-${attempt}`, undefined, error)
              continue
            }
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, `gate3-sql-validation-${attempt}`, undefined, error)
            tracer.flushTrace(traceId)
            return neuroSymbolic
          }

          sqlValid = true
          tracer.endSpan(traceId, `gate3-sql-validation-${attempt}`, { sqlValid: true })

          tracer.startSpan(traceId, 'sql-execution', { sql: generatedSql.substring(0, 200) })

          try {
            const dbResult = await pgSql.unsafe(generatedSql)
            const rows = Array.isArray(dbResult) ? dbResult : []
            result = rows as Record<string, unknown>[]
            rowsReturned = rows.length
            tracer.endSpan(traceId, 'sql-execution', { rowsReturned })
            break
          } catch (err) {
            error = `Erro ao executar SQL: ${err instanceof Error ? err.message : String(err)}`
            sqlValid = false
            if (attempt < MAX_RETRIES) {
              messages.push({ role: 'assistant', content })
              messages.push({ role: 'user', content: buildReflectionPrompt(data.query, generatedSql, error) })
              tracer.endSpan(traceId, 'sql-execution', undefined, error)
              continue
            }
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, 'sql-execution', undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.business('Erro ao executar consulta SQL gerada', 'SQL_EXECUTION_ERROR', COMPONENT))
          }
        }

        circuitBreaker.recordCall({
          httpOk: true,
          schemaValid: true,
          latencyMs: Date.now() - startMs,
          tokensUsed,
        })

        if (rowsReturned === 0 && generatedSql) {
          aiResponse = 'Não foram encontrados dados correspondentes à sua pergunta na base de dados atual. Tente reformular a pergunta ou verifique se os dados foram carregados.'
          result = null
        } else if (result && result.length > 0) {
          const cols = Object.keys(result[0])
          const labelCol = cols.find(c => /name|regiao|região|region|municipality|cluster/.test(c)) ?? cols[0]
          const valCol = cols.find(c => /score|valor|value|count|total|pct|concentration|people/.test(c)) ?? cols[1]
          const lines = result.slice(0, 10).map(r => {
            const label = String(r[labelCol] ?? '')
            const val = r[valCol] ?? ''
            const formatted = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(2)) : val
            return `${label}: ${formatted}`
          })
          aiResponse = lines.join(' | ')
        }
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
