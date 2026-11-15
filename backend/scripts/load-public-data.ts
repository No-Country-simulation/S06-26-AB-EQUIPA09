/**
 * Carrega indicadores e programas reais a partir de fontes públicas:
 *   - IBGE/SIDRA: população (Censo 2022, tabela 9514) e pessoal ocupado assalariado (CEMPRE, tabela 1685)
 *   - DATASUS/CNES: Centros de Atenção Psicossocial (CAPS, tipo de unidade 70)
 *
 * Indicadores criados (os únicos com fonte pública direta para esta região):
 *   - taxa-emprego-formal   (%)  = assalariados / população, por município
 *   - indice-saude-mental   (0–100) = cobertura de CAPS por 100 mil hab. face à meta de 0,70 do Ministério da Saúde
 * NÃO são inventados valores para formação tech, iniciativas sociais e mentoria: não há fonte IBGE/DATASUS
 * equivalente — continuam vazios até o staff os inserir (ver README).
 *
 * Uso: bun run data:load-public              (busca nas APIs e grava snapshot em data/public-sources/)
 *      bun run data:load-public --offline    (usa o snapshot gravado, sem rede)
 *      bun run data:load-public --dry-run    (calcula e imprime, sem escrever no banco)
 */
import 'dotenv/config'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq, sql as dsql } from 'drizzle-orm'
import { db, sql } from '../src/db'
import { dataSources, indicators, indicatorData, programs, regions } from '../src/db/schema'
import {
  MUNICIPALITIES,
  capsCoverage,
  capsToProgram,
  employmentRate,
  nearestRegion,
  parseSidraValue,
  type CnesEstablishment,
  type MunicipalityRef,
} from '../src/modules/ingestion/application/services/public-data'

const OFFLINE = process.argv.includes('--offline')
const DRY_RUN = process.argv.includes('--dry-run')
const SNAPSHOT_DIR = join(import.meta.dir, '..', 'data', 'public-sources')

type SidraRow = { D1C: string; D2N?: string; D3N?: string; V: string }
type Snapshot = {
  fetchedAt: string
  population: SidraRow[]
  cempre: SidraRow[]
  caps: Record<string, CnesEstablishment[]>
}

const getJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`)
  return res.json() as Promise<T>
}

const fetchSnapshot = async (): Promise<Snapshot> => {
  const ibge = MUNICIPALITIES.map((m) => m.ibge).join(',')
  const population = (
    await getJson<SidraRow[]>(
      `https://apisidra.ibge.gov.br/values/t/9514/n6/${ibge}/v/93/p/2022/c2/6794/c287/100362/c286/113635`
    )
  ).slice(1)
  const cempre = (
    await getJson<SidraRow[]>(`https://apisidra.ibge.gov.br/values/t/1685/n6/${ibge}/v/all/p/last`)
  ).slice(1)
  const caps: Snapshot['caps'] = {}
  for (const m of MUNICIPALITIES) {
    const body = await getJson<{ estabelecimentos?: CnesEstablishment[] }>(
      `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${m.cnes}&codigo_tipo_unidade=70&limit=100`
    )
    caps[m.cnes] = body.estabelecimentos ?? []
  }
  return { fetchedAt: new Date().toISOString(), population, cempre, caps }
}

const snapshotFile = join(SNAPSHOT_DIR, 'snapshot.json')
let snap: Snapshot
if (OFFLINE) {
  if (!existsSync(snapshotFile))
    throw new Error(`Sem snapshot em ${snapshotFile}; rode sem --offline primeiro`)
  snap = JSON.parse(readFileSync(snapshotFile, 'utf8')) as Snapshot
  console.log(`Usando snapshot de ${snap.fetchedAt}`)
} else {
  snap = await fetchSnapshot()
  mkdirSync(SNAPSHOT_DIR, { recursive: true })
  writeFileSync(snapshotFile, JSON.stringify(snap, null, 2) + '\n')
  console.log(`Snapshot gravado em ${snapshotFile}`)
}

const cempreYear =
  snap.cempre.find((r) => r.D2N === 'Pessoal ocupado assalariado')?.D3N ?? 'desconhecido'
const snapshotPeriod = snap.fetchedAt.slice(0, 7)

type Derived = {
  m: MunicipalityRef
  population: number
  employment: { salaried: number; rate: number }
  caps: { count: number; per100k: number; score: number }
}
const derived: Derived[] = []
for (const m of MUNICIPALITIES) {
  const population = parseSidraValue(snap.population.find((r) => r.D1C === m.ibge)?.V)
  const salaried = parseSidraValue(
    snap.cempre.find((r) => r.D1C === m.ibge && r.D2N === 'Pessoal ocupado assalariado')?.V
  )
  if (population === null || salaried === null) {
    console.warn(`Sem dados IBGE completos para ${m.label}; ignorado`)
    continue
  }
  const capsCount = snap.caps[m.cnes]?.length ?? 0
  const cov = capsCoverage(capsCount, population)
  derived.push({
    m,
    population,
    employment: { salaried, rate: employmentRate(salaried, population) },
    caps: { count: capsCount, ...cov },
  })
}

console.table(
  derived.map((d) => ({
    município: d.m.label,
    população: d.population,
    assalariados: d.employment.salaried,
    'emprego formal %': d.employment.rate,
    CAPS: d.caps.count,
    'CAPS/100k': d.caps.per100k,
    'índice saúde mental': d.caps.score,
  }))
)

