export { rootApi } from './root-api'
export { axiosBaseQuery } from './base-query'
export { TAG_TYPES, API_KEYS } from './api-keys'

export {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetMeQuery,
  useUpdateProfileMutation,
} from './auth.api'

export {
  useListRegionsQuery,
  useGetRegionQuery,
  useGetBaseStationsQuery,
  useListStatesQuery,
  useListMunicipalitiesQuery,
} from './regions.api'

export {
  useListCoverageQuery,
  useGetRegionCoverageQuery,
  useGetRegionCoverageByPeriodQuery,
  useListCriticalCoverageQuery,
} from './coverage.api'

export {
  useListIndicatorsQuery,
  useGetIndicatorQuery,
  useListIndicatorDataQuery,
} from './indicators.api'

export {
  useListProgramsQuery,
  useGetProgramQuery,
} from './programs.api'

export {
  useAgentQueryMutation,
  useGetQueryLogsQuery,
} from './agent.api'
