import { rootApi } from './root-api'

export type IndicatorResponseDTO = {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  unit: string
  direction: string
  criticalThresholds: Record<string, unknown> | null
  sourceId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type IndicatorDataResponseDTO = {
  id: string
  regionId: string
  indicatorId: string
  sourceId: string | null
  period: string
  value: number
  normalizedValue: number | null
  quality: string
  notes: string | null
  updatedAt: string
}

const indicatorsApi = rootApi.injectEndpoints({
  endpoints: (builder) => ({
    listIndicators: builder.query<{ data: IndicatorResponseDTO[]; total: number }, void>({
      query: () => ({ url: '/indicators' }),
      providesTags: [{ type: 'Indicators', id: 'LIST' }],
    }),

    getIndicator: builder.query<IndicatorResponseDTO, string>({
      query: (id) => ({ url: `/indicators/${id}` }),
      providesTags: (_result, _error, id) => [{ type: 'Indicator', id }],
    }),

    listIndicatorData: builder.query<{ data: IndicatorDataResponseDTO[]; total: number }, { regionId?: string; indicatorId?: string; period?: string; quality?: string } | void>({
      query: (filters) => ({
        url: '/indicators/data',
        params: filters || undefined,
      }),
      providesTags: [{ type: 'IndicatorData', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
})

export const {
  useListIndicatorsQuery,
  useGetIndicatorQuery,
  useListIndicatorDataQuery,
} = indicatorsApi