if (DRY_RUN) {
  console.log('Dry-run: nada foi escrito no banco.')
  await sql.end({ timeout: 5 })
  process.exit(0)
}

const upsertSource = async (slug: string, name: string, description: string, url: string) => {
  const [row] = await db
    .insert(dataSources)
    .values({
      slug,
      name,
      description,
      url,
      type: 'api',
      country: 'BR',
      lastIngestedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dataSources.slug,
      set: { name, description, url, lastIngestedAt: new Date() },
    })
    .returning()
  return row
}
const ibgeSource = await upsertSource(
  'ibge-sidra',
  'IBGE — SIDRA (Censo 2022 e CEMPRE)',
  'População residente (Censo 2022, tabela 9514) e pessoal ocupado assalariado (CEMPRE, tabela 1685).',
  'https://sidra.ibge.gov.br'
)
const cnesSource = await upsertSource(
  'datasus-cnes',
  'DATASUS — CNES (CAPS)',
  'Estabelecimentos tipo 70 (Centro de Atenção Psicossocial) do Cadastro Nacional de Estabelecimentos de Saúde.',
  'https://apidadosabertos.saude.gov.br/cnes/estabelecimentos'
)

const upsertIndicator = async (v: typeof indicators.$inferInsert) => {
  const { slug: _slug, ...rest } = v
  const [row] = await db
    .insert(indicators)
    .values(v)
    .onConflictDoUpdate({ target: indicators.slug, set: rest })
    .returning()
  return row
}
const empInd = await upsertIndicator({
  slug: 'taxa-emprego-formal',
  name: 'Taxa de emprego formal',
  description:
    'Pessoal ocupado assalariado (IBGE/CEMPRE) por 100 habitantes (Censo 2022), por município.',
  category: 'employability',
  unit: '%',
  direction: 'higher_is_better',
  criticalThresholds: { critical: 0.3, warning: 0.5 },
  sourceId: ibgeSource.id,
})
const mhInd = await upsertIndicator({
  slug: 'indice-saude-mental',
  name: 'Índice de cobertura de saúde mental (CAPS)',
  description:
    'CAPS por 100 mil habitantes (DATASUS/CNES) como % da meta de 0,70 do Ministério da Saúde (0–100).',
  category: 'mental_health',
  unit: '%',
  direction: 'higher_is_better',
  criticalThresholds: { critical: 0.3, warning: 0.5 },
  sourceId: cnesSource.id,
})

const allRegions = await db.select().from(regions)
let dataRows = 0
for (const d of derived) {
  for (const r of allRegions.filter((x) => x.municipality === d.m.name)) {
    const rows = [
      {
        ind: empInd,
        source: ibgeSource,
        period: cempreYear,
        value: d.employment.rate,
        notes: `Valor municipal (${d.m.label}): ${d.employment.salaried} assalariados (CEMPRE ${cempreYear}) / ${d.population} hab. (Censo 2022). Pessoal ocupado é contado onde trabalha, não onde mora.`,
      },
      {
        ind: mhInd,
        source: cnesSource,
        period: snapshotPeriod,
        value: d.caps.score,
        notes: `Valor municipal (${d.m.label}): ${d.caps.count} CAPS no CNES = ${d.caps.per100k} por 100 mil hab. (meta 0,70). Conta unidades, sem ponderar por tipo de CAPS.`,
      },
    ]
    for (const x of rows) {
      await db
        .insert(indicatorData)
        .values({
          regionId: r.id,
          indicatorId: x.ind.id,
          sourceId: x.source.id,
          period: x.period,
          value: x.value,
          normalizedValue: x.value / 100,
          quality: 'official',
          notes: x.notes,
        })
        .onConflictDoUpdate({
          target: [indicatorData.regionId, indicatorData.indicatorId, indicatorData.period],
          set: {
            value: x.value,
            normalizedValue: x.value / 100,
            sourceId: x.source.id,
            quality: 'official',
            notes: x.notes,
            updatedAt: new Date(),
          },
        })
      dataRows++
    }
  }
}

let programRows = 0
for (const d of derived) {
  for (const e of snap.caps[d.m.cnes] ?? []) {
    const p = capsToProgram(e, d.m)
    const lat = e.latitude_estabelecimento_decimo_grau
    const lng = e.longitude_estabelecimento_decimo_grau
    const region =
      lat != null && lng != null ? nearestRegion({ lat, lng }, d.m.name, allRegions) : null
    const values = { ...p, regionId: region?.id ?? null }
    const [existing] = await db
      .select({ id: programs.id })
      .from(programs)
      .where(
        and(
          eq(programs.municipality, d.m.name),
          dsql`${programs.metadata}->>'cnes' = ${String(e.codigo_cnes)}`
        )
      )
      .limit(1)
    if (existing)
      await db
        .update(programs)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(programs.id, existing.id))
    else await db.insert(programs).values(values)
    programRows++
  }
}

console.log(
  `Concluído: ${dataRows} linhas em indicator_data, ${programRows} programas (CAPS) — fontes: IBGE/SIDRA (${cempreYear}) e DATASUS/CNES (${snapshotPeriod}).`
)
await sql.end({ timeout: 5 })
