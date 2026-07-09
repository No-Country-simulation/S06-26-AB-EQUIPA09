import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import type { IDataSourceRepository, ICDRViewRecordRepository } from '../ports/ingestion.port'
import type { IRegionRepository } from '@/modules/regions/application/ports/region.port'
import type { IRegionCoverageRepository } from '@/modules/coverage/application/ports/coverage.port'
import type { CDRViewRowDTO } from '../dtos/ingestion.dto'

type CsvRow = Record<string, string>

export type CvssUploadedFile = {
  name: string
  content: string
}

export type CvssIngestionResult = {
  recordsInserted: number
  regionsUpserted: number
  stationsUpserted: number
  coverageRowsUpserted: number
  registeredSources: number
  filesProcessed: string[]
}

const BATCH_SIZE = 500
const STATE = 'SC'
const COUNTRY = 'BR'

const files = {
  antennas: ['antenas_flp (1).csv', 'antenas_flp.csv'],
  concentration: ['tensor_concentracao.csv'],
  flowRoads: ['tensor_fluxo_vias.csv'],
  od: ['tensor_od.csv'],
  travelTime: ['tensor_tempo_deslocamento.csv'],
  commonRoutes: ['trajetos_comuns (1).csv', 'trajetos_comuns.csv'],
  privacy: ['sumario_kanon (1).csv', 'sumario_kanon.csv'],
} as const

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

