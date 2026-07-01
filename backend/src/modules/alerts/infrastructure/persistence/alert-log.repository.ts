import { eq, count, desc, and, gte, lte } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import type { Database } from '@/db'
import { alertLogs, alertConfigs, indicators, regions } from '@/db/schema'
import type { IAlertLogRepository, ListResponse } from '../../application/ports/alert.port'
import type { AlertLogResponseDTO } from '../../application/dtos/alert.dto'
import { dbExec } from '@/db/db-exec'

type AlertLogSelect = InferSelectModel<typeof alertLogs>

const toAlertLogResponseDTO = (
  row: AlertLogSelect & {
    indicator?: { id: string; slug: string; name: string; unit: string; category: string }
    region?:    { id: string; name: string; municipality: string; state: string }
  }
): AlertLogResponseDTO => ({
  id:               row.id,
  configId:         row.configId,
  regionId:         row.regionId,
  indicatorId:      row.indicatorId,
  currentValue:     row.currentValue,
  criticalThreshold: row.criticalThreshold,
  period:           row.period,
  sentAt:           row.sentAt,
  channel:          row.channel,
  indicator:        row.indicator ?? { id: row.indicatorId, slug: '', name: '', unit: '', category: '' },
  region:           row.region ?? { id: row.regionId, name: '', municipality: '', state: '' },
})

export const createAlertLogRepository = (db: Database): IAlertLogRepository => {
  return {
    async create(data, tx) {
      return dbExec('create', 'AlertLogRepository', async () => {
        const conn = (tx ?? db) as Database
        const [row] = await conn
          .insert(alertLogs)
          .values({
            configId:         data.configId,
            regionId:         data.regionId,
            indicatorId:      data.indicatorId,
            currentValue:     data.currentValue,
            criticalThreshold: data.criticalThreshold,
            period:           data.period,
            sentAt:           data.sentAt,
            channel:          data.channel,
          })
          .returning()

        const [enriched] = await db
          .select()
          .from(alertLogs)
          .where(eq(alertLogs.id, row.id))
          .leftJoin(indicators, eq(alertLogs.indicatorId, indicators.id))
          .leftJoin(regions, eq(alertLogs.regionId, regions.id))
          .limit(1)

        return toAlertLogResponseDTO({
          ...enriched.alert_logs,
          indicator: enriched.indicators ? {
            id: enriched.indicators.id,
            slug: enriched.indicators.slug,
            name: enriched.indicators.name,
            unit: enriched.indicators.unit,
            category: enriched.indicators.category,
          } : undefined,
          region: enriched.regions ? {
            id: enriched.regions.id,
            name: enriched.regions.name,
            municipality: enriched.regions.municipality,
            state: enriched.regions.state,
          } : undefined,
        })
      })
    },

    async findByUser(userId, filters) {
      return dbExec('findByUser', 'AlertLogRepository', async () => {
        const page    = filters?.page ?? 1
        const perPage = filters?.pageSize ?? 20
        const offset  = (page - 1) * perPage

        const conditions = [eq(alertConfigs.userId, userId)]

        if (filters?.from) conditions.push(gte(alertLogs.sentAt, filters.from))
        if (filters?.to)   conditions.push(lte(alertLogs.sentAt, filters.to))

        const [data, totalResult] = await Promise.all([
          db
            .select()
            .from(alertLogs)
            .innerJoin(alertConfigs, eq(alertLogs.configId, alertConfigs.id))
            .leftJoin(indicators, eq(alertLogs.indicatorId, indicators.id))
            .leftJoin(regions, eq(alertLogs.regionId, regions.id))
            .where(and(...conditions))
            .orderBy(desc(alertLogs.sentAt))
            .limit(perPage)
            .offset(offset),
          db
            .select({ count: count() })
            .from(alertLogs)
            .innerJoin(alertConfigs, eq(alertLogs.configId, alertConfigs.id))
            .where(and(...conditions)),
        ])

        const totalItems = totalResult[0].count
        return {
          data: data.map(row => toAlertLogResponseDTO({
            ...row.alert_logs,
            indicator: row.indicators ? {
              id: row.indicators.id,
              slug: row.indicators.slug,
              name: row.indicators.name,
              unit: row.indicators.unit,
              category: row.indicators.category,
            } : undefined,
            region: row.regions ? {
              id: row.regions.id,
              name: row.regions.name,
              municipality: row.regions.municipality,
              state: row.regions.state,
            } : undefined,
          })),
          pagination: {
            currentPage: page,
            perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
          },
        } satisfies ListResponse<AlertLogResponseDTO[]>
      })
    },

    async findByConfig(configId) {
      return dbExec('findByConfig', 'AlertLogRepository', async () => {
        const rows = await db
          .select()
          .from(alertLogs)
          .where(eq(alertLogs.configId, configId))
          .leftJoin(indicators, eq(alertLogs.indicatorId, indicators.id))
          .leftJoin(regions, eq(alertLogs.regionId, regions.id))
          .orderBy(desc(alertLogs.sentAt))

        return rows.map(row => toAlertLogResponseDTO({
          ...row.alert_logs,
          indicator: row.indicators ? {
            id: row.indicators.id,
            slug: row.indicators.slug,
            name: row.indicators.name,
            unit: row.indicators.unit,
            category: row.indicators.category,
          } : undefined,
          region: row.regions ? {
            id: row.regions.id,
            name: row.regions.name,
            municipality: row.regions.municipality,
            state: row.regions.state,
          } : undefined,
        }))
      })
    },
  }
}
