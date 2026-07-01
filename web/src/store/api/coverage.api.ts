import { rootApi } from './root-api'

export type CoverageResponseDTO = {
  id: string
  regionId: string
  period: string
  networkCoverageScore: number
  maxConcentration: number
  minConcentration: number
  avgDaytimeConcentration: number | null
  avgNighttimeConcentration: number | null
  dominantTechnology: string | null
  no4gOr5gCoverage: boolean
  totalRecords: number
  updatedAt: string
}

const coverageApi = rootApi.injectEndpoints({
  endpoints: (builder) => ({
    listCoverage: builder.query<{ data: CoverageResponseDTO[]; total: number }, { period?: string; no4gOr5gCoverage?: boolean; minScore?: number } | void>({
      query: (filters) => ({
        url: '/coverage',
        params: filters || undefined,
      }),
      providesTags: [{ type: 'Coverage', id: 'LIST' }],
    }),

    getRegionCoverage: builder.query<CoverageResponseDTO, string>({
      query: (regionId) => ({ url: `/coverage/${regionId}` }),
      providesTags: (_result, _error, regionId) => [{ type: 'Coverage', id: regionId }],
    }),

    getRegionCoverageByPeriod: builder.query<CoverageResponseDTO, { regionId: string; period: string }>({
      query: ({ regionId, period }) => ({ url: `/coverage/${regionId}/${period}` }),
      providesTags: (_result, _error, { regionId }) => [{ type: 'Coverage', id: regionId }],
    }),

    listCriticalCoverage: builder.query<{ data: CoverageResponseDTO[]; total: number }, { period?: string } | void>({
      query: (params) => ({
        url: '/coverage/critical',
        params: params || undefined,
      }),
      providesTags: [{ type: 'Coverage', id: 'CRITICAL' }],
    }),
  }),
  overrideExisting: false,
})

export const {
  useListCoverageQuery,
  useGetRegionCoverageQuery,
  useGetRegionCoverageByPeriodQuery,
  useListCriticalCoverageQuery,
} = coverageApi
