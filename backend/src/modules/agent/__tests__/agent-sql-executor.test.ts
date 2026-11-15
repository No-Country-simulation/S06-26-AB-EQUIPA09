import { describe, it, expect, afterAll } from 'vitest'
import { sql } from '@/db'
import { executeReadOnlyQuery } from '../application/services/agent-sql-executor'

const dbUp = await sql`SELECT 1`.then(() => true).catch(() => false)

// Estes testes precisam do Postgres local (docker compose -f infra/docker-compose.yml up -d).
describe.skipIf(!dbUp)('executeReadOnlyQuery (Postgres)', () => {
  afterAll(async () => { await sql.end({ timeout: 2 }) })

  it('executa SELECT normalmente', async () => {
    const rows = await executeReadOnlyQuery('SELECT 1 AS x')
    expect(rows).toEqual([{ x: 1 }])
  })

  it('recusa escrita/DDL mesmo que passe pela análise estática (transação READ ONLY)', async () => {
    await expect(executeReadOnlyQuery('CREATE TEMP TABLE agent_ro_probe (a int)')).rejects.toThrow(/read-only/i)
  })

  it('cancela consultas que excedem o statement_timeout', async () => {
    await expect(executeReadOnlyQuery('SELECT pg_sleep(2)', { timeoutMs: 200 })).rejects.toThrow(/timeout/i)
  })

  it('trunca o resultado a maxRows', async () => {
    const rows = await executeReadOnlyQuery('SELECT g FROM generate_series(1, 50) g', { maxRows: 10 })
    expect(rows).toHaveLength(10)
  })

  it('rejeita várias instruções (protocolo extendido)', async () => {
    await expect(executeReadOnlyQuery('SELECT 1; SELECT 2')).rejects.toThrow()
  })
})
