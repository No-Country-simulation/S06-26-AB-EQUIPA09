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
const COHERE_API_URL = 'https://api.cohere.com/v2/chat'
const DEFAULT_MODEL = process.env.COHERE_MODEL || 'command-a-03-2025'
const MAX_RETRIES = 2

const TABLE_SOURCE_MAP: Record<string, string> = {
  'cdrview_records': 'Vísent CDRView',
  'base_stations': 'Vísent CDRView',
  'region_coverage': 'Vísent CDRView',
  'indicators': 'INE Angola',
  'indicator_data': 'INE Angola',
  'programs': 'Governo de Luanda',
  'regions': 'INE Angola',
  'data_sources': 'Vísent CDRView',
}

const inferSources = (sql: string | null): string[] => {
  if (!sql) return ['Vísent CDRView']
  const sources = new Set<string>()
  const sqlUpper = sql.toUpperCase()
  for (const [table, source] of Object.entries(TABLE_SOURCE_MAP)) {
    if (sqlUpper.includes(table.toUpperCase())) {
      sources.add(source)
    }
  }
  return sources.size > 0 ? [...sources] : ['Vísent CDRView']
}

// --- Intent classification ---
// Separates general conversation (greetings, thanks, capability questions)
// from actual data queries that need SQL generation.
type IntentType = 'data_query' | 'general_chat'

const classifyIntent = async (query: string): Promise<{ intent: IntentType; response?: string }> => {
  const res = await fetch(COHERE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{
        role: 'user',
        content: `Classify the user message into exactly one category. Respond with ONLY a JSON object, no extra text.

Categories:
- "data_query": The user is asking for specific data, numbers, statistics, lists, counts, comparisons, or any information that exists in a database. Examples: "quantas schools existem?", "qual a população de Luanda?", "liste as regiões", "mostre os dados de saúde"
- "general_chat": The user is greeting, thanking, saying goodbye, asking what you can do, making small talk, or asking something that does NOT require querying a database. Examples: "Olá", "obrigado", "tudo bem?", "quem és tu?", "ajuda", "como funciona?"

User message: "${query}"

Respond with ONLY: {"intent": "data_query"} or {"intent": "general_chat", "response": "your friendly reply in the same language as the user"}`,
      }],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    // On classification failure, assume data_query to be safe
    return { intent: 'data_query' }
  }

  const body = await res.json() as {
    message?: { content?: Array<{ type: string; text?: string }> }
  }
  const text = body.message?.content?.[0]?.text
  if (!text) return { intent: 'data_query' }

  try {
    const parsed = JSON.parse(text) as { intent?: string; response?: string }
    return {
      intent: parsed.intent === 'general_chat' ? 'general_chat' : 'data_query',
      response: parsed.response,
    }
  } catch {
    return { intent: 'data_query' }
  }
}

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

Examples of valid queries:
- SELECT r.name, rc.network_coverage_score FROM regions r JOIN region_coverage rc ON r.id = rc.region_id
- SELECT i.name, id.value, id.period FROM indicators i JOIN indicator_data id ON i.id = id.indicator_id WHERE id.region_id = 'some-uuid'
- SELECT * FROM programs WHERE region_id = 'some-uuid' AND is_active = true

User query: ${query}`
}

const buildReflectionPrompt = (
  query: string,
  previousSql: string,
  errorMessage: string,
): string => {
  return `You are a read-only SQL analyst. Your previous query was rejected.
