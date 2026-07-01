import type { IRegionCoverageRepository, ICoverageService } from '../ports/coverage.port'
import { Ok, Err } from '@/shared/result/types'
import { ErrorFactory } from '@/shared/result/factory'
import { logger } from '@/shared/logger/logger'

const COMPONENT = 'CoverageService'

type TechnologyWeight = { weight: number; is4gOr5g: boolean }

const TECHNOLOGY_WEIGHTS: Record<string, TechnologyWeight> = {
  '5G': { weight: 1.0, is4gOr5g: true },
  '4G': { weight: 0.9, is4gOr5g: true },
  '3G': { weight: 0.6, is4gOr5g: false },
  '2G': { weight: 0.3, is4gOr5g: false },
}

export const createCoverageService = (
  repository: IRegionCoverageRepository,
  cdrviewRepo: {
    findByRegionAndPeriod: (regionId: string, period: string) => Promise<Array<{
      peopleCount:        number
      signalStrength:     number | null
      networkTechnology:  string | null
      hourOfDay:          number
    }>>
  },
  regionRepo: {
    findById: (id: string) => Promise<{ id: string } | null>
  },
): ICoverageService => {
  return {
    async recomputeRegion(regionId, period) {
      const region = await regionRepo.findById(regionId)
      if (!region) {
        return Err(ErrorFactory.notFound('Região não encontrada', 'Region', regionId, COMPONENT))
      }

      const records = await cdrviewRepo.findByRegionAndPeriod(regionId, period)
      if (records.length === 0) {
        return Err(ErrorFactory.notFound('Nenhum registo CDRView encontrado para o período', 'CdrviewRecord', regionId, COMPONENT))
      }

      let weightedScoreSum = 0
      let weightSum = 0
      let maxConcentration = 0
      let minConcentration = Infinity
      let daytimeSum = 0
      let daytimeCount = 0
      let nighttimeSum = 0
      let nighttimeCount = 0
      const techCounts: Record<string, number> = {}
      let has4gOr5g = false

      for (const record of records) {
        const conc = record.peopleCount
        if (conc > maxConcentration) maxConcentration = conc
        if (conc < minConcentration) minConcentration = conc

        if (record.hourOfDay >= 8 && record.hourOfDay <= 18) {
          daytimeSum += conc
          daytimeCount++
        } else {
          nighttimeSum += conc
          nighttimeCount++
        }

        const tech = record.networkTechnology ?? 'unknown'
        techCounts[tech] = (techCounts[tech] ?? 0) + 1

        if (record.signalStrength !== null) {
          const tw = TECHNOLOGY_WEIGHTS[tech] ?? { weight: 0.1, is4gOr5g: false }
          weightedScoreSum += record.signalStrength * tw.weight
          weightSum += tw.weight
          if (tw.is4gOr5g) has4gOr5g = true
        }
      }

      const networkCoverageScore = weightSum > 0 ? weightedScoreSum / weightSum : 0
      const avgDaytimeConcentration = daytimeCount > 0 ? daytimeSum / daytimeCount : null
      const avgNighttimeConcentration = nighttimeCount > 0 ? nighttimeSum / nighttimeCount : null

      const dominantTechnology = Object.entries(techCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      const no4gOr5gCoverage = !has4gOr5g

      const result = await repository.upsert({
        regionId,
        period,
        networkCoverageScore,
        maxConcentration,
        minConcentration: minConcentration === Infinity ? 0 : minConcentration,
        avgDaytimeConcentration,
        avgNighttimeConcentration,
        dominantTechnology,
        no4gOr5gCoverage,
        totalRecords: records.length,
      })

      logger.info({ regionId, period, networkCoverageScore, no4gOr5gCoverage }, 'Region coverage recomputed')

      return Ok(result)
    },

    async getCoverage(regionId, period) {
      const coverage = await repository.findByRegionAndPeriod(regionId, period)
      if (!coverage) {
        return Err(ErrorFactory.notFound('Cobertura não encontrada para a região e período', 'RegionCoverage', regionId, COMPONENT))
      }
      return Ok(coverage)
    },

    async listCoverage(filters) {
      const result = await repository.findAll(filters)
      return Ok(result)
    },

    async getCriticalZones(period) {
      const result = await repository.findCriticalZones(period)
      return Ok(result)
    },
  }
}
