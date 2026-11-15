import { describe, it, expect } from 'vitest'
import { coveragePeriod } from '../application/services/cvss-ingestion.service'
import { createRegionCoverageRepository } from '@/modules/coverage/infrastructure/persistence/region-coverage.repository'

describe('coveragePeriod', () => {
  it('deriva YYYY-MM de day_date', () => {
    expect(coveragePeriod('2026-03-02')).toBe('2026-03')
    expect(coveragePeriod('2025-12-31')).toBe('2025-12')
  })

  // regressão: uma ingestão antiga gravou region_coverage.period = "undefined"
  it.each([undefined, '', 'undefined', 'abc', '26-03-02', '2026/03/02'])(
    'recusa day_date inválido: %j',
    (value) => {
      expect(() => coveragePeriod(value)).toThrow(/day_date inválido/)
    }
  )
})

describe('RegionCoverageRepository.upsert', () => {
  it.each(['undefined', '', '2026-3', '2026-03-02'])(
    'recusa período inválido: %j',
    async (period) => {
      // o período é validado antes de qualquer acesso ao banco, por isso o db pode ser um stub vazio
      const repo = createRegionCoverageRepository({} as never)
      await expect(
        repo.upsert({
          regionId: 'r1',
          period,
          networkCoverageScore: 0.5,
          maxConcentration: 1,
          minConcentration: 0,
          avgDaytimeConcentration: null,
          avgNighttimeConcentration: null,
          dominantTechnology: '4G',
          no4gOr5gCoverage: false,
          totalRecords: 1,
        })
      ).rejects.toBeDefined()
    }
  )
})
