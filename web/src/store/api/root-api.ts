import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from './base-query'

export const rootApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    'Auth', 'Me',
    'User', 'Users',
    'Region', 'Regions', 'RegionDetail', 'BaseStation',
    'Coverage', 'CoverageDetail',
    'Indicator', 'Indicators', 'IndicatorData',
    'Program', 'Programs',
    'AgentQuery', 'QueryLog',
  ],
  endpoints: () => ({}),
})
