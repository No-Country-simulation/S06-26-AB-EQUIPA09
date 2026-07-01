import { rootApi } from './root-api'

export type AgentQueryDTO = {
  query: string
  filters?: {
    region?: string
    indicator?: string
    period?: string
  }
}

export type AgentResponseDTO = {
  queryId: string
  query: string
  generatedSql: string | null
  sqlValid: boolean
  result: Record<string, unknown>[] | null
  aiResponse: string
  rowsReturned: number
  latencyMs: number
  groqModel: string
  tokensUsed: number | null
  error: string | null
}

const agentApi = rootApi.injectEndpoints({
  endpoints: (builder) => ({
    agentQuery: builder.mutation<AgentResponseDTO, AgentQueryDTO>({
      query: (body) => ({
        url: '/agent/query',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'AgentQuery', id: 'QUERY' }],
    }),

    getQueryLogs: builder.query<{ data: AgentResponseDTO[]; total: number }, { page?: number; pageSize?: number } | void>({
      query: (params) => ({
        url: '/agent/query/logs',
        params: params || undefined,
      }),
      providesTags: [{ type: 'QueryLog', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
})

export const {
  useAgentQueryMutation,
  useGetQueryLogsQuery,
} = agentApi
