import type { IRegionRepository, IRegionService } from '../ports/region.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'

const COMPONENT = 'RegionService'

export const createRegionService = (repository: IRegionRepository): IRegionService => ({
  async getRegion(regionId) {
    const region = await repository.findById(regionId)
    if (!region) {
      return Err(ErrorFactory.notFound('Região não encontrada', 'Region', regionId, COMPONENT))
    }
    return Ok(region)
  },

  async listRegions(filters) {
    const result = await repository.findAll(filters)
    return Ok(result)
  },

  async listStates(country) {
    const states = await repository.listStates(country)
    return Ok(states)
  },

  async listMunicipalities(state) {
    const municipalities = await repository.listMunicipalities(state)
    return Ok(municipalities)
  },

  async getBaseStations(regionId, filters) {
    const region = await repository.findById(regionId)
    if (!region) {
      return Err(ErrorFactory.notFound('Região não encontrada', 'Region', regionId, COMPONENT))
    }
    const stations = await repository.findStationsByRegion(regionId, filters)
    return Ok(stations)
  },
})
