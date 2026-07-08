import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { db, closeDatabaseConnection } from '../src/db'
import { createDataSourceRepository } from '../src/modules/ingestion/infrastructure/persistence/data-source.repository'
import { createRegionRepository } from '../src/modules/regions/infrastructure/persistence/region.repository'
import { createCDRViewRecordRepository } from '../src/modules/ingestion/infrastructure/persistence/cdrview-record.repository'
import type { CDRViewRowDTO } from '../src/modules/ingestion/application/dtos/ingestion.dto'

type CsvRow = Record<string, string>

const CVSS_DIR = path.resolve(process.cwd(), process.argv[2] ?? '../cvss')
const BATCH_SIZE = 500
const STATE = 'SC'
const COUNTRY = 'BR'

const files = {
  antennas: 'antenas_flp (1).csv',
  concentration: 'tensor_concentracao.csv',
  flowRoads: 'tensor_fluxo_vias.csv',
  od: 'tensor_od.csv',
  travelTime: 'tensor_tempo_deslocamento.csv',
  commonRoutes: 'trajetos_comuns (1).csv',
  privacy: 'sumario_kanon (1).csv',
} as const

const dataSourceRepo = createDataSourceRepository(db)
const regionRepo = createRegionRepository(db)
const cdrviewRecordRepo = createCDRViewRecordRepository(db)

const required = (file: string) => path.join(CVSS_DIR, file)

const parseCsvLine = (line: string): string[] => {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      i++
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === ',' && !quoted) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

async function* readCsv(filePath: string): AsyncGenerator<CsvRow> {
  const input = createReadStream(filePath)
  const rl = createInterface({ input, crlfDelay: Infinity })
  let headers: string[] | null = null

  for await (const rawLine of rl) {
    const line = rawLine.replace(/^\uFEFF/, '').trim()
    if (!line) continue

    if (!headers) {
      headers = parseCsvLine(line)
      continue
    }

    const values = parseCsvLine(line)
    if (values.length !== headers.length) continue

    const row: CsvRow = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    yield row
  }
}

