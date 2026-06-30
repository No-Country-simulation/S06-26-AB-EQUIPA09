import { useQuery, useMutation } from '@tanstack/react-query'
import axios from 'axios'
import type { Regiao, DadosResponse } from '../types'
import { REGIOES_MOCK, getMockResposta } from '../data/mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_URL
const API = import.meta.env.VITE_API_URL ?? ''

export function useRegioes() {
  return useQuery<Regiao[]>({
    queryKey: ['regioes'],
    queryFn: async () => {
      if (USE_MOCK) return REGIOES_MOCK
      const { data } = await axios.get(`${API}/mapa`)
      return data.regioes
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useConsultaAgente() {
  return useMutation<DadosResponse, Error, string>({
    mutationFn: async (consulta: string) => {
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 1400))
        return getMockResposta(consulta)
      }
      const { data } = await axios.post(`${API}/dados`, {
        consulta,
        filtros: { regiao: null, indicador: null },
        idioma: 'pt',
      })
      return data
    },
  })
}
