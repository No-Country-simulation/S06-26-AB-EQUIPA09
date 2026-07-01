import { eq, and, count, asc, ilike } from 'drizzle-orm'
import type { Database } from '@/db'
import { regions, baseStations } from '@/db/schema'
import type { IRegionRepository } from '../../application/ports/region.port'
import type { RegionResponseDTO, BaseStationResponseDTO } from '../../application/dtos/region.dto'
import { dbExec } from '@/db/db-exec'

const toRegionDTO = (row: typeof regions.$inferSelect): RegionResponseDTO => ({
  id: row.id,
  zoneId: row.zoneId,
  name: row.name,
  municipality: row.municipality,
  state: row.state,
  country: row.country,
  lat: row.lat,
  lng: row.lng,
  estimatedPopulation: row.estimatedPopulation ?? null,
  areaKm2: row.areaKm2 ?? null,
  createdAt: row.createdAt,
})

const toStationDTO = (row: typeof baseStations.$inferSelect): BaseStationResponseDTO => ({
  id: row.id,
  stationId: row.stationId,
  regionId: row.regionId,
  technology: row.technology as BaseStationResponseDTO['technology'],
  carrier: row.carrier ?? null,
  lat: row.lat,
  lng: row.lng,
  powerDbm: row.powerDbm ?? null,
  isActive: row.isActive,
})

export const createRegionRepository = (db: Database): IRegionRepository => ({
  async upsertRegion(data, tx) {
    return dbExec('upsertRegion', 'RegionRepository', async () => {
      const conn = tx ?? db
      const [existing] = await conn
        .select()
        .from(regions)
        .where(eq(regions.zoneId, data.zoneId))
        .limit(1)

      if (existing) {
        const [row] = await conn
          .update(regions)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(regions.id, existing.id))
          .returning()
        return toRegionDTO(row)
      }

      const [row] = await conn
        .insert(regions)
        .values(data)
        .returning()
      return toRegionDTO(row)
    })
  },

  async findById(id) {
    return dbExec('findById', 'RegionRepository', async () => {
      const [row] = await db.select().from(regions).where(eq(regions.id, id)).limit(1)
      return row ? toRegionDTO(row) : null
    })
  },

  async findByZoneId(zoneId) {
    return dbExec('findByZoneId', 'RegionRepository', async () => {
      const [row] = await db.select().from(regions).where(eq(regions.zoneId, zoneId)).limit(1)
      return row ? toRegionDTO(row) : null
    })
  },

  async findAll(filters) {
    return dbExec('findAll', 'RegionRepository', async () => {
      const page = filters?.page ?? 1
      const pageSize = filters?.pageSize ?? 20
      const offset = (page - 1) * pageSize

      const conditions: (ReturnType<typeof eq> | ReturnType<typeof ilike>)[] = []
      if (filters?.state) conditions.push(ilike(regions.state, `%${filters.state}%`))
      if (filters?.municipality) conditions.push(ilike(regions.municipality, `%${filters.municipality}%`))
      if (filters?.country) conditions.push(eq(regions.country, filters.country))

      const where = conditions.length ? and(...conditions) : undefined

      const [data, totalResult] = await Promise.all([
        db.select().from(regions).where(where).orderBy(asc(regions.name)).limit(pageSize).offset(offset),
        db.select({ count: count() }).from(regions).where(where),
      ])

      return { data: data.map(toRegionDTO), total: totalResult[0].count }
    })
  },

  async listStates(country) {
    return dbExec('listStates', 'RegionRepository', async () => {
      const condition = country ? eq(regions.country, country) : undefined
      const rows = await db
        .select({ state: regions.state })
        .from(regions)
        .where(condition)
        .groupBy(regions.state)
        .orderBy(asc(regions.state))
      return rows.map(r => r.state)
    })
  },

  async listMunicipalities(state) {
    return dbExec('listMunicipalities', 'RegionRepository', async () => {
      const rows = await db
        .select({ municipality: regions.municipality })
        .from(regions)
        .where(eq(regions.state, state))
        .groupBy(regions.municipality)
        .orderBy(asc(regions.municipality))
      return rows.map(r => r.municipality)
    })
  },

  async upsertBaseStation(data, tx) {
    return dbExec('upsertBaseStation', 'RegionRepository', async () => {
      const conn = tx ?? db
      const [existing] = await conn
        .select()
        .from(baseStations)
        .where(eq(baseStations.stationId, data.stationId))
        .limit(1)

      if (existing) {
        const [row] = await conn
          .update(baseStations)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(baseStations.id, existing.id))
          .returning()
        return toStationDTO(row)
      }

      const [row] = await conn
        .insert(baseStations)
        .values(data)
        .returning()
      return toStationDTO(row)
    })
  },

  async findStationsByRegion(regionId, filters) {
    return dbExec('findStationsByRegion', 'RegionRepository', async () => {
      const conditions = [eq(baseStations.regionId, regionId)]
      if (filters?.technology) conditions.push(eq(baseStations.technology, filters.technology))
      if (filters?.isActive !== undefined) conditions.push(eq(baseStations.isActive, filters.isActive))

      const rows = await db
        .select()
        .from(baseStations)
        .where(and(...conditions))
        .orderBy(asc(baseStations.stationId))

      return rows.map(toStationDTO)
    })
  },
})
