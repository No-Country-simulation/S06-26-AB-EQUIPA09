import { create } from 'zustand'
import type { Regiao, DadosResponse } from '../types'

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
