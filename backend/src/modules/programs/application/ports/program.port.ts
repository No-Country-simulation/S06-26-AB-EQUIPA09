import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { DbOrTx } from '@/db/transaction'
import type { ProgramResponseDTO, CreateProgramDTO, ProgramFiltersDTO } from '../dtos/program.dto'

export interface ListResponse<T> {
  data: T
  pagination: {
    currentPage: number
    perPage:     number
    totalItems:  number
    totalPages:  number
  }
}

export interface IProgramRepository {
  create(
    data: CreateProgramDTO,
    db?: DbOrTx
  ): Promise<ProgramResponseDTO>

  findById(id: string): Promise<ProgramResponseDTO | null>

  findAll(filters?: ProgramFiltersDTO): Promise<ListResponse<ProgramResponseDTO[]>>

  findByRegion(
    regionId: string,
    filters?: { category?: string; isActive?: boolean }
  ): Promise<ProgramResponseDTO[]>

  update(
    id:   string,
    data: Partial<CreateProgramDTO & { isActive?: boolean }>,
    db?:  DbOrTx
  ): Promise<ProgramResponseDTO>

  softDelete(id: string, db?: DbOrTx): Promise<void>
}

export interface IProgramService {
  create(
    data:    CreateProgramDTO,
    staffId: string
  ): Promise<Result<ProgramResponseDTO, AppError>>

  update(
    programId: string,
    data:      Partial<CreateProgramDTO & { isActive?: boolean }>,
    staffId:   string
  ): Promise<Result<ProgramResponseDTO, AppError>>

  delete(
    programId: string,
    staffId:   string
  ): Promise<Result<void, AppError>>

  list(filters?: ProgramFiltersDTO): Promise<Result<ListResponse<ProgramResponseDTO[]>, AppError>>

  getByRegion(
    regionId: string,
    filters?: { category?: string; isActive?: boolean }
  ): Promise<Result<ProgramResponseDTO[], AppError>>

  getById(programId: string): Promise<Result<ProgramResponseDTO, AppError>>
}
