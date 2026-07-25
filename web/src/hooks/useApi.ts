import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from './useAuth'
import type { Regiao, DadosResponse } from '../types'
import { REGIOES_MOCK, getMockResposta } from '../data/mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Converte a resposta do backend em Regiao[] compatível com o nosso tipo
function mapBackendRegioes(regions: any[], coverages: any[], indicatorsData: any[], indicatorsMeta: any[] = []): Regiao[] {
  // Build a lookup map: indicatorId → { slug, name, category, unit }
  const metaById = new Map<string, { slug: string; name: string; category: string; unit: string }>()
  for (const m of indicatorsMeta) {
    const id = m.id ?? m.indicator_id
    if (id) metaById.set(id, { slug: m.slug ?? '', name: m.name ?? '', category: m.category ?? '', unit: m.unit ?? '%' })
  }
  return regions.map((r: any) => {
    const cov = coverages.find((c: any) => c.regionId === r.id || c.region_id === r.id)
    const score = cov?.networkCoverageScore ?? cov?.network_coverage_score ?? cov?.coverageScore ?? cov?.coverage_score ?? cov?.coverageRating ?? 0
    const scoreNorm = score > 1 ? score / 100 : score
    const concentration =
      Number(
        cov?.maxConcentration ??
        cov?.max_concentration ??
        r.population ??
        r.concentracao ??
        r.populationEstimate ??
        r.estimatedPopulation ??
        0
      )

    const nivel: Regiao['cobertura_nivel'] =
      scoreNorm >= 0.65 ? 'boa' : scoreNorm >= 0.35 ? 'atencao' : 'critica'

    // Agrupa indicator_data desta região
    const indData = indicatorsData.filter(
      (d: any) => d.regionId === r.id || d.region_id === r.id
    )

    const SLUG_MAP: Record<string, string> = {
      'formacao-tech': 'cobertura-formacao-tech',
      'cobertura-formacao': 'cobertura-formacao-tech',
      'emprego-formal': 'taxa-emprego-formal',
      'taxa-emprego': 'taxa-emprego-formal',
      'iniciativas': 'densidade-iniciativas',
      'mentoria': 'cobertura-mentoria',
      'saude-mental': 'indice-saude-mental',
    }

    const CAT_MAP: Record<string, Regiao['indicadores'][0]['categoria']> = {
      'cobertura-formacao-tech': 'formacoes',
      'taxa-emprego-formal': 'empregabilidade',
      'densidade-iniciativas': 'experiencias',
      'cobertura-mentoria': 'mentorias',
      'indice-saude-mental': 'saude_mental',
    }

    const NOME_MAP: Record<string, string> = {
      'cobertura-formacao-tech': 'Formação tech',
      'taxa-emprego-formal': 'Emprego formal',
      'densidade-iniciativas': 'Iniciativas sociais',
      'cobertura-mentoria': 'Mentoria',
      'indice-saude-mental': 'Saúde mental',
    }

    const indicadores = indData.length > 0
      ? indData.map((d: any) => {
          // Try to resolve indicator metadata from the lookup map
          const indicatorId = d.indicatorId ?? d.indicator_id
          const meta = indicatorId ? metaById.get(indicatorId) : undefined

          // Fallback to fields on the data object itself
          const rawSlug = meta?.slug ?? d.indicator?.slug ?? d.slug ?? d.indicatorSlug ?? ''
          const slug = SLUG_MAP[rawSlug] ?? rawSlug
          return {
            slug,
            nome: meta?.name ?? NOME_MAP[slug] ?? d.indicator?.name ?? d.name ?? slug,
            categoria: (CAT_MAP[slug] ?? meta?.category ?? 'formacoes') as Regiao['indicadores'][0]['categoria'],
            valor: Math.round(Number(d.value ?? d.valor ?? 0)),
            unidade: meta?.unit ?? d.unit ?? d.unidade ?? '%',
          }
        })
      : REGIOES_MOCK[0].indicadores.map(i => ({ ...i, valor: 0 }))

    return {
      id: r.id,
      nome: r.name ?? r.nome ?? r.zoneName ?? r.zone_name ?? r.id,
      municipio: r.municipality ?? r.municipio ?? r.municipality_name ?? '',
      estado: r.state ?? r.estado ?? r.province ?? 'Luanda',
      lat: Number(r.lat ?? r.latitude ?? -8.84),
      lng: Number(r.lng ?? r.longitude ?? 13.29),
      concentracao: concentration,
      cobertura_rede: scoreNorm,
      cobertura_nivel: nivel,
      programas_count: Number(r.programsCount ?? r.programs_count ?? 0),
      indicadores,
    }
  })
}

// Converte resposta do agente para o nosso DadosResponse
function mapAgentResponse(data: any): DadosResponse {
  const rows: any[] = data.result ?? data.results ?? data.dados ?? []

  const colunas = rows.length > 0 ? Object.keys(rows[0]) : []

  return {
    resposta_ia: data.aiResponse ?? data.answer ?? data.resposta_ia ?? data.response ?? '',
    colunas,
    dados: rows,
    fontes: data.sources ?? data.fontes ?? ['Vísent CDRView'],
    sql_gerado: data.generatedSql ?? data.sql ?? undefined,
  }
}

// ─── HOOKS ───────────────────────────────────────────────────────────────────

export function useRegioes() {
  return useQuery<Regiao[]>({
    queryKey: ['regioes'],
    queryFn: async () => {
      if (USE_MOCK) return REGIOES_MOCK

      const [regioesRes, coverageRes, indicatorsRes, indicatorsMetaRes] = await Promise.all([
        api.get('/regions', { params: { pageSize: 100 } }),
        api.get('/coverage'),
        api.get('/indicators/data', { params: { pageSize: 500 } }),
        api.get('/indicators'),
      ])

      const regions = regioesRes.data?.data ?? regioesRes.data?.regions ?? regioesRes.data ?? []
      const coverages = coverageRes.data?.data ?? coverageRes.data?.coverages ?? coverageRes.data ?? []
      const indicators = indicatorsRes.data?.data ?? indicatorsRes.data?.indicators ?? indicatorsRes.data ?? []
      const indicatorsMeta = indicatorsMetaRes.data?.data ?? indicatorsMetaRes.data?.indicators ?? indicatorsMetaRes.data ?? []

      return mapBackendRegioes(regions, coverages, indicators, indicatorsMeta)
    },
    staleTime: 30_000,
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
    staleTime: 30_000,
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
    staleTime: 30_000,
  })
}
