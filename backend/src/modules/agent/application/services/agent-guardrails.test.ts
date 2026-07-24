import { describe, it, expect } from 'vitest'
import { createAgentGuardrails } from './agent-guardrails.service'

const guardrails = createAgentGuardrails()

describe('AgentGuardrails', () => {
  describe('Gate 1 — Input Validation', () => {
    it('deve aceitar query válida', () => {
      const result = guardrails.validateGate1({ query: 'Quais regiões têm baixa cobertura?' })
      expect(result.success).toBe(true)
    })

    it('deve rejeitar query vazia', () => {
      const result = guardrails.validateGate1({ query: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('VALIDATION_ERROR')
      }
    })

    it('deve rejeitar query só com espaços', () => {
      const result = guardrails.validateGate1({ query: '   ' })
      expect(result.success).toBe(false)
    })

    it('deve rejeitar query com mais de 2000 caracteres', () => {
      const result = guardrails.validateGate1({ query: 'a'.repeat(2001) })
      expect(result.success).toBe(false)
    })

    it('deve aceitar query com 2000 caracteres', () => {
      const result = guardrails.validateGate1({ query: 'a'.repeat(2000) })
      expect(result.success).toBe(true)
    })

    it('deve aceitar filtros válidos', () => {
      const result = guardrails.validateGate1({
        query: 'Pergunta',
        filters: { region: 'Cazenga', indicator: 'saude-mental', period: '2024' },
      })
      expect(result.success).toBe(true)
    })

    it('deve rejeitar filtro inválido', () => {
      const result = guardrails.validateGate1({
        query: 'Pergunta',
        filters: {region: 'Cazenga', invalidFilter: 'hack' },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Gate 2 — Schema Validation', () => {
    it('deve aceitar JSON válido com sql e explanation', () => {
      const result = guardrails.validateGate2({
        sql: 'SELECT * FROM regions',
        explanation: 'Lista todas as regiões',
      })
      expect(result.success).toBe(true)
    })

    it('deve aceitar JSON com apenas sql', () => {
      const result = guardrails.validateGate2({ sql: 'SELECT 1' })
      expect(result.success).toBe(true)
    })

    it('deve aceitar JSON com apenas explanation', () => {
      const result = guardrails.validateGate2({ explanation: 'Não foi possível gerar SQL' })
      expect(result.success).toBe(true)
    })

    it('deve rejeitar JSON com campos extras', () => {
      const result = guardrails.validateGate2({
        sql: 'SELECT 1',
        explanation: 'ok',
        extra: 'field',
      })
      expect(result.success).toBe(false)
    })

    it('deve rejeitar JSON não objeto', () => {
      const result = guardrails.validateGate2('not an object')
      expect(result.success).toBe(false)
    })

    it('deve rejeitar sql vazio', () => {
      const result = guardrails.validateGate2({ sql: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('Gate 3 — SQL Safety', () => {
    it('deve aceitar SELECT válido', () => {
      const result = guardrails.validateGate3('SELECT * FROM regions')
      expect(result.success).toBe(true)
    })

    it('deve aceitar SELECT com JOIN', () => {
      const result = guardrails.validateGate3(
        'SELECT r.name FROM regions r JOIN region_coverage rc ON r.id = rc.region_id'
      )
      expect(result.success).toBe(true)
    })

    it('deve rejeitar INSERT (não começa com SELECT)', () => {
      const result = guardrails.validateGate3('INSERT INTO regions (name) VALUES (\'test\')')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect((result.error as any).code).toBe('NOT_SELECT')
      }
    })

    it('deve rejeitar UPDATE', () => {
      const result = guardrails.validateGate3('UPDATE regions SET name = \'hack\'')
      expect(result.success).toBe(false)
    })

    it('deve rejeitar DELETE', () => {
      const result = guardrails.validateGate3('DELETE FROM regions WHERE id = 1')
      expect(result.success).toBe(false)
    })

    it('deve rejeitar DROP', () => {
      const result = guardrails.validateGate3('DROP TABLE regions')
      expect(result.success).toBe(false)
    })

    it('deve rejeitar SQL que não começa com SELECT', () => {
      const result = guardrails.validateGate3('WITH cte AS (SELECT 1) SELECT * FROM cte')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect((result.error as any).code).toBe('NOT_SELECT')
      }
    })

    it('deve rejeitar operação perigosa escondida em comment', () => {
      const result = guardrails.validateGate3(
        'SELECT * FROM regions; -- DROP TABLE users'
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect((result.error as any).code).toBe('DANGEROUS_SQL')
      }
    })

    it('deve rejeitar operação perigosa em comment de bloco', () => {
      const result = guardrails.validateGate3(
        'SELECT * FROM regions /* INSERT INTO hack */ WHERE id = 1'
      )
      expect(result.success).toBe(false)
    })

    it('deve aceitar SELECT sem operações perigosas', () => {
      const result = guardrails.validateGate3(
        'SELECT name, coverage_score FROM regions JOIN region_coverage ON regions.id = region_coverage.region_id WHERE region_coverage.period = \'2024\''
      )
      expect(result.success).toBe(true)
    })
  })

  describe('Gate 3 — Table Whitelist', () => {
    it('deve aceitar SQL com tabelas permitidas', () => {
      const result = guardrails.validateGate3('SELECT * FROM regions')
      expect(result.success).toBe(true)
    })

    it('deve aceitar SQL com múltiplas tabelas permitidas', () => {
      const result = guardrails.validateGate3(
        'SELECT r.name, rc.network_coverage_score FROM regions r JOIN region_coverage rc ON r.id = rc.region_id'
      )
      expect(result.success).toBe(true)
    })

    it('deve rejeitar SQL com tabela não permitida', () => {
      const result = guardrails.validateGate3('SELECT * FROM users')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect((result.error as any).code).toBe('TABLE_NOT_ALLOWED')
        expect(result.error.message).toContain('users')
      }
    })

    it('deve rejeitar SQL com tabela pg_catalog', () => {
      const result = guardrails.validateGate3('SELECT * FROM pg_catalog.pg_tables')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('pg_catalog')
      }
    })

    it('deve rejeitar SQL com information_schema', () => {
      const result = guardrails.validateGate3('SELECT * FROM information_schema.tables')
      expect(result.success).toBe(false)
    })

    it('deve rejeitar SQL com tabela mista (uma permitida + uma não)', () => {
      const result = guardrails.validateGate3(
        'SELECT r.name FROM regions r JOIN secret_data s ON r.id = s.region_id'
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('secret_data')
      }
    })

    it('deve rejeitar tabela não permitida mesmo com alias', () => {
      const result = guardrails.validateGate3(
        'SELECT t.name FROM forbidden_table t WHERE t.id = 1'
      )
      expect(result.success).toBe(false)
    })

    it('deve aceitar todas as tabelas da whitelist', () => {
      const tables = [
        'regions', 'base_stations', 'cdrview_records',
        'region_coverage', 'indicators', 'indicator_data',
        'programs', 'data_sources',
      ]
      for (const table of tables) {
        const result = guardrails.validateGate3(`SELECT * FROM ${table}`)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('Neurosymbolic Validation', () => {
    it('deve aceitar SQL sem contexto de filtros', () => {
      const result = guardrails.validateNeurosymbolic('SELECT * FROM regions')
      expect(result.success).toBe(true)
    })

    it('deve aceitar SQL com filtro de região correto', () => {
      const result = guardrails.validateNeurosymbolic(
        "SELECT * FROM regions WHERE name = 'Cazenga'",
        { region: 'Cazenga' }
      )
      expect(result.success).toBe(true)
    })

    it('deve rejeitar SQL sem filtro de região quando solicitado', () => {
      const result = guardrails.validateNeurosymbolic(
        'SELECT * FROM regions',
        { region: 'Cazenga' }
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect((result.error as any).code).toBe('MISSING_REGION_FILTER')
      }
    })

    it('deve aceitar SQL com filtro de período correto', () => {
      const result = guardrails.validateNeurosymbolic(
        "SELECT * FROM indicator_data WHERE period = '2024'",
        { period: '2024' }
      )
      expect(result.success).toBe(true)
    })

    it('deve rejeitar SQL com período diferente do solicitado', () => {
      const result = guardrails.validateNeurosymbolic(
        "SELECT * FROM indicator_data WHERE period = '2023'",
        { period: '2024' }
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect((result.error as any).code).toBe('MISSING_PERIOD_FILTER')
      }
    })

    it('deve aceitar SQL com filtro de indicador', () => {
      const result = guardrails.validateNeurosymbolic(
        "SELECT * FROM indicator_data JOIN indicators ON indicator_data.indicator_id = indicators.id WHERE indicators.slug = 'saude-mental'",
        { indicator: 'saude-mental' }
      )
      expect(result.success).toBe(true)
    })

    it('deve rejeitar SQL sem filtro de indicador quando solicitado', () => {
      const result = guardrails.validateNeurosymbolic(
        'SELECT * FROM indicator_data',
        { indicator: 'saude-mental' }
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect((result.error as any).code).toBe('MISSING_INDICATOR_FILTER')
      }
    })

    it('deve aceitar SQL com todos os filtros corretos', () => {
      const result = guardrails.validateNeurosymbolic(
        "SELECT * FROM indicator_data JOIN indicators ON indicator_data.indicator_id = indicators.id JOIN regions ON indicator_data.region_id = regions.id WHERE regions.name = 'Cazenga' AND indicators.slug = 'saude-mental' AND indicator_data.period = '2024'",
        { region: 'Cazenga', indicator: 'saude-mental', period: '2024' }
      )
      expect(result.success).toBe(true)
    })
  })
})
