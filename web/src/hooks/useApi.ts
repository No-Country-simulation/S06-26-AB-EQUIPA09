import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from './useAuth'
import type { Regiao, DadosResponse } from '../types'
import { REGIOES_MOCK, getMockResposta } from '../data/mock'
import { mapBackendRegioes, mapAgentResponse } from '../lib/apiMappers'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// ─── HOOKS ───────────────────────────────────────────────────────────────────

export function useRegioes() {
  return useQuery<Regiao[]>({
    queryKey: ['regioes'],
    queryFn: async () => {
      if (USE_MOCK) return REGIOES_MOCK

      const [regioesRes, coverageRes, indicatorsRes, catalogRes] = await Promise.all([
        api.get('/regions', { params: { pageSize: 100 } }),
        api.get('/coverage'),
        api.get('/indicators/data'),
        api.get('/indicators'),
      ])

      const regions = regioesRes.data?.data ?? regioesRes.data?.regions ?? regioesRes.data ?? []
      const coverages = coverageRes.data?.data ?? coverageRes.data?.coverages ?? coverageRes.data ?? []
      const indicators = indicatorsRes.data?.data ?? indicatorsRes.data?.indicators ?? indicatorsRes.data ?? []

      // /indicators/data traz só indicatorId; o slug vem do catálogo (/indicators)
      const catalog = catalogRes.data?.data ?? catalogRes.data?.indicators ?? catalogRes.data ?? []
      const slugById: Record<string, string> = Object.fromEntries(
        (Array.isArray(catalog) ? catalog : []).map((i: any) => [i.id, i.slug]),
      )

      return mapBackendRegioes(regions, coverages, indicators, slugById)
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}

export function useConsultaAgente() {
  return useMutation<DadosResponse, Error, string>({
    mutationFn: async (consulta: string) => {
      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 1600))
        return getMockResposta(consulta)
      }

      const { data } = await api.post('/agent/query', {
        query: consulta,           // campo correcto conforme a API
        filters: {},
      })

      return mapAgentResponse(data)
    },
  })
}

export function usePrograms(regionId?: string) {
  return useQuery({
    queryKey: ['programs', regionId],
    queryFn: async () => {
      if (USE_MOCK) return []
      const params = regionId ? { regionId, pageSize: 50 } : { pageSize: 50 }
      const { data } = await api.get('/programs', { params })
      return data?.data ?? data?.programs ?? data ?? []
    },
    enabled: !USE_MOCK,
    staleTime: 5 * 60 * 1000,
  })
}

export function useIndicadores() {
  return useQuery({
    queryKey: ['indicadores'],
    queryFn: async () => {
      if (USE_MOCK) return []
      const { data } = await api.get('/indicators')
      return data?.data ?? data?.indicators ?? data ?? []
    },
    enabled: !USE_MOCK,
    staleTime: 10 * 60 * 1000,
  })
}
