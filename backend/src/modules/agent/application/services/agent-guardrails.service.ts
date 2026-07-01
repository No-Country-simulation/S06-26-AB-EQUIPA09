import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { z } from 'zod'

const COMPONENT = 'AgentGuardrails'

const SQL_VALID_REGEX = /^\s*SELECT\b/i
const SQL_DANGEROUS_REGEX = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b/i

export const llmResponseSchema = z.object({
  sql: z.string().min(1, 'SQL gerado vazio').optional(),
  explanation: z.string().optional(),
}).strict()

export type LLMResponseInput = z.input<typeof llmResponseSchema>

export interface GateResult {
  passed: boolean
  message: string
  code: string
}

const ALLOWED_TABLES = [
  'regions', 'base_stations', 'cdrview_records', 'region_coverage',
  'indicators', 'indicator_data', 'programs', 'data_sources',
]

export const createAgentGuardrails = () => {

  const validateGate1 = (input: { query: string; filters?: Record<string, string | undefined> }): Result<GateResult, AppError> => {
    if (!input.query || input.query.trim().length === 0) {
      return Err(ErrorFactory.validation('Pergunta vazia', [{
        field: 'query', message: 'A pergunta não pode estar vazia', rule: 'required',
      }], COMPONENT))
    }
    if (input.query.length > 2000) {
      return Err(ErrorFactory.validation('Pergunta demasiado longa', [{
        field: 'query', message: 'Máximo 2000 caracteres', rule: 'max_length',
      }], COMPONENT))
    }
    if (input.filters) {
      const validFilterKeys = ['region', 'indicator', 'period']
      for (const key of Object.keys(input.filters)) {
        if (!validFilterKeys.includes(key)) {
          return Err(ErrorFactory.validation('Filtro inválido', [{
            field: key, message: `Filtro "${key}" não é permitido`, rule: 'invalid_filter',
          }], COMPONENT))
        }
      }
    }
    return Ok({ passed: true, message: 'Input válido', code: 'GATE1_PASS' })
  }

  const validateGate2 = (rawJson: unknown): Result<z.infer<typeof llmResponseSchema>, AppError> => {
    const parsed = llmResponseSchema.safeParse(rawJson)
    if (!parsed.success) {
      const fieldErrors = parsed.error.issues.map(i => ({
        field: i.path.join('.') || 'root',
        message: i.message,
        rule: i.code,
      }))
      return Err(ErrorFactory.validation(
        'Resposta da IA não segue o formato esperado',
        fieldErrors, COMPONENT,
      ))
    }
    return Ok(parsed.data)
  }

  const validateGate3 = (sql: string): Result<GateResult, AppError> => {
    if (!SQL_VALID_REGEX.test(sql)) {
      return Err(ErrorFactory.business(
        'Apenas consultas SELECT são permitidas',
        'NOT_SELECT', COMPONENT,
      ))
    }
    if (SQL_DANGEROUS_REGEX.test(sql)) {
      return Err(ErrorFactory.business(
        'SQL contém operações não permitidas (INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE)',
        'DANGEROUS_SQL', COMPONENT,
      ))
    }

    const sqlUpper = sql.toUpperCase()
    for (const table of ALLOWED_TABLES) {
      if (sqlUpper.includes(table.toUpperCase())) continue
    }

    return Ok({ passed: true, message: 'SQL válido e seguro', code: 'GATE3_PASS' })
  }

  const validateNeurosymbolic = (sql: string, context?: { region?: string; indicator?: string; period?: string }): Result<GateResult, AppError> => {
    if (context?.region && !sql.toUpperCase().includes(context.region.toUpperCase())) {
      return Err(ErrorFactory.business(
        `O filtro de região "${context.region}" não foi aplicado na consulta gerada`,
        'MISSING_REGION_FILTER', COMPONENT,
      ))
    }
    if (context?.period) {
      const periodMatch = sql.match(/period\s*=\s*['"]([^'"]+)['"]/i)
      if (!periodMatch || periodMatch[1] !== context.period) {
        return Err(ErrorFactory.business(
          `O filtro de período "${context.period}" não foi aplicado correctamente na consulta`,
          'MISSING_PERIOD_FILTER', COMPONENT,
        ))
      }
    }
    return Ok({ passed: true, message: 'Regras de negócio validadas', code: 'NEUROSYMBOLIC_PASS' })
  }

  return { validateGate1, validateGate2, validateGate3, validateNeurosymbolic }
}
