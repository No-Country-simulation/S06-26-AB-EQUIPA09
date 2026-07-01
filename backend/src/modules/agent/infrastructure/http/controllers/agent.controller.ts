import { Elysia, t } from 'elysia'
import { db } from '@/db'
import { createQueryLogRepository } from '../../persistence/query-log.repository'
import { createAgentService } from '@/modules/agent/application/services/agent.service'
import { authMiddleware, requireUser, optionalAuthMiddleware } from '@/middlewares/auth.middleware'
import { validateWithZod } from '@/shared/result/zod-integration'
import { agentQuerySchema } from '../../../application/dtos/agent.dto'
import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { QueryLog } from '../../../application/ports/agent.port'
import type { AgentResponseDTO } from '../../../application/dtos/agent.dto'
import type { ListResponse } from '../../../application/ports/agent.port'

const queryLogRepo = createQueryLogRepository(db)
const agentSvc     = createAgentService(queryLogRepo)

export const agentController = new Elysia({ prefix: '/agent' })

  .group('', app => app
    .use(optionalAuthMiddleware())

    .post('/query',
      async ({ body, request, userId }): Promise<Result<AgentResponseDTO, AppError>> => {
        const v = validateWithZod(agentQuerySchema, body, 'AgentController')
        if (!v.success) return v

        const ipAddress = request.headers.get('x-forwarded-for') ?? undefined
        return agentSvc.query(
          v.value,
          userId ?? undefined,
          ipAddress,
        )
      },
      {
        body: t.Object({
          query:   t.String(),
          filters: t.Optional(t.Object({
            region:    t.Optional(t.String()),
            indicator: t.Optional(t.String()),
            period:    t.Optional(t.String()),
          })),
        }),
        detail: { tags: ['agent'], summary: 'Pergunta em linguagem natural' },
      }
    )
  )

  .group('', app => app
    .use(authMiddleware())

    .get('/history',
      async ({ user }): Promise<Result<ListResponse<QueryLog[]>, AppError>> => {
        const userCtx = requireUser(user)
        if (!userCtx.success) return userCtx
        return agentSvc.listMyLogs(userCtx.value.userId)
      },
      { detail: { tags: ['agent'], summary: 'Histórico das minhas perguntas' } }
    )
  )
