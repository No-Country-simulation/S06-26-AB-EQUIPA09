import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Regiao, DadosResponse } from '../types'

// ─── AUTH ────────────────────────────────────────────────────────────────────
interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; name: string; email: string } | null
  setAuth: (tokens: { accessToken?: string; refreshToken: string }, user: AuthState['user']) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}


export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: (tokens, user) => set({
        accessToken: tokens.accessToken ?? null,
        refreshToken: tokens.refreshToken,
        user,
      }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
      isAuthenticated: () => !!get().user,   // 👈 muda o critério
    }),
    { name: 'sqlens-auth' }
  )
)

// ─── APP ─────────────────────────────────────────────────────────────────────
interface AppStore {
  regiaoSelecionada: Regiao | null
  setRegiaoSelecionada: (r: Regiao | null) => void
  indicadorAtivo: string
  setIndicadorAtivo: (slug: string) => void
  filtroCobertura: 'todas' | 'critica' | 'atencao' | 'boa'
  setFiltroCobertura: (f: AppStore['filtroCobertura']) => void
  ultimaResposta: DadosResponse | null
  setUltimaResposta: (r: DadosResponse | null) => void
  consultaAtual: string
  setConsultaAtual: (c: string) => void
}

export const useAppStore = create<AppStore>(set => ({
  regiaoSelecionada: null,
  setRegiaoSelecionada: r => set({ regiaoSelecionada: r }),
  indicadorAtivo: 'cobertura-formacao-tech',
  setIndicadorAtivo: slug => set({ indicadorAtivo: slug }),
  filtroCobertura: 'todas',
  setFiltroCobertura: f => set({ filtroCobertura: f }),
  ultimaResposta: null,
  setUltimaResposta: r => set({ ultimaResposta: r }),
  consultaAtual: '',
  setConsultaAtual: c => set({ consultaAtual: c }),
}))
