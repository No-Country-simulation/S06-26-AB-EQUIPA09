import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// In-memory staff refresh token (not persisted for security)
let staffRefreshToken: string | null = null

export const setStaffRefreshToken = (token: string | null) => { staffRefreshToken = token }

export const staffApi = axios.create({
  baseURL: API,
  withCredentials: true,
})

// Auto-refresh interceptor for staff auth
staffApi.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry && staffRefreshToken) {
      original._retry = true
      try {
        const { data } = await axios.post(`${API}/staff/refresh`, { refreshToken: staffRefreshToken }, { withCredentials: true })
        const result = data?.value ?? data
        if (result?.refreshToken) {
          staffRefreshToken = result.refreshToken
        }
        return staffApi(original)
      } catch {
        staffRefreshToken = null
        window.location.href = '/staff/login'
      }
    }
    return Promise.reject(err)
  }
)

type ListResponse<T> = {
  data?: T[]
  pagination?: unknown
  total?: number
  totalItems?: number
}

type StaffResult<T> = {
  success?: boolean
  value?: T
  message?: string
}

export type StaffUser = {
  id: string
  email: string
  name: string
  isActive: boolean
  lastLoginAt?: string | null
  createdAt?: string
}

export type DataSource = {
  id: string
  slug: string
  name: string
  description: string | null
  type: string
  country?: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export type CvssIngestionResult = {
  recordsInserted: number
  regionsUpserted: number
  stationsUpserted: number
  coverageRowsUpserted: number
  registeredSources: number
  filesProcessed: string[]
}

export type Indicator = {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  unit: string
  direction?: string
  isActive?: boolean
}

export type Program = {
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
  createdAt: string
  updatedAt: string
}

export type Region = {
  id: string
  name: string
  municipality?: string
  state?: string
}

export type ActivityLog = {
  id: string
  actorId: string | null
  actorStaffId: string | null
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  createdAt: string
}

const unwrap = <T>(payload: StaffResult<T> | T): T => {
  if (payload && typeof payload === 'object' && 'value' in payload) {
    return (payload as StaffResult<T>).value as T
  }
  return payload as T
}

const unwrapList = <T>(payload: StaffResult<ListResponse<T> | T[]> | ListResponse<T> | T[]): T[] => {
  const data = unwrap(payload)
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && Array.isArray((data as ListResponse<T>).data)) {
    return (data as ListResponse<T>).data ?? []
  }
  return []
}

const invalidateStaff = (queryClient: ReturnType<typeof useQueryClient>, keys: string[]) => {
  keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
}

export function useStaffLogin() {
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await staffApi.post('/staff/login', credentials)
      const result = unwrap<{ staff: StaffUser; refreshToken: string }>(data)
      if (result?.refreshToken) {
        staffRefreshToken = result.refreshToken
      }
      return result
    },
  })
}

export function useStaffLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await staffApi.post('/staff/logout')
      return unwrap(data)
    },
    onSettled: () => {
      staffRefreshToken = null
      queryClient.removeQueries({ queryKey: ['staffMe'] })
    },
  })
}

export function useStaffMe() {
  return useQuery({
    queryKey: ['staffMe'],
    queryFn: async () => {
      const { data } = await staffApi.get('/staff/me')
      return unwrap<StaffUser>(data)
    },
    retry: false,
  })
}

export function useStaffDataSources() {
  return useQuery({
    queryKey: ['staffDataSources'],
    queryFn: async () => {
      const { data } = await staffApi.get('/staff/data-sources', { params: { pageSize: 100 } })
      return unwrapList<DataSource>(data)
    },
  })
}

export function useCreateDataSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { slug: string; name: string; type: string; description?: string | null }) => {
      const { data } = await staffApi.post('/staff/data-sources', payload)
      return unwrap<DataSource>(data)
    },
    onSuccess: () => invalidateStaff(queryClient, ['staffDataSources']),
  })
}

