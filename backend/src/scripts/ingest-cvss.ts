/**
 * Ingest all CVSS CSV files into the database.
 * Usage: bun run src/scripts/ingest-cvss.ts [directory]
 * Respects DATABASE_URL and DB_SSL env vars for production use.
 */
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import postgres from 'postgres'
import 'dotenv/config'

const DB_URL = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'edgar'}:${process.env.DB_PASSWORD || '123456'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_DATABASE || 'postgres'}`
const DB_SSL = process.env.DB_SSL === 'true' || /sslmode=require/.test(DB_URL)

const BATCH_SIZE = 500

const parseCsvLine = (line: string): string[] => {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && quoted && next === '"') { current += '"'; i++; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === ',' && !quoted) { values.push(current.trim()); current = ''; continue }
    current += char
  }
  values.push(current.trim())
  return values
}

function* readCsv(content: string): Generator<Record<string, string>> {
  const lines = content.split(/\r?\n/)
  let headers: string[] | null = null
  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, '').trim()
    if (!line) continue
    if (!headers) { headers = parseCsvLine(line); continue }
    const values = parseCsvLine(line)
    if (values.length !== headers.length) continue
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    yield row
  }
}

const intValue = (v: string | undefined, fb = 0) => { const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) ? n : fb }
const floatValue = (v: string | undefined, fb = 0) => { const n = Number.parseFloat(v ?? ''); return Number.isFinite(n) ? n : fb }
const safeNum = (v: number) => Number.isFinite(v) ? v : 0
const norm = (v: string | undefined) => (v || 'Florianopolis').normalize('NFD').replace(/\p{Diacritic}/gu, '')

async function main() {
  const dir = process.argv[2] || path.resolve(import.meta.dir, '../../../cvss')
  if (!existsSync(dir)) { console.error(`Dir not found: ${dir}`); process.exit(1) }

  console.log(`Connecting to: ${DB_URL.replace(/:[^:]*@/, ':***@')}`)
  console.log(`SSL: ${DB_SSL ? 'enabled' : 'disabled'}`)
  const sql = postgres(DB_URL, {
    max: 5,
    connect_timeout: 30,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
  })

  // Verify connection
  try { await sql`SELECT 1` } catch (e: any) {
    console.error('DB connection failed:', e.message?.substring(0, 200))
    process.exit(1)
  }
  console.log('DB connected OK')

  // --- 1. Antennas → regions + base_stations ---
  const antennaFile = ['antenas_flp (1).csv', 'antenas_flp.csv'].map(n => path.join(dir, n)).find(existsSync)
  if (antennaFile) {
    console.log('\n--- Ingesting antenas_flp ---')
    const content = readFileSync(antennaFile, 'utf-8')
    let regions = 0, stations = 0
    for (const row of readCsv(content)) {
      const [reg] = await sql`INSERT INTO regions (zone_id, name, municipality, state, country, lat, lng) VALUES (${row.cluster}, ${row.cluster}, ${norm(row.municipio)}, 'SC', 'BR', ${floatValue(row.lat)}, ${floatValue(row.lon)}) ON CONFLICT (zone_id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng RETURNING id`
      await sql`INSERT INTO base_stations (station_id, region_id, technology, carrier, lat, lng, is_active) VALUES (${row.ecgi}, ${reg.id}, '4G', 'Claro', ${floatValue(row.lat)}, ${floatValue(row.lon)}, true) ON CONFLICT (station_id) DO NOTHING`
      stations++
      if (++regions % 50 === 0) process.stdout.write(`  ${regions} regions...\r`)
    }
    console.log(`  Regions: ${regions}, Stations: ${stations}`)
  }

  // --- 2. Concentration → cdrview_records + region_coverage ---
  const concFile = ['tensor_concentracao.csv'].map(n => path.join(dir, n)).find(existsSync)
  if (concFile) {
    console.log('\n--- Ingesting tensor_concentracao ---')
    const content = readFileSync(concFile, 'utf-8')
    let count = 0
    const coverageMap = new Map<string, { regionId: string; max: number; min: number; daySum: number; dayN: number; nightSum: number; nightN: number; sigSum: number; sigN: number; total: number }>()

    for (const row of readCsv(content)) {
      const [reg] = await sql`SELECT id FROM regions WHERE zone_id = ${row.cluster} LIMIT 1`
      if (!reg) continue
      const [sta] = await sql`INSERT INTO base_stations (station_id, region_id, technology, carrier, lat, lng, is_active) VALUES (${row.ecgi}, ${reg.id}, '4G', 'Claro', ${floatValue(row.lat)}, ${floatValue(row.lon)}, true) ON CONFLICT (station_id) DO UPDATE SET region_id = EXCLUDED.region_id RETURNING id`

      const hour = { MADRUGADA: 3, MANHA: 9, TARDE: 15, NOITE: 21 }[(row.periodo ?? '').toUpperCase()] ?? 12
      const date = new Date(`${row.day_date}T${String(hour).padStart(2, '0')}:00:00Z`)
      const people = intValue(row.n_usuarios)
      const congestion = floatValue(row.congestionamento_medio)
      const drop = floatValue(row.drop_pct_medio)
      const signal = safeNum(Math.max(0, Math.min(1, 1 - Math.min(1, congestion * 0.75 + drop * 0.25))))

      await sql.unsafe(
        `INSERT INTO cdrview_records (region_id, station_id, period, hour_of_day, day_of_week, people_count, network_technology, signal_strength) VALUES ('${reg.id}', '${sta.id}', '${date.toISOString()}', ${date.getUTCHours()}, ${date.getUTCDay()}, ${people}, '4G', ${signal})`
      )

      // Coverage accumulator
      const period = (row.day_date ?? '').slice(0, 7) || '2026-03'
      const key = `${reg.id}:${period}`
      const acc = coverageMap.get(key) ?? { regionId: reg.id, max: 0, min: Infinity, daySum: 0, dayN: 0, nightSum: 0, nightN: 0, sigSum: 0, sigN: 0, total: 0 }
      acc.max = Math.max(acc.max, people)
      acc.min = Math.min(acc.min, people)
      acc.sigSum += signal; acc.sigN++
      acc.total++
      if (hour >= 8 && hour <= 18) { acc.daySum += people; acc.dayN++ } else { acc.nightSum += people; acc.nightN++ }
      coverageMap.set(key, acc)

      if (++count % 500 === 0) process.stdout.write(`  ${count} records...\r`)
    }

    // Flush coverage
    let maxAvg = 0, maxPeak = 0
    for (const a of coverageMap.values()) {
      const avg = a.total > 0 ? (a.daySum + a.nightSum) / a.total : 0
      maxAvg = Math.max(maxAvg, avg); maxPeak = Math.max(maxPeak, a.max)
    }
    let covCount = 0
    for (const a of coverageMap.values()) {
      const baseSig = a.sigN > 0 ? a.sigSum / a.sigN : 0
      const avg = a.total > 0 ? (a.daySum + a.nightSum) / a.total : 0
      const loadP = maxAvg > 0 ? avg / maxAvg : 0
      const peakP = maxPeak > 0 ? a.max / maxPeak : 0
      const score = safeNum(Math.max(0, Math.min(1, 1 - ((1 - baseSig) * 0.35 + loadP * 0.45 + peakP * 0.20))))
      const avgDay = a.dayN > 0 ? (a.daySum / a.dayN) : 0
      const avgNight = a.nightN > 0 ? (a.nightSum / a.nightN) : 0
      const minVal = Number.isFinite(a.min) ? a.min : 0
      await sql.unsafe(
        `INSERT INTO region_coverage (region_id, period, network_coverage_score, max_concentration, min_concentration, avg_daytime_concentration, avg_nighttime_concentration, dominant_technology, no_4g_or_5g_coverage, total_records) VALUES ('${a.regionId}', '${a.period}', ${score}, ${a.max}, ${minVal}, ${avgDay}, ${avgNight}, '4G', false, ${a.total}) ON CONFLICT (region_id, period) DO UPDATE SET network_coverage_score = EXCLUDED.network_coverage_score, max_concentration = EXCLUDED.max_concentration, total_records = EXCLUDED.total_records`
      )
      covCount++
    }
    console.log(`  CDRView records: ${count}, Coverage rows: ${covCount}`)
  }

  // --- 3. Mobility Flows ---
  const flowFile = ['tensor_fluxo_vias.csv'].map(n => path.join(dir, n)).find(existsSync)
  if (flowFile) {
    console.log('\n--- Ingesting tensor_fluxo_vias ---')
    const content = readFileSync(flowFile, 'utf-8')
    let count = 0
    const batch: any[][] = []
    for (const row of readCsv(content)) {
      batch.push([
        row.ecgi_origem, floatValue(row.lat_origem), floatValue(row.lon_origem),
        row.cluster_origem, norm(row.municipio_origem),
        row.ecgi_destino, floatValue(row.lat_destino), floatValue(row.lon_destino),
        row.cluster_destino, norm(row.municipio_destino),
        intValue(row.n_usuarios), intValue(row.n_transicoes),
        floatValue(row.dist_km), (row.periodo_predominante || '').toUpperCase(),
        floatValue(row.pct_do_cluster_origem),
      ])
      if (batch.length >= BATCH_SIZE) { await flushBatch(sql, 'mobility_flows', batch); count += batch.length; batch.length = 0 }
    }
    if (batch.length > 0) { await flushBatch(sql, 'mobility_flows', batch); count += batch.length }
    console.log(`  Flows: ${count} rows`)
  }

  // --- 4. Mobility OD ---
  const odFile = ['tensor_od.csv'].map(n => path.join(dir, n)).find(existsSync)
  if (odFile) {
    console.log('\n--- Ingesting tensor_od ---')
    const content = readFileSync(odFile, 'utf-8')
    let count = 0
    const batch: any[][] = []
    for (const row of readCsv(content)) {
      batch.push([
        row.cluster_origem, norm(row.municipio_origem),
        floatValue(row.lat_origem), floatValue(row.lon_origem),
        row.cluster_destino, norm(row.municipio_destino),
        floatValue(row.lat_destino), floatValue(row.lon_destino),
        row.mesmo_cluster === '1',
        intValue(row.n_usuarios), intValue(row.n_viagens),
        floatValue(row.dist_media_km), (row.periodo_predominante || '').toUpperCase(),
      ])
      if (batch.length >= BATCH_SIZE) { await flushBatch(sql, 'mobility_od', batch); count += batch.length; batch.length = 0 }
    }
    if (batch.length > 0) { await flushBatch(sql, 'mobility_od', batch); count += batch.length }
    console.log(`  OD: ${count} rows`)
  }

  // --- 5. Travel Times ---
  const ttFile = ['tensor_tempo_deslocamento.csv'].map(n => path.join(dir, n)).find(existsSync)
  if (ttFile) {
    console.log('\n--- Ingesting tensor_tempo_deslocamento ---')
    const content = readFileSync(ttFile, 'utf-8')
    let count = 0
    const batch: any[][] = []
    for (const row of readCsv(content)) {
      batch.push([
        row.cluster_origem, row.cluster_destino,
        row.mesmo_cluster === '1',
        intValue(row.n_observacoes),
        floatValue(row.dist_media_km), floatValue(row.dist_p25_km), floatValue(row.dist_p75_km),
        (row.periodo_predominante || '').toUpperCase(),
      ])
      if (batch.length >= BATCH_SIZE) { await flushBatch(sql, 'travel_times', batch); count += batch.length; batch.length = 0 }
    }
    if (batch.length > 0) { await flushBatch(sql, 'travel_times', batch); count += batch.length }
    console.log(`  Travel Times: ${count} rows`)
  }

  // --- 6. Mobility Routes ---
  const routeFile = ['trajetos_comuns (1).csv', 'trajetos_comuns.csv'].map(n => path.join(dir, n)).find(existsSync)
  if (routeFile) {
    console.log('\n--- Ingesting trajetos_comuns ---')
    const content = readFileSync(routeFile, 'utf-8')
    let count = 0
    const batch: any[][] = []
    for (const row of readCsv(content)) {
      batch.push([
        row.cluster_origem, norm(row.municipio_origem),
        floatValue(row.lat_origem), floatValue(row.lon_origem),
        row.cluster_destino, norm(row.municipio_destino),
        floatValue(row.lat_destino), floatValue(row.lon_destino),
        row.mesmo_cluster === '1',
        intValue(row.n_usuarios), intValue(row.n_viagens),
        floatValue(row.dist_media_km), (row.periodo_predominante || '').toUpperCase(),
      ])
      if (batch.length >= BATCH_SIZE) { await flushBatch(sql, 'mobility_routes', batch); count += batch.length; batch.length = 0 }
    }
    if (batch.length > 0) { await flushBatch(sql, 'mobility_routes', batch); count += batch.length }
    console.log(`  Routes: ${count} rows`)
  }

  // --- 7. Privacy Summary ---
  const privFile = ['sumario_kanon (1).csv', 'sumario_kanon.csv'].map(n => path.join(dir, n)).find(existsSync)
  if (privFile) {
    console.log('\n--- Ingesting sumario_kanon ---')
    const content = readFileSync(privFile, 'utf-8')
    const summary: Record<string, string> = {}
    for (const row of readCsv(content)) {
      if (row.parametro && row.valor) summary[row.parametro] = row.valor
    }
    console.log(`  Privacy summary: ${JSON.stringify(summary)}`)
  }

  // --- Final counts ---
  console.log('\n=== Final Row Counts ===')
  const tables = ['regions', 'base_stations', 'cdrview_records', 'region_coverage', 'mobility_flows', 'mobility_od', 'travel_times', 'mobility_routes', 'data_sources']
  for (const t of tables) {
    const [r] = await sql.unsafe(`SELECT COUNT(*) as count FROM ${t}`)
    console.log(`  ${t}: ${r.count}`)
  }

  await sql.end()
  console.log('\nDone!')
}

const esc = (v: any): string => {
  if (v === undefined || v === null) return 'NULL'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0'
  if (v instanceof Date) return `'${v.toISOString()}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

async function flushBatch(sql: any, table: string, batch: any[][]) {
  if (batch.length === 0) return
  const colNames = {
    mobility_flows: 'ecgi_origin,lat_origin,lng_origin,cluster_origin,municipality_origin,ecgi_destination,lat_destination,lng_destination,cluster_destination,municipality_destination,n_users,n_transitions,dist_km,period_predominant,pct_of_cluster_origin',
    mobility_od: 'cluster_origin,municipality_origin,lat_origin,lng_origin,cluster_destination,municipality_destination,lat_destination,lng_destination,mesmo_cluster,n_users,n_viagens,dist_media_km,period_predominant',
    travel_times: 'cluster_origin,cluster_destination,mesmo_cluster,n_observacoes,dist_media_km,dist_p25_km,dist_p75_km,period_predominant',
    mobility_routes: 'cluster_origin,municipality_origin,lat_origin,lng_origin,cluster_destination,municipality_destination,lat_destination,lng_destination,mesmo_cluster,n_users,n_viagens,dist_media_km,period_predominant',
  }[table]
  const rows = batch.map(row => `(${row.map(esc).join(',')})`).join(',')
  await sql.unsafe(`INSERT INTO ${table} (${colNames}) VALUES ${rows}`)
}

main()
