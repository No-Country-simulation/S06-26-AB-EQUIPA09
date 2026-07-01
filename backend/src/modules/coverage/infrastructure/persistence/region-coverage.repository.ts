import { eq, and, gte, sql } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import type { Database } from '@/db'
import { regionCoverage } from '@/db/schema'
import type { IRegionCoverageRepository } from '../../application/ports/coverage.port'
import type { CoverageResponseDTO } from '../../application/dtos/coverage.dto'
import { dbExec } from '@/db/db-exec'

type RegionCoverageSelect = InferSelectModel<typeof regionCoverage>

const toCoverageResponseDTO = (row: RegionCoverageSelect): CoverageResponseDTO => ({
  id:                       row.id,
  regionId:                 row.regionId,
  period:                   row.period,
  networkCoverageScore:     row.networkCoverageScore,
  maxConcentration:         row.maxConcentration,
  minConcentration:         row.minConcentration,
  avgDaytimeConcentration:  row.avgDaytimeConcentration ?? null,
  avgNighttimeConcentration: row.avgNighttimeConcentration ?? null,
  dominantTechnology:       row.dominantTechnology ?? null,
  no4gOr5gCoverage:         row.no4gOr5gCoverage,
  totalRecords:             row.totalRecords,
  updatedAt:                row.updatedAt,
})

export const createRegionCoverageRepository = (db: Database): IRegionCoverageRepository => {
  return {
    async upsert(data, tx) {
      return dbExec('upsert', 'RegionCoverageRepository', async () => {
        const conn = (tx ?? db) as Database
        const [row] = await conn
          .insert(regionCoverage)
          .values({
            regionId:                 data.regionId,
            period:                   data.period,
            networkCoverageScore:     data.networkCoverageScore,
            maxConcentration:         data.maxConcentration,
            minConcentration:         data.minConcentration,
            avgDaytimeConcentration:  data.avgDaytimeConcentration,
            avgNighttimeConcentration: data.avgNighttimeConcentration,
            dominantTechnology:       data.dominantTechnology,
            no4gOr5gCoverage:         data.no4gOr5gCoverage,
            totalRecords:             data.totalRecords,
          })
          .onConflictDoUpdate({
            target: [regionCoverage.regionId, regionCoverage.period],
            set: {
              networkCoverageScore:     sql`EXCLUDED.network_coverage_score`,
              maxConcentration:         sql`EXCLUDED.max_concentration`,
              minConcentration:         sql`EXCLUDED.min_concentration`,
              avgDaytimeConcentration:  sql`EXCLUDED.avg_daytime_concentration`,
              avgNighttimeConcentration: sql`EXCLUDED.avg_nighttime_concentration`,
              dominantTechnology:       sql`EXCLUDED.dominant_technology`,
              no4gOr5gCoverage:         sql`EXCLUDED.no_4g_or_5g_coverage`,
              totalRecords:             sql`EXCLUDED.total_records`,
              updatedAt:                sql`NOW()`,
            },
          })
          .returning()
        return toCoverageResponseDTO(row)
      })
    },

    async findByRegionAndPeriod(regionId, period) {
      return dbExec('findByRegionAndPeriod', 'RegionCoverageRepository', async () => {
        const [row] = await db
          .select()
          .from(regionCoverage)
          .where(and(
            eq(regionCoverage.regionId, regionId),
            eq(regionCoverage.period, period),
          ))
          .limit(1)
        return row ? toCoverageResponseDTO(row) : null
      })
    },

    async findByRegion(regionId) {
      return dbExec('findByRegion', 'RegionCoverageRepository', async () => {
        const rows = await db
          .select()
          .from(regionCoverage)
          .where(eq(regionCoverage.regionId, regionId))
          .orderBy(regionCoverage.period)
        return rows.map(toCoverageResponseDTO)
      })
    },

    async findAll(filters) {
      return dbExec('findAll', 'RegionCoverageRepository', async () => {
        const conditions = []
        if (filters?.period) conditions.push(eq(regionCoverage.period, filters.period))
        if (filters?.no4gOr5gCoverage !== undefined) conditions.push(eq(regionCoverage.no4gOr5gCoverage, filters.no4gOr5gCoverage))
        if (filters?.minScore !== undefined) conditions.push(gte(regionCoverage.networkCoverageScore, filters.minScore))

        const where = conditions.length ? and(...conditions) : undefined
        const rows = await db
          .select()
          .from(regionCoverage)
          .where(where)
          .orderBy(regionCoverage.updatedAt)
        return rows.map(toCoverageResponseDTO)
      })
    },

    async findCriticalZones(period) {
      return dbExec('findCriticalZones', 'RegionCoverageRepository', async () => {
        const conditions = [eq(regionCoverage.no4gOr5gCoverage, true)]
        if (period) conditions.push(eq(regionCoverage.period, period))

        const rows = await db
          .select()
          .from(regionCoverage)
          .where(and(...conditions))
          .orderBy(regionCoverage.updatedAt)
        return rows.map(toCoverageResponseDTO)
      })
    },
  }
}
