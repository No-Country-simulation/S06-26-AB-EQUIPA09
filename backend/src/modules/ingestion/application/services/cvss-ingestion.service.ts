import { createReadStream, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { sql as dbSql } from '@/db'
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

  // --- Mobility Flows (tensor_fluxo_vias.csv) ---
  const ingestMobilityFlows = async (rows: AsyncGenerator<CsvRow>, sourceUrl: string) => {
    const source = await ensureDataSource(
      'cvss-tensor-fluxo-vias',
      'CVSS - Tensor Fluxo Vias',
      'Fluxos de mobilidade entre antenas (antenna-to-antenna)',
      sourceUrl,
    )
    let inserted = 0
    const batch: unknown[][] = []

    for await (const row of rows) {
      batch.push([
        row.ecgi_origem, floatValue(row.lat_origem), floatValue(row.lon_origem),
        row.cluster_origem, normalizeMunicipality(row.municipio_origem),
        row.ecgi_destino, floatValue(row.lat_destino), floatValue(row.lon_destino),
        row.cluster_destino, normalizeMunicipality(row.municipio_destino),
        intValue(row.n_usuarios), intValue(row.n_transicoes),
        floatValue(row.dist_km), (row.periodo_predominante || '').toUpperCase(),
        floatValue(row.pct_do_cluster_origem),
      ])

      if (batch.length >= BATCH_SIZE) {
        await flushMobilityFlows(batch)
        inserted += batch.length
        batch.length = 0
      }
    }
    if (batch.length > 0) {
      await flushMobilityFlows(batch)
      inserted += batch.length
    }
    await dataSourceRepo.updateLastIngestedAt(source.id)
    return inserted
  }

  // --- Mobility OD (tensor_od.csv) ---
  const ingestMobilityOd = async (rows: AsyncGenerator<CsvRow>, sourceUrl: string) => {
    const source = await ensureDataSource(
      'cvss-tensor-od',
      'CVSS - Tensor OD',
      'Matriz Origem-Destino agregada por cluster',
      sourceUrl,
    )
    let inserted = 0
    const batch: unknown[][] = []

    for await (const row of rows) {
      batch.push([
        row.cluster_origem, normalizeMunicipality(row.municipio_origem),
        floatValue(row.lat_origem), floatValue(row.lon_origem),
        row.cluster_destino, normalizeMunicipality(row.municipio_destino),
        floatValue(row.lat_destino), floatValue(row.lon_destino),
        row.mesmo_cluster === '1',
        intValue(row.n_usuarios), intValue(row.n_viagens),
        floatValue(row.dist_media_km), (row.periodo_predominante || '').toUpperCase(),
      ])

      if (batch.length >= BATCH_SIZE) {
        await flushMobilityOd(batch)
        inserted += batch.length
        batch.length = 0
      }
    }
    if (batch.length > 0) {
      await flushMobilityOd(batch)
      inserted += batch.length
    }
    await dataSourceRepo.updateLastIngestedAt(source.id)
    return inserted
  }

  // --- Travel Times (tensor_tempo_deslocamento.csv) ---
  const ingestTravelTimes = async (rows: AsyncGenerator<CsvRow>, sourceUrl: string) => {
    const source = await ensureDataSource(
      'cvss-tensor-tempo-deslocamento',
      'CVSS - Tensor Tempo Deslocamento',
      'Estatisticas de distancia e tempo entre clusters',
      sourceUrl,
    )
    let inserted = 0
    const batch: unknown[][] = []

    for await (const row of rows) {
      batch.push([
        row.cluster_origem, row.cluster_destino,
        row.mesmo_cluster === '1',
        intValue(row.n_observacoes),
        floatValue(row.dist_media_km), floatValue(row.dist_p25_km), floatValue(row.dist_p75_km),
        (row.periodo_predominante || '').toUpperCase(),
      ])

      if (batch.length >= BATCH_SIZE) {
        await flushTravelTimes(batch)
        inserted += batch.length
        batch.length = 0
      }
    }
    if (batch.length > 0) {
      await flushTravelTimes(batch)
      inserted += batch.length
    }
    await dataSourceRepo.updateLastIngestedAt(source.id)
    return inserted
  }

  // --- Mobility Routes (trajetos_comuns.csv) ---
  const ingestMobilityRoutes = async (rows: AsyncGenerator<CsvRow>, sourceUrl: string) => {
    const source = await ensureDataSource(
      'cvss-trajetos-comuns',
      'CVSS - Trajetos Comuns',
      'Rotas mais comuns de origem-destino',
      sourceUrl,
    )
    let inserted = 0
    const batch: unknown[][] = []

    for await (const row of rows) {
      batch.push([
        row.cluster_origem, normalizeMunicipality(row.municipio_origem),
        floatValue(row.lat_origem), floatValue(row.lon_origem),
        row.cluster_destino, normalizeMunicipality(row.municipio_destino),
        floatValue(row.lat_destino), floatValue(row.lon_destino),
        row.mesmo_cluster === '1',
        intValue(row.n_usuarios), intValue(row.n_viagens),
        floatValue(row.dist_media_km), (row.periodo_predominante || '').toUpperCase(),
      ])

      if (batch.length >= BATCH_SIZE) {
        await flushMobilityRoutes(batch)
        inserted += batch.length
        batch.length = 0
      }
    }
    if (batch.length > 0) {
      await flushMobilityRoutes(batch)
      inserted += batch.length
    }
    await dataSourceRepo.updateLastIngestedAt(source.id)
    return inserted
  }

  // --- Privacy Summary (sumario_kanon.csv) ---
  const ingestPrivacySummary = async (rows: AsyncGenerator<CsvRow>, sourceUrl: string) => {
    const source = await ensureDataSource(
      'cvss-sumario-kanon',
      'CVSS - Sumario K-anonimato',
      'Resumo de privacidade k-anonimato do dataset',
      sourceUrl,
    )
    const summary: Record<string, string> = {}
    for await (const row of rows) {
      if (row.parametro && row.valor) {
        summary[row.parametro] = row.valor
      }
    }
    await dataSourceRepo.updateLastIngestedAt(source.id)
    return summary
  }

  // --- Bulk insert helpers ---
  const flushMobilityFlows = async (batch: unknown[][]) => {
    if (batch.length === 0) return
    const values = batch.map((_, i) => {
      const o = i * 15
      return `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9},$${o+10},$${o+11},$${o+12},$${o+13},$${o+14},$${o+15})`
    }).join(',')
    await dbSql.unsafe(`INSERT INTO mobility_flows (ecgi_origin,lat_origin,lng_origin,cluster_origin,municipality_origin,ecgi_destination,lat_destination,lng_destination,cluster_destination,municipality_destination,n_users,n_transitions,dist_km,period_predominant,pct_of_cluster_origin) VALUES ${values}`, batch.flat() as never[])
  }

  const flushMobilityOd = async (batch: unknown[][]) => {
    if (batch.length === 0) return
    const values = batch.map((_, i) => {
      const o = i * 13
      return `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9},$${o+10},$${o+11},$${o+12},$${o+13})`
    }).join(',')
    await dbSql.unsafe(`INSERT INTO mobility_od (cluster_origin,municipality_origin,lat_origin,lng_origin,cluster_destination,municipality_destination,lat_destination,lng_destination,mesmo_cluster,n_users,n_viagens,dist_media_km,period_predominant) VALUES ${values}`, batch.flat() as never[])
  }

  const flushTravelTimes = async (batch: unknown[][]) => {
    if (batch.length === 0) return
    const values = batch.map((_, i) => {
      const o = i * 8
      return `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8})`
    }).join(',')
    await dbSql.unsafe(`INSERT INTO travel_times (cluster_origin,cluster_destination,mesmo_cluster,n_observacoes,dist_media_km,dist_p25_km,dist_p75_km,period_predominant) VALUES ${values}`, batch.flat() as never[])
  }

  const flushMobilityRoutes = async (batch: unknown[][]) => {
    if (batch.length === 0) return
    const values = batch.map((_, i) => {
      const o = i * 13
      return `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9},$${o+10},$${o+11},$${o+12},$${o+13})`
    }).join(',')
    await dbSql.unsafe(`INSERT INTO mobility_routes (cluster_origin,municipality_origin,lat_origin,lng_origin,cluster_destination,municipality_destination,lat_destination,lng_destination,mesmo_cluster,n_users,n_viagens,dist_media_km,period_predominant) VALUES ${values}`, batch.flat() as never[])
  }

  const registerUnmappedSources = async (
    _hasFile: (names: readonly string[]) => boolean,
    pickContent: (names: readonly string[]) => CvssUploadedFile | undefined,
    sourceUrl: string,
  ) => {
    let registered = 0

    // Mobility Flows
    const flowFile = pickContent(files.flowRoads)
    if (flowFile) {
      await ingestMobilityFlows(readCsvContent(flowFile.content), sourceUrl)
      registered++
    }

    // Mobility OD
    const odFile = pickContent(files.od)
    if (odFile) {
      await ingestMobilityOd(readCsvContent(odFile.content), sourceUrl)
      registered++
    }

    // Travel Times
    const travelFile = pickContent(files.travelTime)
    if (travelFile) {
      await ingestTravelTimes(readCsvContent(travelFile.content), sourceUrl)
      registered++
    }

    // Mobility Routes
    const routesFile = pickContent(files.commonRoutes)
    if (routesFile) {
      await ingestMobilityRoutes(readCsvContent(routesFile.content), sourceUrl)
      registered++
    }

    // Privacy Summary (metadata only)
    const privacyFile = pickContent(files.privacy)
    if (privacyFile) {
      await ingestPrivacySummary(readCsvContent(privacyFile.content), sourceUrl)
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
        names => uploaded.find(file => names.includes(file.name)),
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

      // For directory ingestion, read files from disk for the mobility CSVs
      const pickDirFile = (names: readonly string[]): CvssUploadedFile | undefined => {
        const filePath = pickPath(directory, names)
        if (!filePath) return undefined
        const content = readFileSync(filePath, 'utf-8')
        return { name: path.basename(filePath), content }
      }

      const registeredSources = await registerUnmappedSources(
        names => Boolean(pickPath(directory, names)),
        pickDirFile,
        `file://${directory}`,
      )

      const filesProcessed = [path.basename(antennas), path.basename(concentration)]
      for (const fileNames of Object.values(files)) {
        const p = pickPath(directory, fileNames)
        if (p) filesProcessed.push(path.basename(p))
      }

      return {
        recordsInserted: concentrationResult.recordsInserted,
        regionsUpserted: concentrationResult.regionsUpserted,
        stationsUpserted: antennaResult.stationsUpserted + concentrationResult.stationsUpserted,
        coverageRowsUpserted: concentrationResult.coverageRowsUpserted,
        registeredSources,
        filesProcessed,
      }
    },
  }
}
