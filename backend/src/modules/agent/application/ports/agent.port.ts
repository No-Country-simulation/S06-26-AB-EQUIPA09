import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { DbOrTx } from '@/db/transaction'
import type { AgentQueryDTO, AgentResponseDTO, QueryLogFiltersDTO } from '../dtos/agent.dto'
import type { InferSelectModel } from 'drizzle-orm'
import type { queryLogs } from '@/db/schema'

export type QueryLog = InferSelectModel<typeof queryLogs>

export interface ListResponse<T> {
  data: T
  pagination: {
    currentPage: number
    perPage:     number
    totalItems:  number
    totalPages:  number
  }
}

export interface IQueryLogRepository {
  create(
    data: Omit<QueryLog, 'id' | 'createdAt'>,
    db?: DbOrTx
  ): Promise<QueryLog>

  findById(id: string): Promise<QueryLog | null>

  findAll(filters?: QueryLogFiltersDTO): Promise<ListResponse<QueryLog[]>>
}

export interface IAgentService {
  query(
    data:      AgentQueryDTO,
    userId?:   string,
    ipAddress?: string
  ): Promise<Result<AgentResponseDTO, AppError>>

  getLog(
    queryId: string
  ): Promise<Result<QueryLog, AppError>>

  listLogs(
    filters?: QueryLogFiltersDTO
  ): Promise<Result<ListResponse<QueryLog[]>, AppError>>

  listMyLogs(
    userId:  string,
    filters?: { page?: number; pageSize?: number }
  ): Promise<Result<ListResponse<QueryLog[]>, AppError>>
}
