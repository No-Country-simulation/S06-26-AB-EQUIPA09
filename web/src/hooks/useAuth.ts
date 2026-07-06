import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '../store'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// ─── AXIOS INSTANCE ──────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: API })

// Injector de token em todos os pedidos autenticados
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh quando recebe 401
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { refreshToken } = useAuthStore.getState()
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(`${API}/auth/refresh`, { refreshToken })
        useAuthStore.getState().setAuth(
          { accessToken: data.accessToken, refreshToken: data.refreshToken },
          useAuthStore.getState().user
        )
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ─── AUTH MUTATIONS ───────────────────────────────────────────────────────────
export function useRegister() {
  const { setAuth } = useAuthStore()
  return useMutation({
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const res = await axios.post(`${API}/auth/register`, data)
      return res.data
    },
    onSuccess: data => {
      if (data.accessToken) {
        setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user ?? null)
      }
    },
  })
}

export function useLogin() {
  const { setAuth } = useAuthStore()
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await axios.post(`${API}/auth/login`, data, { withCredentials: true })
      return res.data
    },
    onSuccess: data => {
console.log("LOGIN RESPONSE", data)

  setAuth(
    {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    },
    data.user
  )

  console.log("STORE", useAuthStore.getState())    },
  })
}
export function useLogout() {
  const { clearAuth, accessToken } = useAuthStore()
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout', {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    },
    onSettled: () => clearAuth(),
  })
}
