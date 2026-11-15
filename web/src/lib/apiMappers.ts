import type { Regiao, DadosResponse } from '../types'
import { REGIOES_MOCK } from '../data/mock'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Converte a resposta do backend em Regiao[] compatível com o nosso tipo
export function mapBackendRegioes(
  regions: any[],
  coverages: any[],
  indicatorsData: any[],
  slugById: Record<string, string> = {},
): Regiao[] {
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
          const rawSlug = d.indicator?.slug ?? d.slug ?? d.indicatorSlug ?? slugById[d.indicatorId ?? d.indicator_id] ?? ''
          const slug = SLUG_MAP[rawSlug] ?? rawSlug
          return {
            slug,
            nome: NOME_MAP[slug] ?? d.indicator?.name ?? d.name ?? slug,
            categoria: CAT_MAP[slug] ?? 'formacoes' as const,
            valor: Math.round(Number(d.value ?? d.valor ?? 0)),
            unidade: d.unit ?? d.unidade ?? '%',
          }
        })
      : REGIOES_MOCK[0].indicadores.map(i => ({ ...i, valor: 0 }))

    return {
      id: r.id,
      nome: r.name ?? r.nome ?? r.zoneName ?? r.zone_name ?? r.id,
      municipio: r.municipality ?? r.municipio ?? r.municipality_name ?? '',
      estado: r.state ?? r.estado ?? r.province ?? 'SC',
      lat: Number(r.lat ?? r.latitude ?? -27.6),
      lng: Number(r.lng ?? r.longitude ?? -48.55),
      concentracao: concentration,
      cobertura_rede: scoreNorm,
      cobertura_nivel: nivel,
      programas_count: Number(r.programsCount ?? r.programs_count ?? 0),
      indicadores,
    }
  })
}

// Escolhe a coluna numérica de uma linha devolvida pelo agente. Scores de cobertura vêm em 0–1
// (ex.: network_coverage_score = 0.25) e são convertidos para % (25); contagens ficam como estão.
const VALOR_KEYS = [
  'value', 'valor', 'coverage', 'network_coverage_score', 'networkCoverageScore',
  'people_count', 'peopleCount', 'max_concentration', 'total', 'count',
] as const

export function pickValor(r: any): { valor: number; unidade: '%' | '' } {
  const key = VALOR_KEYS.find(k => r[k] !== undefined && r[k] !== null && !Number.isNaN(Number(r[k])))
  const fallbackKey = key ?? Object.keys(r).find(k => typeof r[k] !== 'boolean' && r[k] !== null && r[k] !== '' && !Number.isNaN(Number(r[k])) && !/(^|_)id$/i.test(k))
  if (!fallbackKey) return { valor: 0, unidade: '' }
  const n = Number(r[fallbackKey])
  const isRatio = /score|coverage|cobertura|ratio|pct|percent/i.test(fallbackKey)
  if (isRatio && n >= 0 && n <= 1) return { valor: n * 100, unidade: '%' }
  return { valor: n, unidade: isRatio ? '%' : '' }
}

// Converte resposta do agente para o nosso DadosResponse
export function mapAgentResponse(data: any): DadosResponse {
  const rows: any[] = data.result ?? data.results ?? data.dados ?? []
  return {
    resposta_ia: data.aiResponse ?? data.answer ?? data.resposta_ia ?? data.response ?? '',
    dados: rows.map((r: any) => {
      const { valor, unidade } = pickValor(r)
      return {
        regiao: r.region ?? r.regiao ?? r.name ?? r.nome ?? r.municipality ?? r.zone_id ?? String(r.id ?? ''),
        valor,
        unidade,
        fonte: r.source ?? r.fonte ?? 'Vísent CDRView',
      }
    }),
    fontes: data.sources ?? data.fontes ?? ['Vísent CDRView'],
    sql_gerado: data.generatedSql ?? data.sql ?? undefined,
  }
}

