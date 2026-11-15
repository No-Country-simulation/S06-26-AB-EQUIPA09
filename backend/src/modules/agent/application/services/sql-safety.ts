/**
 * Análise estática do SQL gerado pelo LLM.
 *
 * Esta é a 1ª camada de defesa (a 2ª é a execução numa transação READ ONLY com
 * statement_timeout — ver agent-sql-executor.ts). É deliberadamente conservadora:
 * um falso positivo só provoca uma nova tentativa (reflexão) do agente, um falso
 * negativo pode expor dados.
 */

export const ALLOWED_TABLES = new Set([
  'regions',
  'base_stations',
  'cdrview_records',
  'region_coverage',
  'indicators',
  'indicator_data',
  'programs',
  'data_sources',
])

/** Tabelas que nunca podem aparecer, em nenhuma posição do SQL (defesa em profundidade). */
const DENIED_TABLES = [
  'users',
  'staff_users',
  'sessions',
  'staff_sessions',
  'activity_log',
  'notifications',
  'alert_configs',
  'alert_logs',
  'query_logs',
  '__drizzle_migrations',
]

const ALLOWED_TABLE_FUNCTIONS = new Set(['generate_series', 'unnest'])

const MAX_SQL_LENGTH = 4000

const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'COPY',
  'CALL',
  'DO',
  'EXEC',
  'EXECUTE',
  'INTO',
  'VACUUM',
  'ANALYZE',
  'SET',
  'RESET',
  'LOCK',
  'MERGE',
  'REINDEX',
  'CLUSTER',
  'COMMENT',
  'LISTEN',
  'NOTIFY',
  'PREPARE',
  'DEALLOCATE',
  'DISCARD',
  'REFRESH',
  'IMPORT',
  'SECURITY',
]
const FORBIDDEN_KEYWORDS_REGEX = new RegExp(`\\b(${FORBIDDEN_KEYWORDS.join('|')})\\b`, 'i')
const ROW_LOCK_REGEX = /\bFOR\s+(?:NO\s+KEY\s+)?(?:UPDATE|SHARE)\b|\bFOR\s+KEY\s+SHARE\b/i

