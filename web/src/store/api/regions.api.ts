import { rootApi } from './root-api'

export type RegionResponseDTO = {
  id: string
  zoneId: string
  name: string
  municipality: string
  state: string
  country: string
  lat: number
  lng: number
  estimatedPopulation: number | null
  areaKm2: number | null
  createdAt: string
}

export type BaseStationResponseDTO = {
  id: string
  stationId: string
  regionId: string
  technology: '2G' | '3G' | '4G' | '5G'
  carrier: string | null
  lat: number
  lng: number
  powerDbm: number | null
  isActive: boolean
}

const regionsApi = rootApi.injectEndpoints({
  endpoints: (builder) => ({
    listRegions: builder.query<{ data: RegionResponseDTO[]; total: number }, { state?: string; municipality?: string; page?: number; pageSize?: number } | void>({
      query: (filters) => ({
        url: '/regions',
        params: filters || undefined,
      }),
      providesTags: [{ type: 'Regions', id: 'LIST' }],
    }),

    getRegion: builder.query<RegionResponseDTO, string>({
      query: (id) => ({ url: `/regions/${id}` }),
      providesTags: (_result, _error, id) => [{ type: 'Region', id }],
    }),

    getBaseStations: builder.query<{ data: BaseStationResponseDTO[]; total: number }, { id: string; technology?: string; isActive?: boolean }>({
      query: ({ id, ...params }) => ({
        url: `/regions/${id}/stations`,
        params,
      }),
      providesTags: (_result, _error, { id }) => [{ type: 'BaseStation', id }],
    }),

    listStates: builder.query<string[], { country?: string } | void>({
      query: (params) => ({
        url: '/regions/meta/states',
        params: params || undefined,
      }),
      providesTags: ['Regions'],
    }),

    listMunicipalities: builder.query<string[], { state: string }>({
      query: (params) => ({
        url: '/regions/meta/municipalities',
        params,
      }),
      providesTags: ['Regions'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useListRegionsQuery,
  useGetRegionQuery,
  useGetBaseStationsQuery,
  useListStatesQuery,
  useListMunicipalitiesQuery,
} = regionsApi
