import { eq, count, desc, and, gte, lte, isNotNull, isNull } from 'drizzle-orm'
import type { Database } from '@/db'
import { queryLogs } from '@/db/schema'
import type { IQueryLogRepository, QueryLog, ListResponse } from '../../application/ports/agent.port'
import type { QueryLogFiltersDTO } from '../../application/dtos/agent.dto'
import { dbExec } from '@/db/db-exec'

const buildFilters = (filters?: QueryLogFiltersDTO) => {
  const conditions = []

  if (filters?.userId)   conditions.push(eq(queryLogs.userId, filters.userId))
  if (filters?.from)     conditions.push(gte(queryLogs.createdAt, filters.from))
  if (filters?.to)       conditions.push(lte(queryLogs.createdAt, filters.to))
  if (filters?.hasError === true)  conditions.push(isNotNull(queryLogs.error))
  if (filters?.hasError === false) conditions.push(isNull(queryLogs.error))

  return conditions.length ? and(...conditions) : undefined
}

export const createQueryLogRepository = (db: Database): IQueryLogRepository => {
  return {
    async create(data, tx) {
      return dbExec('create', 'QueryLogRepository', async () => {
        const conn = (tx ?? db) as Database
        const [row] = await conn
          .insert(queryLogs)
          .values({
            userId:       data.userId,
            query:        data.query,
            filters:      data.filters as Record<string, unknown> ?? {},
            generatedSql: data.generatedSql,
            sqlValid:     data.sqlValid,
            aiResponse:   data.aiResponse,
            rowsReturned: data.rowsReturned,
            latencyMs:    data.latencyMs,
            groqModel:    data.groqModel,
            tokensUsed:   data.tokensUsed,
            error:        data.error,
            ipAddress:    data.ipAddress,
          })
          .returning()
        return row as QueryLog
      })
    },

    async findById(id) {
      return dbExec('findById', 'QueryLogRepository', async () => {
        const [row] = await db
          .select()
          .from(queryLogs)
          .where(eq(queryLogs.id, id))
          .limit(1)
        return (row as QueryLog) ?? null
      })
    },

    async findAll(filters) {
      return dbExec('findAll', 'QueryLogRepository', async () => {
        const where   = buildFilters(filters)
        const page    = filters?.page ?? 1
        const perPage = filters?.pageSize ?? 20
        const offset  = (page - 1) * perPage

        const [data, totalResult] = await Promise.all([
          db
            .select()
            .from(queryLogs)
            .where(where)
            .orderBy(desc(queryLogs.createdAt))
            .limit(perPage)
            .offset(offset),
          db.select({ count: count() }).from(queryLogs).where(where),
        ])

        const totalItems = totalResult[0].count
        return {
          data: data as QueryLog[],
          pagination: {
            currentPage: page,
            perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
          },
        } satisfies ListResponse<QueryLog[]>
      })
    },
  }
}
