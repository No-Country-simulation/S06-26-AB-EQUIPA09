import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { DbOrTx } from '@/db/transaction'
import type {
  DataSourceResponseDTO,
  CreateDataSourceDTO,
  UpdateDataSourceDTO,
  CDRViewRowDTO,
  IngestionResultDTO,
  StreamingProgress,
} from '../dtos/ingestion.dto'

export interface ListResponse<T> {
  data: T
  pagination: {
    currentPage: number
    perPage: number
    totalItems: number
    totalPages: number
  }
}

export interface IDataSourceRepository {
  create(data: CreateDataSourceDTO & { slug: string }, db?: DbOrTx): Promise<DataSourceResponseDTO>
  findById(id: string): Promise<DataSourceResponseDTO | null>
  findBySlug(slug: string): Promise<DataSourceResponseDTO | null>
  findAll(
    page: number,
    pageSize: number,
    filters?: { isActive?: boolean; country?: string }
  ): Promise<ListResponse<DataSourceResponseDTO[]>>
  update(id: string, data: Partial<UpdateDataSourceDTO>, db?: DbOrTx): Promise<DataSourceResponseDTO>
  updateLastIngestedAt(id: string, db?: DbOrTx): Promise<void>
}

export interface ICDRViewRecordRepository {
  bulkInsert(rows: CDRViewRowDTO[], db?: DbOrTx): Promise<number>
  findByRegion(regionId: string, limit?: number, offset?: number): Promise<CDRViewRowDTO[]>
  countByRegionAndPeriod(regionId: string, from: Date, to: Date): Promise<number>
}

export interface IIngestionService {
  registerDataSource(data: CreateDataSourceDTO): Promise<Result<DataSourceResponseDTO, AppError>>
  updateDataSource(id: string, data: UpdateDataSourceDTO): Promise<Result<DataSourceResponseDTO, AppError>>
  listDataSources(
    page: number,
    pageSize: number,
    filters?: { isActive?: boolean; country?: string }
  ): Promise<Result<ListResponse<DataSourceResponseDTO[]>, AppError>>
  getDataSource(id: string): Promise<Result<DataSourceResponseDTO, AppError>>
  runCDRViewPipeline(
    sourceId: string,
    csvContent: string
  ): Promise<Result<IngestionResultDTO, AppError>>
  runCDRViewPipelineStream(
    sourceId: string,
    stream: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
    onProgress?: (progress: StreamingProgress) => void
  ): Promise<Result<IngestionResultDTO, AppError>>
  getRecordsByRegion(
    regionId: string,
    limit?: number,
    offset?: number
  ): Promise<Result<CDRViewRowDTO[], AppError>>
}
