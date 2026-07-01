import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { DbOrTx } from '@/db/transaction'
import type { CoverageResponseDTO, CoverageFiltersDTO } from '../dtos/coverage.dto'

export interface IRegionCoverageRepository {
  upsert(
    data: {
      regionId:                string
      period:                  string
      networkCoverageScore:    number
      maxConcentration:        number
      minConcentration:        number
      avgDaytimeConcentration: number | null
      avgNighttimeConcentration: number | null
      dominantTechnology:      string | null
      no4gOr5gCoverage:        boolean
      totalRecords:            number
    },
    db?: DbOrTx
  ): Promise<CoverageResponseDTO>

  findByRegionAndPeriod(
    regionId: string,
    period: string
  ): Promise<CoverageResponseDTO | null>

  findByRegion(regionId: string): Promise<CoverageResponseDTO[]>

  findAll(
    filters?: CoverageFiltersDTO
  ): Promise<CoverageResponseDTO[]>

  findCriticalZones(period?: string): Promise<CoverageResponseDTO[]>
}

export interface ICoverageService {
  recomputeRegion(
    regionId: string,
    period: string,
  ): Promise<Result<CoverageResponseDTO, AppError>>

  getCoverage(
    regionId: string,
    period: string
  ): Promise<Result<CoverageResponseDTO, AppError>>

  listCoverage(
    filters?: CoverageFiltersDTO
  ): Promise<Result<CoverageResponseDTO[], AppError>>

  getCriticalZones(period?: string): Promise<Result<CoverageResponseDTO[], AppError>>
}
