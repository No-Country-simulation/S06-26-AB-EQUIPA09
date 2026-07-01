import { eq, and, count, desc, between } from 'drizzle-orm'
import type { Database } from '@/db'
import { cdrviewRecords } from '@/db/schema'
import type { ICDRViewRecordRepository } from '../../application/ports/ingestion.port'
import type { CDRViewRowDTO } from '../../application/dtos/ingestion.dto'
import { dbExec } from '@/db/db-exec'

const toDTO = (row: typeof cdrviewRecords.$inferSelect): CDRViewRowDTO => ({
  regionId: row.regionId,
  stationId: row.stationId ?? null,
  period: row.period,
  hourOfDay: row.hourOfDay,
  dayOfWeek: row.dayOfWeek,
  peopleCount: row.peopleCount,
  networkTechnology: row.networkTechnology ?? null,
  signalStrength: row.signalStrength ?? null,
})

export const createCDRViewRecordRepository = (db: Database): ICDRViewRecordRepository => ({
  async bulkInsert(rows, tx) {
    return dbExec('bulkInsert', 'CDRViewRecordRepository', async () => {
      const conn = tx ?? db
      if (rows.length === 0) return 0

      const inserted = await conn
        .insert(cdrviewRecords)
        .values(
          rows.map(r => ({
            regionId: r.regionId,
            stationId: r.stationId,
            period: r.period,
            hourOfDay: r.hourOfDay,
            dayOfWeek: r.dayOfWeek,
            peopleCount: r.peopleCount,
            networkTechnology: r.networkTechnology,
            signalStrength: r.signalStrength,
          }))
        )
        .returning({ id: cdrviewRecords.id })

      return inserted.length
    })
  },

  async findByRegion(regionId, limit = 100, offset = 0) {
    return dbExec('findByRegion', 'CDRViewRecordRepository', async () => {
      const rows = await db
        .select()
        .from(cdrviewRecords)
        .where(eq(cdrviewRecords.regionId, regionId))
        .orderBy(desc(cdrviewRecords.period))
        .limit(limit)
        .offset(offset)

      return rows.map(toDTO)
    })
  },

  async countByRegionAndPeriod(regionId, from, to) {
    return dbExec('countByRegionAndPeriod', 'CDRViewRecordRepository', async () => {
      const [result] = await db
        .select({ count: count() })
        .from(cdrviewRecords)
        .where(
          and(
            eq(cdrviewRecords.regionId, regionId),
            between(cdrviewRecords.period, from, to)
          )
        )
      return result.count
    })
  },
})
