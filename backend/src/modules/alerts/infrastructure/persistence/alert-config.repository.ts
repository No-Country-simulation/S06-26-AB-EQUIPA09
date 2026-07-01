import { eq, and, or, isNull, asc, type SQL } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import type { Database } from '@/db'
import { alertConfigs, indicators, regions } from '@/db/schema'
import type { IAlertConfigRepository } from '../../application/ports/alert.port'
import type { AlertConfigResponseDTO } from '../../application/dtos/alert.dto'
import { dbExec } from '@/db/db-exec'

type AlertConfigSelect = InferSelectModel<typeof alertConfigs>

const toAlertConfigResponseDTO = (
  row: AlertConfigSelect & {
    indicator?: { id: string; slug: string; name: string; unit: string; category: string }
    region?:    { id: string; name: string; municipality: string; state: string } | null
  }
): AlertConfigResponseDTO => ({
  id:               row.id,
  userId:           row.userId,
  indicatorId:      row.indicatorId,
  indicator:        row.indicator ?? { id: row.indicatorId, slug: '', name: '', unit: '', category: '' },
  regionId:         row.regionId ?? null,
  region:           row.region ?? null,
  criticalThreshold: row.criticalThreshold,
  isActive:         row.isActive,
  channel:          row.channel,
  lastCheckedAt:    row.lastCheckedAt ?? null,
  createdAt:        row.createdAt,
})

export const createAlertConfigRepository = (db: Database): IAlertConfigRepository => {
  return {
    async create(data, tx) {
      return dbExec('create', 'AlertConfigRepository', async () => {
        const conn = (tx ?? db) as Database
        const [row] = await conn
          .insert(alertConfigs)
          .values({
            userId:           data.userId,
            indicatorId:      data.indicatorId,
            regionId:         data.regionId ?? null,
            criticalThreshold: data.criticalThreshold,
            channel:          data.channel ?? 'in_app',
          })
          .returning()

        const [enriched] = await db
          .select()
          .from(alertConfigs)
          .where(eq(alertConfigs.id, row.id))
          .leftJoin(indicators, eq(alertConfigs.indicatorId, indicators.id))
          .leftJoin(regions, eq(alertConfigs.regionId, regions.id))
          .limit(1)

        return toAlertConfigResponseDTO({
          ...enriched.alert_configs,
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
          } : null,
        })
      })
    },

    async findById(id) {
      return dbExec('findById', 'AlertConfigRepository', async () => {
        const [row] = await db
          .select()
          .from(alertConfigs)
          .where(eq(alertConfigs.id, id))
          .leftJoin(indicators, eq(alertConfigs.indicatorId, indicators.id))
          .leftJoin(regions, eq(alertConfigs.regionId, regions.id))
          .limit(1)

        if (!row) return null
        return toAlertConfigResponseDTO({
          ...row.alert_configs,
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
          } : null,
        })
      })
    },

    async findByUser(userId, filters) {
      return dbExec('findByUser', 'AlertConfigRepository', async () => {
        const conditions = [eq(alertConfigs.userId, userId)]
        if (filters?.isActive !== undefined) {
          conditions.push(eq(alertConfigs.isActive, filters.isActive))
        }

        const rows = await db
          .select()
          .from(alertConfigs)
          .where(and(...conditions))
          .leftJoin(indicators, eq(alertConfigs.indicatorId, indicators.id))
          .leftJoin(regions, eq(alertConfigs.regionId, regions.id))
          .orderBy(asc(alertConfigs.createdAt))

        return rows.map(row => toAlertConfigResponseDTO({
          ...row.alert_configs,
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
          } : null,
        }))
      })
    },

    async findActiveByIndicator(indicatorId, regionId) {
      return dbExec('findActiveByIndicator', 'AlertConfigRepository', async () => {
        const conditions: SQL[] = [
          eq(alertConfigs.indicatorId, indicatorId),
          eq(alertConfigs.isActive, true),
        ]

        if (regionId) {
          conditions.push(
            or(
              eq(alertConfigs.regionId, regionId),
              isNull(alertConfigs.regionId),
            )!,
          )
        }

        const rows = await db
          .select()
          .from(alertConfigs)
          .where(and(...conditions))
          .leftJoin(indicators, eq(alertConfigs.indicatorId, indicators.id))
          .leftJoin(regions, eq(alertConfigs.regionId, regions.id))

        return rows.map(row => toAlertConfigResponseDTO({
          ...row.alert_configs,
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
          } : null,
        }))
      })
    },

    async update(id, data, tx) {
      return dbExec('update', 'AlertConfigRepository', async () => {
        const conn = (tx ?? db) as Database
        const updateData: Record<string, unknown> = { updatedAt: new Date() }

        if (data.indicatorId       !== undefined) updateData.indicatorId       = data.indicatorId
        if (data.regionId          !== undefined) updateData.regionId          = data.regionId
        if (data.criticalThreshold !== undefined) updateData.criticalThreshold = data.criticalThreshold
        if (data.isActive          !== undefined) updateData.isActive          = data.isActive
        if (data.channel           !== undefined) updateData.channel           = data.channel
        if (data.lastCheckedAt     !== undefined) updateData.lastCheckedAt     = data.lastCheckedAt

        const [row] = await conn
          .update(alertConfigs)
          .set(updateData)
          .where(eq(alertConfigs.id, id))
          .returning()

        const [enriched] = await db
          .select()
          .from(alertConfigs)
          .where(eq(alertConfigs.id, row.id))
          .leftJoin(indicators, eq(alertConfigs.indicatorId, indicators.id))
          .leftJoin(regions, eq(alertConfigs.regionId, regions.id))
          .limit(1)

        return toAlertConfigResponseDTO({
          ...enriched.alert_configs,
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
          } : null,
        })
      })
    },

    async delete(id, tx) {
      return dbExec('delete', 'AlertConfigRepository', async () => {
        const conn = (tx ?? db) as Database
        await conn
          .delete(alertConfigs)
          .where(eq(alertConfigs.id, id))
      })
    },
  }
}
