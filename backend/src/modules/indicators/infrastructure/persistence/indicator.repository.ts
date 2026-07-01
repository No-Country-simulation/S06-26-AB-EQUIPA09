import { eq, count, asc, and } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import type { Database } from '@/db'
import { indicators } from '@/db/schema'
import type { IIndicatorRepository, ListResponse } from '../../application/ports/indicator.port'
import type { IndicatorResponseDTO } from '../../application/dtos/indicator.dto'
import { dbExec } from '@/db/db-exec'

type IndicatorSelect = InferSelectModel<typeof indicators>

const toIndicatorResponseDTO = (row: IndicatorSelect): IndicatorResponseDTO => ({
  id:                 row.id,
  slug:               row.slug,
  name:               row.name,
  description:        row.description ?? null,
  category:           row.category,
  unit:               row.unit,
  direction:          row.direction,
  criticalThresholds: row.criticalThresholds ?? null,
  sourceId:           row.sourceId ?? null,
  isActive:           row.isActive,
  createdAt:          row.createdAt,
  updatedAt:          row.updatedAt,
})

export const createIndicatorRepository = (db: Database): IIndicatorRepository => {
  return {
    async create(data, tx) {
      return dbExec('create', 'IndicatorRepository', async () => {
        const conn = (tx ?? db) as Database
        const [row] = await conn
          .insert(indicators)
          .values({
            slug:               data.slug,
            name:               data.name,
            description:        data.description ?? null,
            category:           data.category,
            unit:               data.unit,
            direction:          data.direction ?? 'higher_is_better',
            criticalThresholds: (data.criticalThresholds ?? {}) as Record<string, unknown>,
            sourceId:           data.sourceId ?? null,
            isActive:           true,
          })
          .returning()
        return toIndicatorResponseDTO(row)
      })
    },

    async findById(id) {
      return dbExec('findById', 'IndicatorRepository', async () => {
        const [row] = await db
          .select()
          .from(indicators)
          .where(eq(indicators.id, id))
          .limit(1)
        return row ? toIndicatorResponseDTO(row) : null
      })
    },

    async findBySlug(slug) {
      return dbExec('findBySlug', 'IndicatorRepository', async () => {
        const [row] = await db
          .select()
          .from(indicators)
          .where(eq(indicators.slug, slug))
          .limit(1)
        return row ? toIndicatorResponseDTO(row) : null
      })
    },

    async findAll(page, perPage, filters) {
      return dbExec('findAll', 'IndicatorRepository', async () => {
        const offset = (page - 1) * perPage

        const conditions = []
        if (filters?.category) conditions.push(eq(indicators.category, filters.category))
        if (filters?.isActive !== undefined) conditions.push(eq(indicators.isActive, filters.isActive))
        const where = conditions.length ? and(...conditions) : undefined

        const [data, totalResult] = await Promise.all([
          db
            .select()
            .from(indicators)
            .where(where)
            .orderBy(asc(indicators.createdAt))
            .limit(perPage)
            .offset(offset),
          db.select({ count: count() }).from(indicators).where(where),
        ])

        const totalItems = totalResult[0].count
        return {
          data: data.map(toIndicatorResponseDTO),
          pagination: {
            currentPage: page,
            perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
          },
        } satisfies ListResponse<IndicatorResponseDTO[]>
      })
    },

    async update(id, data, tx) {
      return dbExec('update', 'IndicatorRepository', async () => {
        const conn = (tx ?? db) as Database
        const updateData: Record<string, unknown> = { updatedAt: new Date() }

        if (data.name               !== undefined) updateData.name               = data.name
        if (data.description        !== undefined) updateData.description        = data.description
        if (data.category           !== undefined) updateData.category           = data.category
        if (data.unit               !== undefined) updateData.unit               = data.unit
        if (data.direction          !== undefined) updateData.direction          = data.direction
        if (data.criticalThresholds !== undefined) updateData.criticalThresholds = data.criticalThresholds
        if (data.sourceId           !== undefined) updateData.sourceId           = data.sourceId
        if (data.isActive           !== undefined) updateData.isActive           = data.isActive

        const [row] = await conn
          .update(indicators)
          .set(updateData)
          .where(eq(indicators.id, id))
          .returning()

        return toIndicatorResponseDTO(row)
      })
    },

    async findActive() {
      return dbExec('findActive', 'IndicatorRepository', async () => {
        const rows = await db
          .select()
          .from(indicators)
          .where(eq(indicators.isActive, true))
          .orderBy(asc(indicators.createdAt))
        return rows.map(toIndicatorResponseDTO)
      })
    },
  }
}
