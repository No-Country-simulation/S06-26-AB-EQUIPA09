import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createAlertConfigRepository } from '../../persistence/alert-config.repository'
import { createAlertLogRepository } from '../../persistence/alert-log.repository'
import { createAlertService } from '@/modules/alerts/application/services/alert.service'
import { authMiddleware, requireUser } from '@/middlewares/auth.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import {
  createAlertConfigSchema,
  updateAlertConfigSchema,
  alertLogFiltersSchema,
  alertConfigIdSchema,
} from '../../../application/dtos/alert.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { AlertConfigResponseDTO, AlertLogResponseDTO } from '../../../application/dtos/alert.dto'
import type { ListResponse } from '../../../application/ports/alert.port'

const configRepo = createAlertConfigRepository(db)
const logRepo    = createAlertLogRepository(db)
const alertSvc   = createAlertService(configRepo, logRepo)

export const alertController = new Elysia({ prefix: '/alerts' })
  .use(authMiddleware())

  .get('/configs',
    async ({ user }): Promise<Result<AlertConfigResponseDTO[], AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx
      return alertSvc.listMyConfigs(userCtx.value.userId)
    },
    { detail: { tags: ['alerts'], summary: 'Listar configurações de alerta' } }
  )

  .post('/configs',
    async ({ user, body }): Promise<Result<AlertConfigResponseDTO, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx
      const v = validateWithZod(createAlertConfigSchema, body, 'AlertController')
      if (!v.success) return v
      return alertSvc.createConfig(v.value, userCtx.value.userId)
    },
    {
      body: t.Object({
        indicatorId:       t.String(),
        regionId:          t.Optional(t.String()),
        criticalThreshold: t.Number(),
        channel:           t.Optional(t.String()),
      }),
      detail: { tags: ['alerts'], summary: 'Criar configuração de alerta' },
    }
  )

  .patch('/configs/:id',
    async ({ user, params, body }): Promise<Result<AlertConfigResponseDTO, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx
      const pv = validateWithZod(alertConfigIdSchema, params, 'AlertController')
      if (!pv.success) return pv
      const bv = validateWithZod(updateAlertConfigSchema, body, 'AlertController')
      if (!bv.success) return bv
      return alertSvc.updateConfig(pv.value.id, bv.value, userCtx.value.userId)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['alerts'], summary: 'Actualizar configuração de alerta' },
    }
  )

  .delete('/configs/:id',
    async ({ user, params }): Promise<Result<void, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx
      const v = validateWithZod(alertConfigIdSchema, params, 'AlertController')
      if (!v.success) return v
      return alertSvc.deleteConfig(v.value.id, userCtx.value.userId)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['alerts'], summary: 'Remover configuração de alerta' },
    }
  )

  .get('/logs',
    async ({ user, query }): Promise<Result<ListResponse<AlertLogResponseDTO[]>, AppError>> => {
      const userCtx = requireUser(user)
      if (!userCtx.success) return userCtx
      const v = validateWithZod(alertLogFiltersSchema, query, 'AlertController')
      if (!v.success) return v
      return alertSvc.listMyAlertLogs(userCtx.value.userId, v.value)
    },
    {
      query: t.Object({
        from:     t.Optional(t.String()),
        to:       t.Optional(t.String()),
        page:     t.Optional(t.Number()),
        pageSize: t.Optional(t.Number()),
      }),
      detail: { tags: ['alerts'], summary: 'Histórico de alertas' },
    }
  )