async function* readCsvContent(content: string): AsyncGenerator<CsvRow> {
  const lines = content.split(/\r?\n/)
  let headers: string[] | null = null

  for (const rawLine of lines) {
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

async function* readCsvFile(filePath: string): AsyncGenerator<CsvRow> {
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

type CoverageAccumulator = {
  regionId: string
  period: string
  maxConcentration: number
  minConcentration: number
  daytimeSum: number
  daytimeCount: number
  nighttimeSum: number
  nighttimeCount: number
  signalSum: number
  signalCount: number
  totalRecords: number
}

const coveragePeriod = (dayDate: string) => dayDate.slice(0, 7) || '2026-03'

const addCoverageSample = (
  accumulators: Map<string, CoverageAccumulator>,
  regionId: string,
  period: string,
  hourOfDay: number,
  peopleCount: number,
  signalStrength: number,
) => {
  const key = `${regionId}:${period}`
  const current = accumulators.get(key) ?? {
    regionId,
    period,
    maxConcentration: 0,
    minConcentration: Number.POSITIVE_INFINITY,
    daytimeSum: 0,
    daytimeCount: 0,
    nighttimeSum: 0,
    nighttimeCount: 0,
    signalSum: 0,
    signalCount: 0,
    totalRecords: 0,
  }

  current.maxConcentration = Math.max(current.maxConcentration, peopleCount)
  current.minConcentration = Math.min(current.minConcentration, peopleCount)
  current.signalSum += signalStrength
  current.signalCount++
  current.totalRecords++

  if (hourOfDay >= 8 && hourOfDay <= 18) {
    current.daytimeSum += peopleCount
    current.daytimeCount++
  } else {
    current.nighttimeSum += peopleCount
    current.nighttimeCount++
  }

  accumulators.set(key, current)
}

export const createCvssIngestionService = (
  dataSourceRepo: IDataSourceRepository,
  regionRepo: IRegionRepository,
  cdrviewRecordRepo: ICDRViewRecordRepository,
  regionCoverageRepo: IRegionCoverageRepository,
) => {
  const ensureDataSource = async (slug: string, name: string, description: string, sourceUrl: string) => {
    const existing = await dataSourceRepo.findBySlug(slug)
    if (existing) return existing

    return dataSourceRepo.create({
      slug,
      name,
      description,
      type: 'csv',
      country: COUNTRY,
      url: sourceUrl,
    })
  }

  const flushCoverage = async (accumulators: Map<string, CoverageAccumulator>) => {
    let rowsUpserted = 0
    let maxAvgConcentration = 0
    let maxPeakConcentration = 0

    for (const item of accumulators.values()) {
      const avgConcentration = item.totalRecords > 0
        ? (item.daytimeSum + item.nighttimeSum) / item.totalRecords
        : 0
      maxAvgConcentration = Math.max(maxAvgConcentration, avgConcentration)
      maxPeakConcentration = Math.max(maxPeakConcentration, item.maxConcentration)
    }

    for (const item of accumulators.values()) {
      const baseSignal = item.signalCount > 0 ? item.signalSum / item.signalCount : 0
      const avgConcentration = item.totalRecords > 0
        ? (item.daytimeSum + item.nighttimeSum) / item.totalRecords
        : 0
      const loadPressure = maxAvgConcentration > 0 ? avgConcentration / maxAvgConcentration : 0
      const peakPressure = maxPeakConcentration > 0 ? item.maxConcentration / maxPeakConcentration : 0
      const networkCoverageScore = Math.max(
        0,
        Math.min(1, 1 - ((1 - baseSignal) * 0.35 + loadPressure * 0.45 + peakPressure * 0.20))
      )

      await regionCoverageRepo.upsert({
        regionId: item.regionId,
        period: item.period,
        networkCoverageScore,
        maxConcentration: item.maxConcentration,
        minConcentration: Number.isFinite(item.minConcentration) ? item.minConcentration : 0,
        avgDaytimeConcentration: item.daytimeCount > 0 ? item.daytimeSum / item.daytimeCount : null,
        avgNighttimeConcentration: item.nighttimeCount > 0 ? item.nighttimeSum / item.nighttimeCount : null,
        dominantTechnology: '4G',
        no4gOr5gCoverage: false,
        totalRecords: item.totalRecords,
      })
      rowsUpserted++
    }
    return rowsUpserted
  }

  const ingestAntennas = async (rows: AsyncGenerator<CsvRow>, sourceUrl: string) => {
    const source = await ensureDataSource(
      'cvss-antenas-flp',
      'CVSS - Antenas Florianopolis',
      'ERBs reais da Claro na Regiao Metropolitana de Florianopolis',
      sourceUrl,
    )
    let regionsUpserted = 0
    let stationsUpserted = 0

    for await (const row of rows) {
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

  const ensureRegionAndStationFromConcentration = async (row: CsvRow) => {
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

  const ingestConcentration = async (rows: AsyncGenerator<CsvRow>, sourceUrl: string) => {
    const source = await ensureDataSource(
      'cvss-tensor-concentracao',
      'CVSS - Tensor de Concentracao',
      'Concentracao por antena, dia e periodo da base CDRView App BiT v2',
      sourceUrl,
    )
    const records: CDRViewRowDTO[] = []
    let rowsRead = 0
    let recordsInserted = 0
    let regionsUpserted = 0
    let stationsUpserted = 0
    const seenRegions = new Set<string>()
    const seenStations = new Set<string>()
    const coverageAccumulators = new Map<string, CoverageAccumulator>()

    const flush = async () => {
      if (records.length === 0) return
      recordsInserted += await cdrviewRecordRepo.bulkInsert(records.splice(0, records.length))
    }

    for await (const row of rows) {
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
      const peopleCount = intValue(row.n_usuarios)
      const signalStrength = signalFromConcentration(row)
      records.push({
        regionId: region.id,
        stationId: station.id,
        period,
        hourOfDay: period.getUTCHours(),
        dayOfWeek: period.getUTCDay(),
        peopleCount,
        networkTechnology: '4G',
        signalStrength,
      })
      addCoverageSample(
        coverageAccumulators,
        region.id,
        coveragePeriod(row.day_date),
        period.getUTCHours(),
        peopleCount,
        signalStrength,
      )

      if (records.length >= BATCH_SIZE) {
        await flush()
      }
    }

    await flush()
    const coverageRowsUpserted = await flushCoverage(coverageAccumulators)
    await dataSourceRepo.updateLastIngestedAt(source.id)
    return { rowsRead, recordsInserted, regionsUpserted, stationsUpserted, coverageRowsUpserted }
  }

  const registerUnmappedSources = async (
    hasFile: (names: readonly string[]) => boolean,
    sourceUrl: string,
  ) => {
    const unmapped = [
      [files.flowRoads, 'cvss-tensor-fluxo-vias', 'CVSS - Tensor Fluxo Vias'],
      [files.od, 'cvss-tensor-od', 'CVSS - Tensor OD'],
      [files.travelTime, 'cvss-tensor-tempo-deslocamento', 'CVSS - Tensor Tempo Deslocamento'],
      [files.commonRoutes, 'cvss-trajetos-comuns', 'CVSS - Trajetos Comuns'],
      [files.privacy, 'cvss-sumario-kanon', 'CVSS - Sumario K-anonimato'],
    ] as const

    let registered = 0
    for (const [fileNames, slug, name] of unmapped) {
      if (!hasFile(fileNames)) continue
      const source = await ensureDataSource(
        slug,
        name,
        `Fonte detectada. O schema atual ainda nao possui tabela especifica para este arquivo.`,
        sourceUrl,
      )
      await dataSourceRepo.updateLastIngestedAt(source.id)
      registered++
    }
    return registered
  }

  const pickUploaded = (uploaded: CvssUploadedFile[], names: readonly string[]) =>
    uploaded.find(file => names.includes(file.name))

  const pickPath = (directory: string, names: readonly string[]) =>
    names.map(name => path.join(directory, name)).find(filePath => existsSync(filePath))

  return {
    async ingestUploadedFiles(uploaded: CvssUploadedFile[]): Promise<CvssIngestionResult> {
      const antennas = pickUploaded(uploaded, files.antennas)
      const concentration = pickUploaded(uploaded, files.concentration)

      if (!antennas || !concentration) {
        throw new Error('Envie pelo menos antenas_flp.csv e tensor_concentracao.csv para executar a ingestao CVSS.')
      }

      const antennaResult = await ingestAntennas(readCsvContent(antennas.content), 'upload://cvss')
      const concentrationResult = await ingestConcentration(readCsvContent(concentration.content), 'upload://cvss')
      const registeredSources = await registerUnmappedSources(
        names => uploaded.some(file => names.includes(file.name)),
        'upload://cvss',
      )

      return {
        recordsInserted: concentrationResult.recordsInserted,
        regionsUpserted: concentrationResult.regionsUpserted,
        stationsUpserted: antennaResult.stationsUpserted + concentrationResult.stationsUpserted,
        coverageRowsUpserted: concentrationResult.coverageRowsUpserted,
        registeredSources,
        filesProcessed: uploaded.map(file => file.name),
      }
    },

    async ingestDirectory(directory: string): Promise<CvssIngestionResult> {
      const antennas = pickPath(directory, files.antennas)
      const concentration = pickPath(directory, files.concentration)

      if (!antennas || !concentration) {
        throw new Error(`Ficheiros obrigatorios nao encontrados em ${directory}: antenas_flp.csv e tensor_concentracao.csv`)
      }

      const antennaResult = await ingestAntennas(readCsvFile(antennas), `file://${directory}`)
      const concentrationResult = await ingestConcentration(readCsvFile(concentration), `file://${directory}`)
      const registeredSources = await registerUnmappedSources(
        names => Boolean(pickPath(directory, names)),
        `file://${directory}`,
      )

      return {
        recordsInserted: concentrationResult.recordsInserted,
        regionsUpserted: concentrationResult.regionsUpserted,
        stationsUpserted: antennaResult.stationsUpserted + concentrationResult.stationsUpserted,
        coverageRowsUpserted: concentrationResult.coverageRowsUpserted,
        registeredSources,
        filesProcessed: [
          path.basename(antennas),
          path.basename(concentration),
        ],
      }
    },
  }
}
