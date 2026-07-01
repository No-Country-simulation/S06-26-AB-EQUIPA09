import { rootApi } from './root-api'

export type ProgramResponseDTO = {
  id: string
  regionId: string | null
  name: string
  description: string | null
  category: string
  organization: string | null
  municipality: string | null
  state: string | null
  url: string | null
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

const programsApi = rootApi.injectEndpoints({
  endpoints: (builder) => ({
    listPrograms: builder.query<{ data: ProgramResponseDTO[]; total: number }, { regionId?: string; category?: string; state?: string; municipality?: string; isActive?: boolean; page?: number; pageSize?: number } | void>({
      query: (filters) => ({
        url: '/programs',
        params: filters || undefined,
      }),
      providesTags: [{ type: 'Programs', id: 'LIST' }],
    }),

    getProgram: builder.query<ProgramResponseDTO, string>({
      query: (id) => ({ url: `/programs/${id}` }),
      providesTags: (_result, _error, id) => [{ type: 'Program', id }],
    }),
  }),
  overrideExisting: false,
})

export const {
  useListProgramsQuery,
  useGetProgramQuery,
} = programsApi