const intValue = (value: string | undefined, fallback = 0) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const floatValue = (value: string | undefined, fallback = 0) => {
  const parsed = Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeMunicipality = (value: string | undefined) =>
  (value || 'Florianopolis').normalize('NFD').replace(/\p{Diacritic}/gu, '')

const periodHour = (period: string | undefined) => {
  switch ((period ?? '').toUpperCase()) {
    case 'MADRUGADA': return 3
    case 'MANHA': return 9
    case 'TARDE': return 15
    case 'NOITE': return 21
    default: return 12
  }
}

const dateForPeriod = (dayDate: string, period: string | undefined) => {
  const hour = periodHour(period)
  const date = new Date(`${dayDate}T${String(hour).padStart(2, '0')}:00:00Z`)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

const signalFromConcentration = (row: CsvRow) => {
  const congestion = floatValue(row.congestionamento_medio, 0)
  const drop = floatValue(row.drop_pct_medio, 0)
  const signal = 1 - Math.min(1, congestion * 0.75 + drop * 0.25)
  return Math.max(0, Math.min(1, signal))
}

async function ensureDataSource(slug: string, name: string, description: string) {
  const existing = await dataSourceRepo.findBySlug(slug)
  if (existing) return existing

  return dataSourceRepo.create({
    slug,
    name,
    description,
    type: 'csv',
    country: COUNTRY,
    url: `file://${CVSS_DIR}`,
  })
}

async function ingestAntennas() {
  const source = await ensureDataSource(
    'cvss-antenas-flp',
    'CVSS - Antenas Florianopolis',
    'ERBs reais da Claro na Regiao Metropolitana de Florianopolis'
  )
  const filePath = required(files.antennas)
  let regionsUpserted = 0
  let stationsUpserted = 0

  for await (const row of readCsv(filePath)) {
    const region = await regionRepo.upsertRegion({
      zoneId: row.cluster,
      name: row.cluster,
      municipality: normalizeMunicipality(row.municipio),
      state: STATE,
      country: COUNTRY,
      lat: floatValue(row.lat),
      lng: floatValue(row.lon),
      estimatedPopulation: null,
      areaKm2: null,
    })
    regionsUpserted++

    await regionRepo.upsertBaseStation({
      stationId: row.ecgi,
      regionId: region.id,
      technology: '4G',
      carrier: 'Claro',
      lat: floatValue(row.lat),
      lng: floatValue(row.lon),
      powerDbm: null,
      isActive: true,
    })
    stationsUpserted++
  }

  await dataSourceRepo.updateLastIngestedAt(source.id)
  return { regionsUpserted, stationsUpserted }
}

async function ensureRegionAndStationFromConcentration(row: CsvRow) {
  const region = await regionRepo.upsertRegion({
    zoneId: row.cluster,
    name: row.cluster,
    municipality: normalizeMunicipality(row.municipio),
    state: STATE,
    country: COUNTRY,
    lat: floatValue(row.lat),
    lng: floatValue(row.lon),
    estimatedPopulation: null,
    areaKm2: null,
  })

  const station = await regionRepo.upsertBaseStation({
    stationId: row.ecgi,
    regionId: region.id,
    technology: '4G',
    carrier: 'Claro',
    lat: floatValue(row.lat),
    lng: floatValue(row.lon),
    powerDbm: null,
    isActive: true,
  })

  return { region, station }
}

async function ingestConcentration() {
  const source = await ensureDataSource(
    'cvss-tensor-concentracao',
    'CVSS - Tensor de Concentracao',
    'Concentracao por antena, dia e periodo da base CDRView App BiT v2'
  )
  const filePath = required(files.concentration)
  const records: CDRViewRowDTO[] = []
  let rowsRead = 0
  let recordsInserted = 0
  let regionsUpserted = 0
  let stationsUpserted = 0
  const seenRegions = new Set<string>()
  const seenStations = new Set<string>()

  const flush = async () => {
    if (records.length === 0) return
    recordsInserted += await cdrviewRecordRepo.bulkInsert(records.splice(0, records.length))
  }

  for await (const row of readCsv(filePath)) {
    const { region, station } = await ensureRegionAndStationFromConcentration(row)
    rowsRead++

    if (!seenRegions.has(row.cluster)) {
      seenRegions.add(row.cluster)
      regionsUpserted++
    }
    if (!seenStations.has(row.ecgi)) {
      seenStations.add(row.ecgi)
      stationsUpserted++
    }

    const period = dateForPeriod(row.day_date, row.periodo)
    records.push({
      regionId: region.id,
      stationId: station.id,
      period,
      hourOfDay: period.getUTCHours(),
      dayOfWeek: period.getUTCDay(),
      peopleCount: intValue(row.n_usuarios),
      networkTechnology: '4G',
      signalStrength: signalFromConcentration(row),
    })

    if (records.length >= BATCH_SIZE) {
      await flush()
      console.log(`  tensor_concentracao: ${rowsRead} linhas lidas, ${recordsInserted} registros inseridos`)
    }
  }

  await flush()
  await dataSourceRepo.updateLastIngestedAt(source.id)
  return { rowsRead, recordsInserted, regionsUpserted, stationsUpserted }
}

async function registerUnmappedSources() {
  const unmapped = [
    [files.flowRoads, 'cvss-tensor-fluxo-vias', 'CVSS - Tensor Fluxo Vias'],
    [files.od, 'cvss-tensor-od', 'CVSS - Tensor OD'],
    [files.travelTime, 'cvss-tensor-tempo-deslocamento', 'CVSS - Tensor Tempo Deslocamento'],
    [files.commonRoutes, 'cvss-trajetos-comuns', 'CVSS - Trajetos Comuns'],
    [files.privacy, 'cvss-sumario-kanon', 'CVSS - Sumario K-anonimato'],
  ] as const

  let registered = 0
  for (const [fileName, slug, name] of unmapped) {
    const filePath = required(fileName)
    if (!existsSync(filePath)) continue
    const source = await ensureDataSource(
      slug,
      name,
      `Fonte detectada em ${fileName}. O schema atual ainda nao possui tabela especifica para este arquivo.`
    )
    await dataSourceRepo.updateLastIngestedAt(source.id)
    registered++
  }
  return registered
}

async function main() {
  console.log(`A ingerir CSVs de: ${CVSS_DIR}`)

  for (const fileName of [files.antennas, files.concentration]) {
    const filePath = required(fileName)
    if (!existsSync(filePath)) {
      throw new Error(`Ficheiro obrigatorio nao encontrado: ${filePath}`)
    }
  }

  const antennas = await ingestAntennas()
  console.log(`  antenas_flp: ${antennas.regionsUpserted} regioes, ${antennas.stationsUpserted} estacoes`)

  const concentration = await ingestConcentration()
  console.log(
    `  tensor_concentracao: ${concentration.recordsInserted} registros, ` +
    `${concentration.regionsUpserted} regioes distintas, ${concentration.stationsUpserted} estacoes distintas`
  )

  const registered = await registerUnmappedSources()
  console.log(`  fontes sem tabela dedicada registradas: ${registered}`)
  console.log('Ingestao CVSS concluida.')
}

main()
  .catch((error) => {
    console.error('Falha na ingestao CVSS:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDatabaseConnection()
    process.exit(process.exitCode ?? 0)
  })
