import type { IAlertConfigRepository, IAlertLogRepository, IAlertService } from '../ports/alert.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { auditHelpers } from '@/modules/activity/application/services/audit-logger'
import { logger } from '@/shared/logger/logger'
import { withTransaction } from '@/db/transaction'

const COMPONENT = 'AlertService'

export const createAlertService = (
  configRepo: IAlertConfigRepository,
  logRepo:    IAlertLogRepository,
): IAlertService => {
  return {
    async createConfig(data, userId) {
      return withTransaction(async (tx) => {
        const config = await configRepo.create(
          { ...data, userId },
          tx,
        )

        await auditHelpers.create(userId, 'AlertConfig', config.id, {
          action: 'ALERT_CONFIG_CREATED',
          indicatorId: data.indicatorId,
          regionId: data.regionId,
          criticalThreshold: data.criticalThreshold,
        })

        return Ok(config)
      })
    },

    async updateConfig(configId, data, userId) {
      const config = await configRepo.findById(configId)
      if (!config) {
        return Err(ErrorFactory.notFound('Configuração de alerta não encontrada', 'AlertConfig', configId, COMPONENT))
      }
      if (config.userId !== userId) {
        return Err(ErrorFactory.forbidden('Não tens permissão para alterar esta configuração', undefined, COMPONENT))
      }

      const updated = await configRepo.update(configId, data)

      Promise.allSettled([
        auditHelpers.update(userId, 'AlertConfig', configId, {
          action: 'ALERT_CONFIG_UPDATED',
          fields: Object.keys(data),
        }),
      ]).catch(err => logger.error(err, 'Background tasks failed on alert config update'))

      return Ok(updated)
    },

    async deleteConfig(configId, userId) {
      const config = await configRepo.findById(configId)
      if (!config) {
        return Err(ErrorFactory.notFound('Configuração de alerta não encontrada', 'AlertConfig', configId, COMPONENT))
      }
      if (config.userId !== userId) {
        return Err(ErrorFactory.forbidden('Não tens permissão para eliminar esta configuração', undefined, COMPONENT))
      }

      await configRepo.delete(configId)

      Promise.allSettled([
        auditHelpers.delete(userId, 'AlertConfig', configId, {
          action: 'ALERT_CONFIG_DELETED',
        }),
      ]).catch(err => logger.error(err, 'Background tasks failed on alert config delete'))

      return Ok(undefined)
    },

    async listMyConfigs(userId) {
      const configs = await configRepo.findByUser(userId)
      return Ok(configs)
    },

    async checkAndFire(indicatorId, regionId, period, normalizedValue) {
      try {
        const configs = await configRepo.findActiveByIndicator(indicatorId, regionId)

        for (const config of configs) {
          if (normalizedValue < config.criticalThreshold) {
            try {
              await withTransaction(async (tx) => {
                await logRepo.create({
                  configId:         config.id,
                  regionId,
                  indicatorId,
                  currentValue:     normalizedValue,
                  criticalThreshold: config.criticalThreshold,
                  period,
                  sentAt:           new Date(),
                  channel:          config.channel,
                }, tx)

                await configRepo.update(config.id, { lastCheckedAt: new Date() }, tx)

                logger.info({
                  configId: config.id,
                  userId: config.userId,
                  indicatorId,
                  regionId,
                  period,
                  normalizedValue,
                  threshold: config.criticalThreshold,
                }, 'Alert fired')
              })
            } catch (err) {
              logger.error({ err, configId: config.id }, 'Failed to process alert fire')
            }
          }
        }
      } catch (err) {
        logger.error({ err, indicatorId, regionId }, 'checkAndFire failed')
      }
    },

    async listMyAlertLogs(userId, filters) {
      const result = await logRepo.findByUser(userId, filters)
      return Ok(result)
    },
  }
}
