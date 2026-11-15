import { sql as pgSql } from '@/db'

export const AGENT_STATEMENT_TIMEOUT_MS = 5_000
export const AGENT_MAX_ROWS = 200

/**
 * Executa SQL gerado pelo LLM numa transação READ ONLY, com statement_timeout.
 * Mesmo que a análise estática (sql-safety.ts) falhe, o Postgres recusa escritas/DDL
 * e cancela consultas longas. O resultado é truncado a AGENT_MAX_ROWS linhas.
 */
export const executeReadOnlyQuery = async (
  query: string,
  opts: { timeoutMs?: number; maxRows?: number } = {}
): Promise<Record<string, unknown>[]> => {
  const timeoutMs = Math.max(1, Math.floor(opts.timeoutMs ?? AGENT_STATEMENT_TIMEOUT_MS))
  const maxRows = opts.maxRows ?? AGENT_MAX_ROWS

  const rows = await pgSql.begin('read only', async (tx) => {
    await tx.unsafe(`SET LOCAL statement_timeout = ${timeoutMs}`)
    const result = await tx.unsafe(query)
    // postgres.js aceita várias instruções no protocolo simples e devolve um array de resultados.
    // A análise estática já as recusa; isto é a rede de segurança (a transação é revertida ao lançar).
    if (Array.from(result).some((r) => Array.isArray(r))) {
      throw new Error('Apenas uma instrução SQL é permitida')
    }
    return result
  })

  return (Array.from(rows) as Record<string, unknown>[]).slice(0, maxRows)
}
