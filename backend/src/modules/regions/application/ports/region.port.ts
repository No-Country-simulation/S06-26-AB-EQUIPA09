import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { DbOrTx } from '@/db/transaction'
import type { RegionResponseDTO, BaseStationResponseDTO, RegionFiltersDTO } from '../dtos/region.dto'

export interface IRegionRepository {
  upsertRegion(data: Omit<RegionResponseDTO, 'id' | 'createdAt'>, db?: DbOrTx): Promise<RegionResponseDTO>
  findById(id: string): Promise<RegionResponseDTO | null>
  findByZoneId(zoneId: string): Promise<RegionResponseDTO | null>
  findAll(filters?: RegionFiltersDTO): Promise<{ data: RegionResponseDTO[]; total: number }>
  listStates(country?: string): Promise<string[]>
  listMunicipalities(state: string): Promise<string[]>

  upsertBaseStation(data: Omit<BaseStationResponseDTO, 'id'>, db?: DbOrTx): Promise<BaseStationResponseDTO>
  findStationsByRegion(regionId: string, filters?: { technology?: string; isActive?: boolean }): Promise<BaseStationResponseDTO[]>
}

export interface IRegionService {
  getRegion(regionId: string): Promise<Result<RegionResponseDTO, AppError>>
  listRegions(filters?: RegionFiltersDTO): Promise<Result<{ data: RegionResponseDTO[]; total: number }, AppError>>
  listStates(country?: string): Promise<Result<string[], AppError>>
  listMunicipalities(state: string): Promise<Result<string[], AppError>>
  getBaseStations(regionId: string, filters?: { technology?: string }): Promise<Result<BaseStationResponseDTO[], AppError>>
}
