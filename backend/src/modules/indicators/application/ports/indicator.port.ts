import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { DbOrTx } from '@/db/transaction'
import type {
  IndicatorResponseDTO,
  CreateIndicatorDTO,
  UpdateIndicatorDTO,
  IndicatorDataResponseDTO,
  UpsertIndicatorDataDTO,
  IndicatorDataFiltersDTO,
} from '../dtos/indicator.dto'

export interface ListResponse<T> {
  data: T
  pagination: {
    currentPage: number
    perPage:     number
    totalItems:  number
    totalPages:  number
  }
}

export interface IIndicatorRepository {
  create(
    data: CreateIndicatorDTO,
    db?: DbOrTx
  ): Promise<IndicatorResponseDTO>

  findById(id: string): Promise<IndicatorResponseDTO | null>

  findBySlug(slug: string): Promise<IndicatorResponseDTO | null>

  findAll(
    page: number,
    perPage: number,
    filters?: { category?: string; isActive?: boolean }
  ): Promise<ListResponse<IndicatorResponseDTO[]>>

  update(
    id: string,
    data: Partial<UpdateIndicatorDTO>,
    db?: DbOrTx
  ): Promise<IndicatorResponseDTO>

  findActive(): Promise<IndicatorResponseDTO[]>
}

export interface IIndicatorDataRepository {
  upsert(
    data: UpsertIndicatorDataDTO,
    db?: DbOrTx
  ): Promise<IndicatorDataResponseDTO>

  findByKey(
    regionId: string,
    indicatorId: string,
    period: string
  ): Promise<IndicatorDataResponseDTO | null>

  findAll(
    filters?: IndicatorDataFiltersDTO
  ): Promise<IndicatorDataResponseDTO[]>

  findByRegion(regionId: string): Promise<IndicatorDataResponseDTO[]>

  findCritical(period?: string): Promise<IndicatorDataResponseDTO[]>
}

export interface IIndicatorService {
  createIndicator(
    data: CreateIndicatorDTO,
    staffId: string
  ): Promise<Result<IndicatorResponseDTO, AppError>>

  updateIndicator(
    id: string,
    data: UpdateIndicatorDTO,
    staffId: string
  ): Promise<Result<IndicatorResponseDTO, AppError>>

  getIndicator(
    id: string
  ): Promise<Result<IndicatorResponseDTO, AppError>>

  listIndicators(
    page: number,
    perPage: number,
    filters?: { category?: string; isActive?: boolean }
  ): Promise<Result<ListResponse<IndicatorResponseDTO[]>, AppError>>

  upsertData(
    indicatorId: string,
    data: UpsertIndicatorDataDTO,
    staffId: string
  ): Promise<Result<IndicatorDataResponseDTO, AppError>>

  listData(
    filters?: IndicatorDataFiltersDTO
  ): Promise<Result<IndicatorDataResponseDTO[], AppError>>

  getDataByRegion(regionId: string): Promise<Result<IndicatorDataResponseDTO[], AppError>>

  getCritical(period?: string): Promise<Result<IndicatorDataResponseDTO[], AppError>>
}
