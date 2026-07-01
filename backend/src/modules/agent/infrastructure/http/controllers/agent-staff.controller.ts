import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createQueryLogRepository } from '../../persistence/query-log.repository'
import { createAgentService } from '@/modules/agent/application/services/agent.service'
import { staffAuthMiddleware } from '@/middlewares/staff-auth.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import { queryLogFiltersSchema, queryLogIdSchema } from '../../../application/dtos/agent.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { QueryLog } from '../../../application/ports/agent.port'
import type { ListResponse } from '../../../application/ports/agent.port'

const queryLogRepo = createQueryLogRepository(db)
const agentSvc     = createAgentService(queryLogRepo)

export const agentStaffController = new Elysia({ prefix: '/staff' })
  .use(staffAuthMiddleware())

  .get('/query-logs',
    async ({ query }): Promise<Result<ListResponse<QueryLog[]>, AppError>> => {
      const v = validateWithZod(queryLogFiltersSchema, query, 'AgentStaffController')
      if (!v.success) return v
      return agentSvc.listLogs(v.value)
    },
    {
      query: t.Object({
        userId:   t.Optional(t.String()),
        from:     t.Optional(t.String()),
        to:       t.Optional(t.String()),
        hasError: t.Optional(t.Boolean()),
        page:     t.Optional(t.Number()),
        pageSize: t.Optional(t.Number()),
      }),
      detail: { tags: ['staff-agent'], summary: 'Listar query logs' },
    }
  )

  .get('/query-logs/:id',
    async ({ params }): Promise<Result<QueryLog, AppError>> => {
      const v = validateWithZod(queryLogIdSchema, params, 'AgentStaffController')
      if (!v.success) return v
      return agentSvc.getLog(v.value.id)
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['staff-agent'], summary: 'Detalhe do query log' },
    }
  )