const FORBIDDEN_IDENTIFIER_REGEX =
  /\bpg_\w*|\binformation_schema\b|\blo_\w+|\bdblink\w*|\bset_config\b|\bcurrent_setting\b|\bquery_to_xml\w*|\btable_to_xml\w*|\bcurrent_user\b|\bsession_user\b|\bversion\s*\(/i

export interface SqlAnalysis {
  ok: boolean
  /** Código estável para logs/testes. */
  code?:
    | 'EMPTY'
    | 'TOO_LONG'
    | 'NOT_SELECT'
    | 'MULTI_STATEMENT'
    | 'COMMENT_OR_ESCAPE'
    | 'DANGEROUS_SQL'
    | 'FORBIDDEN_IDENTIFIER'
    | 'TABLE_NOT_ALLOWED'
    | 'COMMA_JOIN'
  /** Mensagem pensada para ser devolvida ao LLM no prompt de reflexão. */
  reason?: string
}

const fail = (code: NonNullable<SqlAnalysis['code']>, reason: string): SqlAnalysis => ({
  ok: false,
  code,
  reason,
})

/** Substitui literais '...' por '' e remove aspas de identificadores. */
const scrub = (sql: string): string => sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"/g, '')

/**
 * Neutraliza os `FROM` que não introduzem uma tabela (EXTRACT(x FROM y), IS DISTINCT FROM,
 * TRIM/SUBSTRING ... FROM) para não os confundir com cláusulas FROM.
 */
const neutraliseNonTableFrom = (s: string): string =>
  s
    .replace(/\bDISTINCT\s+FROM\b/gi, 'DISTINCT_')
    .replace(/\bEXTRACT\s*\(\s*\w+\s+FROM\b/gi, 'EXTRACT(_')
    .replace(/\b(TRIM|SUBSTRING|OVERLAY|POSITION)\s*\([^()]*?\bFROM\b/gi, '$1(_')

export const analyzeSql = (rawSql: string): SqlAnalysis => {
  const sql = (rawSql ?? '').trim()
  if (!sql) return fail('EMPTY', 'SQL vazio')
  if (sql.length > MAX_SQL_LENGTH)
    return fail('TOO_LONG', `SQL excede ${MAX_SQL_LENGTH} caracteres`)

  // Comentários, escapes e dollar-quoting permitem esconder código — não são necessários para um SELECT simples.
  if (/--|\/\*|\*\/|\\|\$\$|\bU&|\bE'/i.test(sql)) {
    return fail(
      'COMMENT_OR_ESCAPE',
      "Não uses comentários SQL, barras invertidas, E'..' nem $$ na consulta"
    )
  }

  const scrubbed = scrub(sql).replace(/;\s*$/, '')
  if (scrubbed.includes(';')) {
    return fail('MULTI_STATEMENT', 'Apenas uma instrução SQL é permitida')
  }
  if (!/^\s*(SELECT|WITH)\b/i.test(scrubbed)) {
    return fail('NOT_SELECT', 'Apenas consultas SELECT (ou WITH ... SELECT) são permitidas')
  }
  if (FORBIDDEN_KEYWORDS_REGEX.test(scrubbed) || ROW_LOCK_REGEX.test(scrubbed)) {
    return fail(
      'DANGEROUS_SQL',
      'SQL contém operações não permitidas (escrita, DDL, SET, COPY, INTO, locks, ...)'
    )
  }
  if (FORBIDDEN_IDENTIFIER_REGEX.test(scrubbed)) {
    return fail(
      'FORBIDDEN_IDENTIFIER',
      'SQL usa funções ou schemas de sistema (pg_*, information_schema, current_user, ...) que não são permitidos'
    )
  }

  const denied = DENIED_TABLES.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(scrubbed))
  if (denied) {
    return fail(
      'TABLE_NOT_ALLOWED',
      `A tabela "${denied}" não é acessível. Tabelas permitidas: ${[...ALLOWED_TABLES].join(', ')}`
    )
  }

  const analysable = neutraliseNonTableFrom(scrubbed)

  // Nomes de CTE (WITH x AS (...)) são alvos válidos de FROM/JOIN.
  const cteNames = new Set<string>()
  for (const m of analysable.matchAll(/\b([a-z_]\w*)\s+AS\s+(?:NOT\s+)?(?:MATERIALIZED\s+)?\(/gi)) {
    cteNames.add(m[1].toLowerCase())
  }

  // FROM a x, b  → o 2.º alvo escaparia à verificação; exigir JOIN explícito.
  if (/\bFROM\s+(?!LATERAL\b)[\w.]+(?:\s+(?:AS\s+)?\w+)?\s*,/i.test(analysable)) {
    return fail('COMMA_JOIN', 'Não uses listas separadas por vírgula no FROM; usa JOIN explícito')
  }

  for (const m of analysable.matchAll(
    /\b(?:FROM|JOIN)\s+(?:ONLY\s+)?(?!\(|LATERAL\b)([a-z_][\w.]*)(\s*\()?/gi
  )) {
    const name = m[1].toLowerCase().replace(/^public\./, '')
    const isFunction = Boolean(m[2])
    if (isFunction) {
      if (!ALLOWED_TABLE_FUNCTIONS.has(name)) {
        return fail('TABLE_NOT_ALLOWED', `A função "${name}" não é permitida no FROM`)
      }
      continue
    }
    if (name.includes('.')) {
      return fail('TABLE_NOT_ALLOWED', `Schema "${name.split('.')[0]}" não é permitido`)
    }
    if (!ALLOWED_TABLES.has(name) && !cteNames.has(name)) {
      return fail(
        'TABLE_NOT_ALLOWED',
        `A tabela "${name}" não é permitida. Tabelas permitidas: ${[...ALLOWED_TABLES].join(', ')}`
      )
    }
  }

  return { ok: true }
}

/** O valor do filtro tem de aparecer dentro de um literal de texto do SQL (não em identificadores). */
export const sqlHasStringLiteral = (sql: string, value: string): boolean => {
  const needle = value.toLowerCase()
  for (const m of sql.matchAll(/'((?:[^']|'')*)'/g)) {
    if (m[1].toLowerCase().includes(needle)) return true
  }
  return false
}