export function useUploadCSV(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const { data } = await staffApi.post(`/staff/data-sources/${id}/trigger-stream`, file, {
        headers: { 'Content-Type': 'text/csv' },
      })
      return unwrap(data)
    },
    onSuccess: () => {
      invalidateStaff(queryClient, ['staffDataSources'])
      queryClient.invalidateQueries({ queryKey: ['regioes'] })
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      queryClient.invalidateQueries({ queryKey: ['indicadores'] })
    },
  })
}

export function useUploadCvssCSVs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      const { data } = await staffApi.post('/staff/cvss/upload', formData)
      return unwrap<CvssIngestionResult>(data)
    },
    onSuccess: () => {
      invalidateStaff(queryClient, ['staffDataSources'])
      // Invalidate public-facing data so dashboard/map refresh
      queryClient.invalidateQueries({ queryKey: ['regioes'] })
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      queryClient.invalidateQueries({ queryKey: ['indicadores'] })
    },
  })
}

export function useStaffIndicadores() {
  return useQuery({
    queryKey: ['staffIndicadores'],
    queryFn: async () => {
      const { data } = await staffApi.get('/staff/indicators', { params: { perPage: 100 } })
      return unwrapList<Indicator>(data)
    },
  })
}

export function useCreateIndicador() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      slug: string
      name: string
      unit: string
      description?: string
      category: string
    }) => {
      const { data } = await staffApi.post('/staff/indicators', payload)
      return unwrap<Indicator>(data)
    },
    onSuccess: () => {
      invalidateStaff(queryClient, ['staffIndicadores'])
      queryClient.invalidateQueries({ queryKey: ['indicadores'] })
    },
  })
}

export function useAddIndicadorData() {
  return useMutation({
    mutationFn: async (payload: { indicatorId: string; regionId: string; value: number; period: string }) => {
      const { indicatorId, ...body } = payload
      const { data } = await staffApi.post(`/staff/indicators/${indicatorId}/data`, {
        ...body,
        indicatorId,
      })
      return unwrap(data)
    },
  })
}

export function useStaffProgramas() {
  return useQuery({
    queryKey: ['staffProgramas'],
    queryFn: async () => {
      const { data } = await staffApi.get('/staff/programs', { params: { pageSize: 100 } })
      return unwrapList<Program>(data)
    },
  })
}

export function useCreatePrograma() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await staffApi.post('/staff/programs', payload)
      return unwrap<Program>(data)
    },
    onSuccess: () => {
      invalidateStaff(queryClient, ['staffProgramas'])
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}

export function useUpdatePrograma() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Record<string, unknown> & { id: string }) => {
      const { data } = await staffApi.patch(`/staff/programs/${id}`, payload)
      return unwrap<Program>(data)
    },
    onSuccess: () => {
      invalidateStaff(queryClient, ['staffProgramas'])
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}

export function useDeletePrograma() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await staffApi.delete(`/staff/programs/${id}`)
      return unwrap(data)
    },
    onSuccess: () => {
      invalidateStaff(queryClient, ['staffProgramas'])
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}

export function useActivityLog() {
  return useQuery({
    queryKey: ['activityLog'],
    queryFn: async () => {
      const { data } = await staffApi.get('/staff/activity-log', { params: { perPage: 20 } })
      return unwrapList<ActivityLog>(data)
    },
  })
}

export function useStaffMembers() {
  return useQuery({
    queryKey: ['staffMembers'],
    queryFn: async () => {
      const { data } = await staffApi.get('/staff/members', { params: { perPage: 100 } })
      return unwrapList<StaffUser>(data)
    },
  })
}

export function useStaffRegions() {
  return useQuery({
    queryKey: ['staffRegions'],
    queryFn: async () => {
      const { data } = await staffApi.get('/regions', { params: { pageSize: 100 } })
      const value = unwrap<{ data?: Region[] } | Region[]>(data)
      return Array.isArray(value) ? value : value.data ?? []
    },
    retry: false,
  })
}
