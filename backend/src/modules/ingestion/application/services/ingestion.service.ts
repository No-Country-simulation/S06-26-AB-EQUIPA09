import type {
  IDataSourceRepository,
  ICDRViewRecordRepository,
  IIngestionService,
} from '../ports/ingestion.port'
import type { IRegionRepository } from '@/modules/regions/application/ports/region.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { logger } from '@/shared/logger/logger'
import type {
  CDRViewRowDTO,
  IngestionResultDTO,
  StreamingProgress,
} from '../dtos/ingestion.dto'
import { parseCSVStream } from './csv-stream-parser'
import type { CSVRow } from './csv-stream-parser'

const COMPONENT = 'IngestionService'
const BATCH_SIZE = 500

const parseCSV = (content: string): CSVRow[] => {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) continue

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] })

    const period = row.period
    const periodDate = new Date(period)
    const hour = periodDate.getHours()
    const day = periodDate.getDay()

    rows.push({
      zoneId: row.zone_id || row.zoneId || '',
      name: row.name || '',
      municipality: row.municipality || '',
      state: row.state || '',
      country: row.country || 'BR',
      lat: parseFloat(row.lat) || 0,
      lng: parseFloat(row.lng) || 0,
      stationId: row.station_id || row.stationId || '',
      technology: row.technology || '4G',
      carrier: row.carrier || '',
      powerDbm: row.power_dbm ? parseFloat(row.power_dbm) : null,
      period,
      peopleCount: parseInt(row.people_count || row.peopleCount || '0', 10),
      networkTechnology: row.network_technology || row.networkTechnology || 'unknown',
      signalStrength: row.signal_strength ? parseFloat(row.signal_strength) : null,
      hourOfDay: row.hour_of_day ? parseInt(row.hour_of_day, 10) : hour,
      dayOfWeek: row.day_of_week ? parseInt(row.day_of_week, 10) : day,
      estimatedPopulation: row.estimated_population ? parseInt(row.estimated_population, 10) : null,
      areaKm2: row.area_km2 ? parseFloat(row.area_km2) : null,
    })
  }

  return rows
}

const flushBatch = async (
  batch: CSVRow[],
  seenZoneIds: Set<string>,
  seenStationIds: Set<string>,
  accum: { regionsUpserted: number; stationsUpserted: number; recordsInserted: number },
  regionRepo: IRegionRepository,
  cdrviewRecordRepo: ICDRViewRecordRepository,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted) return

  for (const row of batch) {
    if (!seenZoneIds.has(row.zoneId)) {
      seenZoneIds.add(row.zoneId)
      await regionRepo.upsertRegion({
        zoneId: row.zoneId,
        name: row.name,
        municipality: row.municipality,
        state: row.state,
        country: row.country,
        lat: row.lat,
        lng: row.lng,
        estimatedPopulation: row.estimatedPopulation,
        areaKm2: row.areaKm2,
      })
      accum.regionsUpserted++
    }

    if (signal?.aborted) return

    const region = await regionRepo.findByZoneId(row.zoneId)
    if (!region) continue

    if (!seenStationIds.has(row.stationId)) {
      seenStationIds.add(row.stationId)
      await regionRepo.upsertBaseStation({
        stationId: row.stationId,
        regionId: region.id,
        technology: row.technology as CDRViewRowDTO['networkTechnology'] extends string ? '2G' | '3G' | '4G' | '5G' : '4G',
        carrier: row.carrier || null,
        lat: row.lat,
        lng: row.lng,
        powerDbm: row.powerDbm,
        isActive: true,
      })
      accum.stationsUpserted++
    }
  }

  const dtoRows: CDRViewRowDTO[] = batch.map(row => ({
    regionId: row.zoneId,
    stationId: null,
    period: new Date(row.period),
    hourOfDay: row.hourOfDay,
    dayOfWeek: row.dayOfWeek,
    peopleCount: row.peopleCount,
    networkTechnology: row.networkTechnology || null,
    signalStrength: row.signalStrength,
  }))

  const inserted = await cdrviewRecordRepo.bulkInsert(dtoRows)
  accum.recordsInserted += inserted
}

const createBatchWritable = (
  batchSize: number,
  seenZoneIds: Set<string>,
  seenStationIds: Set<string>,
  accum: { regionsUpserted: number; stationsUpserted: number; recordsInserted: number },
  regionRepo: IRegionRepository,
  cdrviewRecordRepo: ICDRViewRecordRepository,
  signal: AbortSignal | undefined,
  onProgress: ((progress: StreamingProgress) => void) | undefined,
): WritableStream<CSVRow> => {
  let batch: CSVRow[] = []
  let batchNumber = 0

  return new WritableStream({
    async write(row) {
      if (signal?.aborted) return
      batch.push(row)
      if (batch.length >= batchSize) {
        const toFlush = batch
        batch = []
        batchNumber++
        await flushBatch(toFlush, seenZoneIds, seenStationIds, accum, regionRepo, cdrviewRecordRepo, signal)
        onProgress?.({
          rowsProcessed: batchNumber * batchSize,
          recordsInserted: accum.recordsInserted,
          regionsUpserted: accum.regionsUpserted,
          stationsUpserted: accum.stationsUpserted,
          batchNumber,
        })
      }
    },
    async close() {
      if (batch.length > 0) {
        batchNumber++
        await flushBatch(batch, seenZoneIds, seenStationIds, accum, regionRepo, cdrviewRecordRepo, signal)
        onProgress?.({
          rowsProcessed: batchNumber * batchSize,
          recordsInserted: accum.recordsInserted,
          regionsUpserted: accum.regionsUpserted,
          stationsUpserted: accum.stationsUpserted,
          batchNumber,
        })
      }
    },
    abort(reason) {
      logger.error({ reason }, 'Stream ingestion aborted')
    },
  })
}

