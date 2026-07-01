import { rootApi } from './root-api'

export type UserResponseDTO = {
  id: string
  email: string
  name: string
  phone: string | null
  avatar: string | null
  locale: string
  timezone: string | null
  createdAt: string
  updatedAt: string
}

export type LoginDTO = {
  email: string
  password: string
}

export type RegisterDTO = {
  email: string
  password: string
  name: string
}

export type AuthResponseDTO = {
  user: UserResponseDTO
  refreshToken: string
}

export type UpdateProfileDTO = {
  name?: string
  phone?: string
  locale?: string
  timezone?: string
  avatar?: string
}

const authApi = rootApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponseDTO, LoginDTO>({
      query: (data) => ({ url: '/auth/login', method: 'POST', data }),
      invalidatesTags: [{ type: 'Auth', id: 'Me' }],
    }),

    register: builder.mutation<AuthResponseDTO, RegisterDTO>({
      query: (data) => ({ url: '/auth/register', method: 'POST', data }),
      invalidatesTags: [{ type: 'Auth', id: 'Me' }],
    }),

    logout: builder.mutation<{ message: string }, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: [{ type: 'Auth', id: 'Me' }],
    }),

    refreshToken: builder.mutation<{ refreshToken: string }, { refreshToken: string }>({
      query: (data) => ({ url: '/auth/refresh', method: 'POST', data }),
    }),

    getMe: builder.query<UserResponseDTO, void>({
      query: () => ({ url: '/users/me' }),
      providesTags: [{ type: 'Auth', id: 'Me' }],
    }),

    updateProfile: builder.mutation<UserResponseDTO, UpdateProfileDTO>({
      query: (data) => ({ url: '/users/me', method: 'PATCH', data }),
      invalidatesTags: [{ type: 'Auth', id: 'Me' }],
    }),
  }),
  overrideExisting: false,
})

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetMeQuery,
  useUpdateProfileMutation,
} = authApi
