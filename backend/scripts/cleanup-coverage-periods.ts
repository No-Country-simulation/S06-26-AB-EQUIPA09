/**
 * Remove linhas de region_coverage com período inválido (ex.: "undefined", gravado por uma
 * versão antiga da ingestão), mas só quando a região já tem uma linha com período válido (YYYY-MM).
 * Linhas inválidas sem equivalente válido são apenas reportadas — remova-as à mão depois de rever.
 *
 * Uso: bun run db:cleanup-periods            (mostra o que faria)
 *      bun run db:cleanup-periods --apply    (aplica)
 */
import 'dotenv/config'
import { sql } from '../src/db'

const apply = process.argv.includes('--apply')
const VALID = '^\\d{4}-\\d{2}$'

const [{ total }] = await sql<
  { total: string }[]
>`SELECT count(*)::text AS total FROM region_coverage WHERE period !~ ${VALID}`
const [{ dup }] = await sql<{ dup: string }[]>`
  SELECT count(*)::text AS dup FROM region_coverage u
  WHERE u.period !~ ${VALID}
    AND EXISTS (SELECT 1 FROM region_coverage v WHERE v.region_id = u.region_id AND v.period ~ ${VALID})`

console.log(
  `Linhas com período inválido: ${total} (${dup} duplicam uma linha válida da mesma região)`
)

if (!apply) {
  console.log('Dry-run: nada foi alterado. Use --apply para remover as duplicadas.')
} else {
  const removed = await sql`
    DELETE FROM region_coverage u
    WHERE u.period !~ ${VALID}
      AND EXISTS (SELECT 1 FROM region_coverage v WHERE v.region_id = u.region_id AND v.period ~ ${VALID})
    RETURNING u.id`
  console.log(`Removidas: ${removed.length}`)
}

await sql.end({ timeout: 5 })
