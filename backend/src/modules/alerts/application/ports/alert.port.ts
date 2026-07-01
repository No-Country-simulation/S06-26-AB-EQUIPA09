import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { DbOrTx } from '@/db/transaction'
import type {
  AlertConfigResponseDTO,
  CreateAlertConfigDTO,
  AlertLogResponseDTO,
  AlertLogFiltersDTO,
} from '../dtos/alert.dto'

export interface ListResponse<T> {
  data: T
  pagination: {
    currentPage: number
    perPage:     number
    totalItems:  number
    totalPages:  number
  }
}

export interface IAlertConfigRepository {
  create(
    data: CreateAlertConfigDTO & { userId: string },
    db?: DbOrTx
  ): Promise<AlertConfigResponseDTO>

  findById(id: string): Promise<AlertConfigResponseDTO | null>

  findByUser(
    userId:  string,
    filters?: { isActive?: boolean }
  ): Promise<AlertConfigResponseDTO[]>

  findActiveByIndicator(
    indicatorId: string,
    regionId?:   string
  ): Promise<AlertConfigResponseDTO[]>

  update(
    id:   string,
    data: Partial<CreateAlertConfigDTO & { isActive?: boolean; lastCheckedAt?: Date }>,
    db?:  DbOrTx
  ): Promise<AlertConfigResponseDTO>

  delete(id: string, db?: DbOrTx): Promise<void>
}

export interface IAlertLogRepository {
  create(
    data: Omit<AlertLogResponseDTO, 'id' | 'region' | 'indicator'>,
    db?: DbOrTx
  ): Promise<AlertLogResponseDTO>

  findByUser(
    userId:  string,
    filters?: AlertLogFiltersDTO
  ): Promise<ListResponse<AlertLogResponseDTO[]>>

  findByConfig(configId: string): Promise<AlertLogResponseDTO[]>
}

export interface IAlertService {
  createConfig(
    data:   CreateAlertConfigDTO,
    userId: string
  ): Promise<Result<AlertConfigResponseDTO, AppError>>

  updateConfig(
    configId: string,
    data:     Partial<CreateAlertConfigDTO & { isActive?: boolean }>,
    userId:   string
  ): Promise<Result<AlertConfigResponseDTO, AppError>>

  deleteConfig(
    configId: string,
    userId:   string
  ): Promise<Result<void, AppError>>

  listMyConfigs(userId: string): Promise<Result<AlertConfigResponseDTO[], AppError>>

  checkAndFire(
    indicatorId:     string,
    regionId:        string,
    period:          string,
    normalizedValue: number
  ): Promise<void>

  listMyAlertLogs(
    userId:  string,
    filters?: AlertLogFiltersDTO
  ): Promise<Result<ListResponse<AlertLogResponseDTO[]>, AppError>>
}
