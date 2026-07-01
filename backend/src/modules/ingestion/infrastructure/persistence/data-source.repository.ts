import { eq, and, count, asc } from 'drizzle-orm'
import type { Database } from '@/db'
import { dataSources } from '@/db/schema'
import type { IDataSourceRepository } from '../../application/ports/ingestion.port'
import type { DataSourceResponseDTO } from '../../application/dtos/ingestion.dto'
import { dbExec } from '@/db/db-exec'

const toDTO = (row: typeof dataSources.$inferSelect): DataSourceResponseDTO => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description ?? null,
  url: row.url ?? null,
  type: row.type,
  country: row.country,
  isActive: row.isActive,
  lastIngestedAt: row.lastIngestedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export const createDataSourceRepository = (db: Database): IDataSourceRepository => ({
  async create(data, tx) {
    return dbExec('create', 'DataSourceRepository', async () => {
      const conn = tx ?? db
      const [row] = await conn
        .insert(dataSources)
        .values(data)
        .returning()
      return toDTO(row)
    })
  },

  async findById(id) {
    return dbExec('findById', 'DataSourceRepository', async () => {
      const [row] = await db
        .select()
        .from(dataSources)
        .where(eq(dataSources.id, id))
        .limit(1)
      return row ? toDTO(row) : null
    })
  },

  async findBySlug(slug) {
    return dbExec('findBySlug', 'DataSourceRepository', async () => {
      const [row] = await db
        .select()
        .from(dataSources)
        .where(eq(dataSources.slug, slug))
        .limit(1)
      return row ? toDTO(row) : null
    })
  },

  async findAll(page, pageSize, filters) {
    return dbExec('findAll', 'DataSourceRepository', async () => {
      const offset = (page - 1) * pageSize

      const conditions: ReturnType<typeof eq>[] = []
      if (filters?.isActive !== undefined) conditions.push(eq(dataSources.isActive, filters.isActive))
      if (filters?.country) conditions.push(eq(dataSources.country, filters.country))

      const where = conditions.length ? and(...conditions) : undefined

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(dataSources)
          .where(where)
          .orderBy(asc(dataSources.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ count: count() }).from(dataSources).where(where),
      ])

      const totalItems = totalResult[0].count
      return {
        data: data.map(toDTO),
        pagination: {
          currentPage: page,
          perPage: pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      }
    })
  },

  async update(id, data, tx) {
    return dbExec('update', 'DataSourceRepository', async () => {
      const conn = tx ?? db
      const updateData: Record<string, unknown> = { updatedAt: new Date() }

      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description
      if (data.url !== undefined) updateData.url = data.url
      if (data.type !== undefined) updateData.type = data.type
      if (data.country !== undefined) updateData.country = data.country
      if (data.isActive !== undefined) updateData.isActive = data.isActive

      const [row] = await conn
        .update(dataSources)
        .set(updateData)
        .where(eq(dataSources.id, id))
        .returning()
      return toDTO(row)
    })
  },

  async updateLastIngestedAt(id, tx) {
    return dbExec('updateLastIngestedAt', 'DataSourceRepository', async () => {
      const conn = tx ?? db
      await conn
        .update(dataSources)
        .set({ lastIngestedAt: new Date(), updatedAt: new Date() })
        .where(eq(dataSources.id, id))
    })
  },
})
