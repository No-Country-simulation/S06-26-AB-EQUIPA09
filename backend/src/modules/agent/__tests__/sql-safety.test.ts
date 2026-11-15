import { describe, it, expect } from 'vitest'
import { analyzeSql, sqlHasStringLiteral } from '../application/services/sql-safety'
import { createAgentGuardrails } from '../application/services/agent-guardrails.service'

const blocked = (sql: string, code?: string) => {
  const r = analyzeSql(sql)
  expect(r.ok, `deveria bloquear: ${sql}`).toBe(false)
  if (code) expect(r.code).toBe(code)
}
const allowed = (sql: string) => {
  const r = analyzeSql(sql)
  expect(r.ok, `deveria permitir: ${sql} -> ${r.reason}`).toBe(true)
}

describe('analyzeSql — consultas legítimas', () => {
  it.each([
    'SELECT name FROM regions LIMIT 5',
    'SELECT r.name, rc.network_coverage_score FROM regions r JOIN region_coverage rc ON rc.region_id = r.id ORDER BY rc.network_coverage_score ASC LIMIT 10;',
    'SELECT r.name, COUNT(bs.id) FROM regions r LEFT JOIN base_stations bs ON bs.region_id = r.id GROUP BY r.name',
    'WITH a AS (SELECT id, name FROM regions) SELECT * FROM a',
    'select * from public.regions',
    "SELECT * FROM regions WHERE municipality = 'Florianopolis'",
    "SELECT * FROM regions WHERE name = 'Create; Drop x'",
    'SELECT * FROM regions WHERE name IS DISTINCT FROM municipality',
    'SELECT EXTRACT(HOUR FROM created_at) FROM regions',
    'SELECT * FROM cdrview_records WHERE updated_at IS NOT NULL OR created_at IS NOT NULL',
    'SELECT * FROM generate_series(1, 5)',
    'SELECT r.name FROM regions r WHERE r.id IN (SELECT region_id FROM base_stations)',
  ])('permite: %s', allowed)
})

