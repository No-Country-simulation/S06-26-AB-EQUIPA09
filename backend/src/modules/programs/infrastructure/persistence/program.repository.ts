import { eq, isNull, count, asc, desc, and, like } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import type { Database } from '@/db'
import { programs } from '@/db/schema'
import type { IProgramRepository, ListResponse } from '../../application/ports/program.port'
import type { ProgramResponseDTO, ProgramFiltersDTO } from '../../application/dtos/program.dto'
import { dbExec } from '@/db/db-exec'

type ProgramSelect = InferSelectModel<typeof programs>

const toProgramResponseDTO = (row: ProgramSelect): ProgramResponseDTO => ({
  id:           row.id,
  regionId:     row.regionId ?? null,
  name:         row.name,
  description:  row.description ?? null,
  category:     row.category,
  organization: row.organization ?? null,
  municipality: row.municipality ?? null,
  state:        row.state ?? null,
  url:          row.url ?? null,
  isActive:     row.isActive,
  startsAt:     row.startsAt ?? null,
  endsAt:       row.endsAt ?? null,
  metadata:     (row.metadata ?? {}) as Record<string, unknown>,
  createdAt:    row.createdAt,
  updatedAt:    row.updatedAt,
})

const buildFilters = (filters?: ProgramFiltersDTO) => {
  const conditions = [isNull(programs.deletedAt)]

  if (filters?.regionId)     conditions.push(eq(programs.regionId, filters.regionId))
  if (filters?.category)     conditions.push(eq(programs.category, filters.category))
  if (filters?.state)        conditions.push(eq(programs.state, filters.state))
  if (filters?.municipality) conditions.push(like(programs.municipality, `%${filters.municipality}%`))
  if (filters?.isActive !== undefined) conditions.push(eq(programs.isActive, filters.isActive))

  return conditions.length ? and(...conditions) : undefined
}

export const createProgramRepository = (db: Database): IProgramRepository => {
  return {
    async create(data, tx) {
      return dbExec('create', 'ProgramRepository', async () => {
        const conn = (tx ?? db) as Database
        const [row] = await conn
          .insert(programs)
          .values({
            regionId:     data.regionId ?? null,
            name:         data.name,
            description:  data.description ?? null,
            category:     data.category,
            organization: data.organization ?? null,
            municipality: data.municipality ?? null,
            state:        data.state ?? null,
            url:          data.url ?? null,
            startsAt:     data.startsAt ?? null,
            endsAt:       data.endsAt ?? null,
            metadata:     (data.metadata ?? {}) as Record<string, unknown>,
          })
          .returning()
        return toProgramResponseDTO(row)
      })
    },

    async findById(id) {
      return dbExec('findById', 'ProgramRepository', async () => {
        const [row] = await db
          .select()
          .from(programs)
          .where(and(eq(programs.id, id), isNull(programs.deletedAt)))
          .limit(1)
        return row ? toProgramResponseDTO(row) : null
      })
    },

    async findAll(filters) {
      return dbExec('findAll', 'ProgramRepository', async () => {
        const where   = buildFilters(filters)
        const page    = filters?.page ?? 1
        const perPage = filters?.pageSize ?? 20
        const offset  = (page - 1) * perPage

        const [data, totalResult] = await Promise.all([
          db
            .select()
            .from(programs)
            .where(where)
            .orderBy(desc(programs.createdAt))
            .limit(perPage)
            .offset(offset),
          db.select({ count: count() }).from(programs).where(where),
        ])

        const totalItems = totalResult[0].count
        return {
          data: data.map(toProgramResponseDTO),
          pagination: {
            currentPage: page,
            perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
          },
        } satisfies ListResponse<ProgramResponseDTO[]>
      })
    },

    async findByRegion(regionId, filters) {
      return dbExec('findByRegion', 'ProgramRepository', async () => {
        const conditions = [
          eq(programs.regionId, regionId),
          isNull(programs.deletedAt),
        ]
        if (filters?.category)  conditions.push(eq(programs.category, filters.category))
        if (filters?.isActive !== undefined) conditions.push(eq(programs.isActive, filters.isActive))

        const rows = await db
          .select()
          .from(programs)
          .where(and(...conditions))
          .orderBy(asc(programs.createdAt))

        return rows.map(toProgramResponseDTO)
      })
    },

    async update(id, data, tx) {
      return dbExec('update', 'ProgramRepository', async () => {
        const conn = (tx ?? db) as Database
        const updateData: Record<string, unknown> = { updatedAt: new Date() }

        if (data.name         !== undefined) updateData.name         = data.name
        if (data.description  !== undefined) updateData.description  = data.description
        if (data.category     !== undefined) updateData.category     = data.category
        if (data.organization !== undefined) updateData.organization = data.organization
        if (data.municipality !== undefined) updateData.municipality = data.municipality
        if (data.state        !== undefined) updateData.state        = data.state
        if (data.url          !== undefined) updateData.url          = data.url
        if (data.isActive     !== undefined) updateData.isActive     = data.isActive
        if (data.startsAt     !== undefined) updateData.startsAt     = data.startsAt
        if (data.endsAt       !== undefined) updateData.endsAt       = data.endsAt
        if (data.metadata     !== undefined) updateData.metadata     = data.metadata
        if (data.regionId     !== undefined) updateData.regionId     = data.regionId

        const [row] = await conn
          .update(programs)
          .set(updateData)
          .where(eq(programs.id, id))
          .returning()

        return toProgramResponseDTO(row)
      })
    },

    async softDelete(id, tx) {
      return dbExec('softDelete', 'ProgramRepository', async () => {
        const conn = (tx ?? db) as Database
        await conn
          .update(programs)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(programs.id, id))
      })
    },
  }
}
