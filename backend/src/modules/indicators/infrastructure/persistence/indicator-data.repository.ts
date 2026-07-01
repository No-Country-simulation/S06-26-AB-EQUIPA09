import { eq, and, lt, sql } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import type { Database } from '@/db'
import { indicatorData, indicators } from '@/db/schema'
import type { IIndicatorDataRepository } from '../../application/ports/indicator.port'
import type { IndicatorDataResponseDTO } from '../../application/dtos/indicator.dto'
import { dbExec } from '@/db/db-exec'

type IndicatorDataSelect = InferSelectModel<typeof indicatorData>

const toIndicatorDataResponseDTO = (row: IndicatorDataSelect): IndicatorDataResponseDTO => ({
  id:              row.id,
  regionId:        row.regionId,
  indicatorId:     row.indicatorId,
  sourceId:        row.sourceId ?? null,
  period:          row.period,
  value:           row.value,
  normalizedValue: row.normalizedValue ?? null,
  quality:         row.quality ?? 'estimated',
  notes:           row.notes ?? null,
  updatedAt:       row.updatedAt,
})

export const createIndicatorDataRepository = (db: Database): IIndicatorDataRepository => {
  return {
    async upsert(data, tx) {
      return dbExec('upsert', 'IndicatorDataRepository', async () => {
        const conn = (tx ?? db) as Database
        const [row] = await conn
          .insert(indicatorData)
          .values({
            regionId:        data.regionId,
            indicatorId:     data.indicatorId,
            sourceId:        data.sourceId ?? null,
            period:          data.period,
            value:           data.value,
            normalizedValue: data.normalizedValue ?? null,
            quality:         data.quality ?? 'estimated',
            notes:           data.notes ?? null,
          })
          .onConflictDoUpdate({
            target: [indicatorData.regionId, indicatorData.indicatorId, indicatorData.period],
            set: {
              value:           sql`EXCLUDED.value`,
              normalizedValue: sql`EXCLUDED.normalized_value`,
              quality:         sql`EXCLUDED.quality`,
              notes:           sql`EXCLUDED.notes`,
              sourceId:        sql`EXCLUDED.source_id`,
              updatedAt:       sql`NOW()`,
            },
          })
          .returning()
        return toIndicatorDataResponseDTO(row)
      })
    },

    async findByKey(regionId, indicatorIdVal, period) {
      return dbExec('findByKey', 'IndicatorDataRepository', async () => {
        const [row] = await db
          .select()
          .from(indicatorData)
          .where(and(
            eq(indicatorData.regionId, regionId),
            eq(indicatorData.indicatorId, indicatorIdVal),
            eq(indicatorData.period, period),
          ))
          .limit(1)
        return row ? toIndicatorDataResponseDTO(row) : null
      })
    },

    async findAll(filters) {
      return dbExec('findAll', 'IndicatorDataRepository', async () => {
        const conditions = []
        if (filters?.regionId)    conditions.push(eq(indicatorData.regionId, filters.regionId))
        if (filters?.indicatorId) conditions.push(eq(indicatorData.indicatorId, filters.indicatorId))
        if (filters?.period)      conditions.push(eq(indicatorData.period, filters.period))
        if (filters?.quality)     conditions.push(eq(indicatorData.quality, filters.quality))

        const where = conditions.length ? and(...conditions) : undefined
        const rows = await db
          .select()
          .from(indicatorData)
          .where(where)
          .orderBy(indicatorData.updatedAt)
        return rows.map(toIndicatorDataResponseDTO)
      })
    },

    async findByRegion(regionId) {
      return dbExec('findByRegion', 'IndicatorDataRepository', async () => {
        const rows = await db
          .select()
          .from(indicatorData)
          .where(eq(indicatorData.regionId, regionId))
          .orderBy(indicatorData.period)
        return rows.map(toIndicatorDataResponseDTO)
      })
    },

    async findCritical(period) {
      return dbExec('findCritical', 'IndicatorDataRepository', async () => {
        const conditions = []
        if (period) conditions.push(eq(indicatorData.period, period))

        const rows = await db
          .select()
          .from(indicatorData)
          .innerJoin(indicators, eq(indicators.id, indicatorData.indicatorId))
          .where(and(
            lt(
              indicatorData.normalizedValue,
              sql`COALESCE((${indicators.criticalThresholds}->>'critical')::numeric, 0.3)`,
            ),
            ...conditions,
          ))
          .orderBy(indicatorData.updatedAt)

        return rows.map(r => toIndicatorDataResponseDTO(r.indicator_data))
      })
    },
  }
}