describe('analyzeSql — o que tem de ser bloqueado', () => {
  it('vazio / demasiado longo', () => {
    blocked('', 'EMPTY')
    blocked("SELECT 1 FROM regions WHERE name = '" + 'a'.repeat(5000) + "'", 'TOO_LONG')
  })
  it('tabelas sensíveis (regressão: allowlist era um no-op)', () => {
    blocked('SELECT email, password_hash FROM users', 'TABLE_NOT_ALLOWED')
    blocked('SELECT * FROM staff_users', 'TABLE_NOT_ALLOWED')
    blocked('SELECT * FROM sessions', 'TABLE_NOT_ALLOWED')
    blocked('SELECT * FROM query_logs', 'TABLE_NOT_ALLOWED')
    blocked('SELECT * FROM "users"', 'TABLE_NOT_ALLOWED')
    blocked('SELECT * FROM public.users', 'TABLE_NOT_ALLOWED')
    blocked('SELECT * FROM regions r JOIN users u ON true', 'TABLE_NOT_ALLOWED')
    blocked('SELECT * FROM regions WHERE id IN (SELECT user_id FROM sessions)', 'TABLE_NOT_ALLOWED')
  })
  it('tabelas fora da allowlist e schemas de sistema', () => {
    blocked('SELECT * FROM unknown_table', 'TABLE_NOT_ALLOWED')
    blocked('SELECT * FROM information_schema.tables', 'FORBIDDEN_IDENTIFIER')
    blocked('SELECT * FROM pg_catalog.pg_tables', 'FORBIDDEN_IDENTIFIER')
    blocked('SELECT * FROM pg_user', 'FORBIDDEN_IDENTIFIER')
    blocked('SELECT * FROM somewhere.regions', 'TABLE_NOT_ALLOWED')
  })
  it('comma-join não pode esconder tabelas', () => {
    blocked('SELECT * FROM regions r, base_stations b', 'COMMA_JOIN')
  })
  it('várias instruções', () => {
    blocked('SELECT 1; SELECT pg_sleep(30)', 'MULTI_STATEMENT')
    blocked('SELECT 1 FROM regions; SELECT 2', 'MULTI_STATEMENT')
  })
  it('funções perigosas', () => {
    blocked('SELECT pg_sleep(30)', 'FORBIDDEN_IDENTIFIER')
    blocked("SELECT pg_read_file('/etc/passwd')", 'FORBIDDEN_IDENTIFIER')
    blocked("SELECT set_config('x','y',false)", 'FORBIDDEN_IDENTIFIER')
    blocked("SELECT lo_import('/etc/passwd')", 'FORBIDDEN_IDENTIFIER')
    blocked('SELECT current_user', 'FORBIDDEN_IDENTIFIER')
    blocked('SELECT version()', 'FORBIDDEN_IDENTIFIER')
    blocked("SELECT * FROM dblink('x','select 1') AS t(a int)", 'FORBIDDEN_IDENTIFIER')
  })
  it('escrita, DDL e locks', () => {
    blocked('DELETE FROM regions', 'NOT_SELECT')
    blocked('INSERT INTO regions DEFAULT VALUES', 'NOT_SELECT')
    blocked('WITH x AS (DELETE FROM regions RETURNING *) SELECT * FROM x', 'DANGEROUS_SQL')
    blocked('SELECT * INTO newtbl FROM regions', 'DANGEROUS_SQL')
    blocked('SELECT * FROM regions FOR UPDATE', 'DANGEROUS_SQL')
    blocked("COPY regions TO PROGRAM 'id'", 'NOT_SELECT')
  })
  it('comentários, escapes e dollar-quoting', () => {
    blocked('SELECT 1 -- x', 'COMMENT_OR_ESCAPE')
    blocked('SELECT /* x */ 1', 'COMMENT_OR_ESCAPE')
    blocked("SELECT E'\\x41' FROM regions", 'COMMENT_OR_ESCAPE')
    blocked('SELECT $$a$$', 'COMMENT_OR_ESCAPE')
  })
})

describe('sqlHasStringLiteral', () => {
  it('só aceita o valor dentro de um literal de texto', () => {
    expect(sqlHasStringLiteral("SELECT * FROM regions WHERE name = 'Florianopolis'", 'florianopolis')).toBe(true)
    expect(sqlHasStringLiteral('SELECT 1 AS florianopolis', 'florianopolis')).toBe(false)
  })
})

describe('guardrails', () => {
  const g = createAgentGuardrails()
  it('gate1: rejeita filtros desconhecidos e query vazia', () => {
    expect(g.validateGate1({ query: '' }).success).toBe(false)
    expect(g.validateGate1({ query: 'x', filters: { foo: '1' } }).success).toBe(false)
    expect(g.validateGate1({ query: 'ok', filters: { region: 'A' } }).success).toBe(true)
  })
  it('gate3 devolve a razão para a reflexão do LLM', () => {
    const r = g.validateGate3('SELECT * FROM users')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.message).toContain('users')
  })
  it('neurosimbólico: filtro de região não pode ser satisfeito por comentário/identificador', () => {
    expect(g.validateNeurosymbolic('SELECT 1 -- Florianopolis', { region: 'Florianopolis' }).success).toBe(false)
    expect(g.validateNeurosymbolic("SELECT * FROM regions WHERE municipality = 'Florianopolis'", { region: 'Florianopolis' }).success).toBe(true)
  })
  it('neurosimbólico: filtro de período', () => {
    expect(g.validateNeurosymbolic("SELECT * FROM region_coverage WHERE period = '2026-03'", { period: '2026-03' }).success).toBe(true)
    expect(g.validateNeurosymbolic("SELECT * FROM region_coverage WHERE period = '2025-01'", { period: '2026-03' }).success).toBe(false)
    expect(g.validateNeurosymbolic('SELECT * FROM region_coverage', { period: '2026-03' }).success).toBe(false)
  })
})
