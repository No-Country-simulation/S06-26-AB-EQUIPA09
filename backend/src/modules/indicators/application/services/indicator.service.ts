import type {
  IIndicatorRepository,
  IIndicatorDataRepository,
  IIndicatorService,
} from '../ports/indicator.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { logger } from '@/shared/logger/logger'
import { auditHelpers } from '@/modules/activity/events/audit.listener'

const COMPONENT = 'IndicatorService'

export const createIndicatorService = (
  repository: IIndicatorRepository,
  dataRepository: IIndicatorDataRepository,
  regionRepo: { findById: (id: string) => Promise<{ id: string } | null> },
  indicatorRepo: { findById: (id: string) => Promise<{ id: string; direction: string } | null> },
): IIndicatorService => {
  return {
    async createIndicator(data, staffId) {
      const existing = await repository.findBySlug(data.slug)
      if (existing) {
        return Err(ErrorFactory.conflict('Slug já registado', 'slug', data.slug, COMPONENT))
      }

      const indicator = await repository.create(data)

      Promise.allSettled([
        auditHelpers.staffCreate(staffId, 'Indicator', indicator.id, {
          action: 'INDICATOR_CREATED',
          slug: data.slug,
          name: data.name,
          createdBy: staffId,
        }),
      ]).catch(err => logger.error(err, 'Background tasks failed on createIndicator'))

      return Ok(indicator)
    },

    async updateIndicator(id, data, staffId) {
      const existing = await repository.findById(id)
      if (!existing) {
        return Err(ErrorFactory.notFound('Indicador não encontrado', 'Indicator', id, COMPONENT))
      }

      const updated = await repository.update(id, data)

      Promise.allSettled([
        auditHelpers.staffUpdate(staffId, 'Indicator', id, {
          action: 'INDICATOR_UPDATED',
          fields: Object.keys(data),
          updatedBy: staffId,
        }),
      ]).catch(err => logger.error(err, 'Background tasks failed on updateIndicator'))

      return Ok(updated)
    },

    async getIndicator(id) {
      const result = await repository.findById(id)
      if (!result) {
        return Err(ErrorFactory.notFound('Indicador não encontrado', 'Indicator', id, COMPONENT))
      }
      return Ok(result)
    },

    async listIndicators(page, perPage, filters) {
      const result = await repository.findAll(page, perPage, filters)
      return Ok(result)
    },

    async upsertData(indicatorId, data, staffId) {
      const indicator = await indicatorRepo.findById(indicatorId)
      if (!indicator) {
        return Err(ErrorFactory.notFound('Indicador não encontrado', 'Indicator', indicatorId, COMPONENT))
      }

      const region = await regionRepo.findById(data.regionId)
      if (!region) {
        return Err(ErrorFactory.notFound('Região não encontrada', 'Region', data.regionId, COMPONENT))
      }

      const upsertPayload = { ...data, indicatorId }
      if (upsertPayload.normalizedValue === undefined) {
        upsertPayload.normalizedValue = Math.min(1, Math.max(0, data.value / 100))
      }

      const result = await dataRepository.upsert(upsertPayload)

      Promise.allSettled([
        auditHelpers.staffAction(staffId, 'IndicatorData', result.id, 'INDICATOR_DATA_UPSERTED', {
          indicatorId,
          regionId: data.regionId,
          period: data.period,
          value: data.value,
          upsertedBy: staffId,
        }),
      ]).catch(err => logger.error(err, 'Background tasks failed on upsertData'))

      return Ok(result)
    },

    async listData(filters) {
      const result = await dataRepository.findAll(filters)
      return Ok(result)
    },

    async getDataByRegion(regionId) {
      const result = await dataRepository.findByRegion(regionId)
      return Ok(result)
    },

    async getCritical(period) {
      const result = await dataRepository.findCritical(period)
      return Ok(result)
    },
  }
}