Fix it based on the error below. Respond in JSON: { sql: string, explanation: string }

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

      const startMs = Date.now()

      // --- Intent classification: separate chat from data queries ---
      tracer.startSpan(traceId, 'intent-classification', { query: data.query })

      let classification: { intent: IntentType; response?: string }
      try {
        classification = await classifyIntent(data.query)
      } catch {
        classification = { intent: 'data_query' }
      }

      tracer.endSpan(traceId, 'intent-classification', { intent: classification.intent })

      if (classification.intent === 'general_chat') {
        const chatResponse = classification.response ?? 'Olá! Sou o assistente de dados do Bit-B2G. Posso ajudar-te a consultar informações sobre regiões, estações de base, cobertura de rede, indicadores sociais e programas. Como posso ajudar?'
        const latencyMs = Date.now() - startMs

        try {
          await queryLogRepo.create({
            userId:       userId ?? null,
            query:        data.query,
            filters:      (data.filters as QueryLog['filters']) ?? {},
            generatedSql: null,
            sqlValid:     false,
            aiResponse:   chatResponse,
            rowsReturned: 0,
            latencyMs,
            llmModel:     DEFAULT_MODEL,
            tokensUsed:   null,
            error:        null,
            ipAddress:    ipAddress ?? null,
          })
        } catch {
          logger.warn({ query: data.query }, 'Failed to persist general_chat log')
        }

        return Ok({
          queryId:      'chat',
          query:        data.query,
          generatedSql: null,
          sqlValid:     false,
          result:       null,
          aiResponse:   chatResponse,
          sources:      [],
          rowsReturned: 0,
          latencyMs,
          llmModel:     DEFAULT_MODEL,
          tokensUsed:   null,
          error:        null,
        })
      }

      // --- Data query: proceed to SQL generation pipeline ---
      if (!circuitBreaker.isAvailable()) {
        const err = Err(ErrorFactory.externalService(
          'O assistente de IA está temporariamente indisponível devido a falhas consecutivas. Tenta novamente dentro de alguns instantes.',
          'Cohere', undefined, 'circuit_breaker', COMPONENT,
        ))
        tracer.endSpan(traceId, 'llm-call', undefined, 'circuit_breaker_open')
        tracer.flushTrace(traceId)
        return err
      }

      if (!process.env.COHERE_API_KEY) {
        tracer.endSpan(traceId, 'llm-call', undefined, 'missing_cohere_api_key')
        tracer.flushTrace(traceId)
        return Err(ErrorFactory.externalService(
          'COHERE_API_KEY não está configurada no backend',
          'Cohere', undefined, 'configuration', COMPONENT,
        ))
      }

      let llmModel = DEFAULT_MODEL
      let tokensUsed: number | null = null
      let generatedSql: string | null = null
      let sqlValid = false
      let result: Record<string, unknown>[] | null = null
      let aiResponse = ''
      let error: string | null = null
      let rowsReturned = 0

      // Cohere v2 API only supports "user" and "assistant" roles — no "system" role.
      // Prepend system instructions to the first user message.
      const SYSTEM_INSTRUCTIONS = 'You are a read-only SQL analyst. Respond in JSON format only.'
      const messages: Array<{ role: string; content: string }> = [
        { role: 'user', content: `${SYSTEM_INSTRUCTIONS}\n\n${buildPrompt(data.query, data.filters)}` },
      ]

      try {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          tracer.startSpan(traceId, `llm-call-attempt-${attempt}`, { model: DEFAULT_MODEL })

          const cohereResponse = await fetch(COHERE_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              model: DEFAULT_MODEL,
              messages,
              response_format: { type: 'json_object' },
            }),
          })

          if (!cohereResponse.ok) {
            const errorBody = await cohereResponse.text()
            error = `Cohere API error: ${cohereResponse.status} — ${errorBody}`
            aiResponse = error
            circuitBreaker.recordCall({ httpOk: false, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed: null })
            tracer.endSpan(traceId, `llm-call-attempt-${attempt}`, undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.externalService('Erro ao comunicar com o assistente de IA', 'Cohere', errorBody, 'query', COMPONENT))
          }

          const cohereBody = await cohereResponse.json() as {
            id?: string
            model?: string
            usage?: { input_tokens?: number; output_tokens?: number }
            message?: { content?: Array<{ type: string; text?: string }> }
          }

          llmModel = cohereBody.model ?? DEFAULT_MODEL
          const inputTokens = cohereBody.usage?.input_tokens ?? 0
          const outputTokens = cohereBody.usage?.output_tokens ?? 0
          tokensUsed = (inputTokens + outputTokens) || null
          const content = cohereBody.message?.content?.[0]?.text

          if (!content) {
            error = 'Resposta vazia da IA'
            aiResponse = error
            circuitBreaker.recordCall({ httpOk: true, schemaValid: false, latencyMs: Date.now() - startMs, tokensUsed })
            tracer.endSpan(traceId, `llm-call-attempt-${attempt}`, undefined, error)
            tracer.flushTrace(traceId)
            return Err(ErrorFactory.externalService('Resposta vazia do assistente', 'Cohere', undefined, 'query', COMPONENT))
          }

          tracer.endSpan(traceId, `llm-call-attempt-${attempt}`, { model: llmModel, tokensUsed, contentLength: content.length })

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
          llmModel,
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
          sources: inferSources(generatedSql),
          rowsReturned,
          latencyMs,
          llmModel,
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
          sources: inferSources(generatedSql),
          rowsReturned,
          latencyMs,
          llmModel,
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