export const createIngestionService = (
  dataSourceRepo: IDataSourceRepository,
  regionRepo: IRegionRepository,
  cdrviewRecordRepo: ICDRViewRecordRepository,
): IIngestionService => ({
  async registerDataSource(data) {
    const existing = await dataSourceRepo.findBySlug(data.slug)
    if (existing) {
      return Err(ErrorFactory.conflict('Slug já registado', 'slug', data.slug, COMPONENT))
    }

    const source = await dataSourceRepo.create(data)
    return Ok(source)
  },

  async updateDataSource(id, data) {
    const existing = await dataSourceRepo.findById(id)
    if (!existing) {
      return Err(ErrorFactory.notFound('Fonte de dados não encontrada', 'DataSource', id, COMPONENT))
    }

    const updated = await dataSourceRepo.update(id, data)
    return Ok(updated)
  },

  async listDataSources(page, pageSize, filters) {
    const result = await dataSourceRepo.findAll(page, pageSize, filters)
    return Ok(result)
  },

  async getDataSource(id) {
    const source = await dataSourceRepo.findById(id)
    if (!source) {
      return Err(ErrorFactory.notFound('Fonte de dados não encontrada', 'DataSource', id, COMPONENT))
    }
    return Ok(source)
  },

  async runCDRViewPipeline(sourceId, csvContent) {
    const source = await dataSourceRepo.findById(sourceId)
    if (!source) {
      return Err(ErrorFactory.notFound('Fonte de dados não encontrada', 'DataSource', sourceId, COMPONENT))
    }

    const rows = parseCSV(csvContent)
    if (rows.length === 0) {
      return Err(ErrorFactory.validation('CSV vazio ou formato inválido', [], COMPONENT))
    }

    const seenZoneIds = new Set<string>()
    const seenStationIds = new Set<string>()
    let regionsUpserted = 0
    let stationsUpserted = 0

    const records: CDRViewRowDTO[] = []

    for (const row of rows) {
      if (!seenZoneIds.has(row.zoneId)) {
        seenZoneIds.add(row.zoneId)
        await regionRepo.upsertRegion({
          zoneId: row.zoneId,
          name: row.name,
          municipality: row.municipality,
          state: row.state,
          country: row.country,
          lat: row.lat,
          lng: row.lng,
          estimatedPopulation: row.estimatedPopulation,
          areaKm2: row.areaKm2,
        })
        regionsUpserted++
      }

      const region = await regionRepo.findByZoneId(row.zoneId)
      if (!region) continue

      if (!seenStationIds.has(row.stationId)) {
        seenStationIds.add(row.stationId)
        await regionRepo.upsertBaseStation({
          stationId: row.stationId,
          regionId: region.id,
          technology: row.technology as CDRViewRowDTO['networkTechnology'] extends string ? '2G' | '3G' | '4G' | '5G' : '4G',
          carrier: row.carrier || null,
          lat: row.lat,
          lng: row.lng,
          powerDbm: row.powerDbm,
          isActive: true,
        })
        stationsUpserted++
      }

      const periodDate = new Date(row.period)
      records.push({
        regionId: region.id,
        stationId: null,
        period: periodDate,
        hourOfDay: row.hourOfDay,
        dayOfWeek: row.dayOfWeek,
        peopleCount: row.peopleCount,
        networkTechnology: row.networkTechnology || null,
        signalStrength: row.signalStrength,
      })
    }

    const recordsInserted = await cdrviewRecordRepo.bulkInsert(records)

    await dataSourceRepo.updateLastIngestedAt(sourceId)

    const result: IngestionResultDTO = {
      recordsInserted,
      regionsUpserted,
      stationsUpserted,
      sourceId,
    }

    return Ok(result)
  },

  async runCDRViewPipelineStream(sourceId, stream, signal, onProgress) {
    const source = await dataSourceRepo.findById(sourceId)
    if (!source) {
      return Err(ErrorFactory.notFound('Fonte de dados não encontrada', 'DataSource', sourceId, COMPONENT))
    }

    const seenZoneIds = new Set<string>()
    const seenStationIds = new Set<string>()
    const accum = { regionsUpserted: 0, stationsUpserted: 0, recordsInserted: 0 }

    const writable = createBatchWritable(
      BATCH_SIZE,
      seenZoneIds,
      seenStationIds,
      accum,
      regionRepo,
      cdrviewRecordRepo,
      signal,
      onProgress,
    )

    try {
      await stream
        .pipeThrough(parseCSVStream())
        .pipeTo(writable, { signal })

      await dataSourceRepo.updateLastIngestedAt(sourceId)

      return Ok({
        recordsInserted: accum.recordsInserted,
        regionsUpserted: accum.regionsUpserted,
        stationsUpserted: accum.stationsUpserted,
        sourceId,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        logger.warn({ sourceId, recordsInserted: accum.recordsInserted }, 'Stream ingestion cancelled')
        return Err(ErrorFactory.validation('Ingestão cancelada', [], COMPONENT))
      }
      logger.error({ err, sourceId }, 'Stream ingestion failed')
      return Err(ErrorFactory.internalError('Falha na ingestão por stream', err as Error, COMPONENT))
    }
  },

  async getRecordsByRegion(regionId, limit, offset) {
    const records = await cdrviewRecordRepo.findByRegion(regionId, limit, offset)
    return Ok(records)
  },
})
