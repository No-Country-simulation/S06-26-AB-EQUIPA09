/**
 * Derivação de indicadores a partir de dados públicos (IBGE e DATASUS/CNES).
 * Funções puras — sem rede nem banco — para serem testáveis. A E/S está em scripts/load-public-data.ts.
 *
 * Limitação deliberada: as fontes públicas têm granularidade MUNICIPAL, enquanto as regiões do
 * SQLens são clusters de antenas (bairros). O valor do município é atribuído a cada região dele
 * e isso fica registado em `notes`.
 */

export interface MunicipalityRef {
  /** Nome como está em regions.municipality (sem acentos). */
  name: string
  label: string
  /** Código IBGE de 7 dígitos (SIDRA). */
  ibge: string
  /** Código IBGE de 6 dígitos (CNES/DATASUS). */
  cnes: string
}

export const MUNICIPALITIES: readonly MunicipalityRef[] = [
  { name: 'Florianopolis', label: 'Florianópolis', ibge: '4205407', cnes: '420540' },
  { name: 'Sao Jose',      label: 'São José',      ibge: '4216602', cnes: '421660' },
  { name: 'Palhoca',       label: 'Palhoça',       ibge: '4211900', cnes: '421190' },
  { name: 'Biguacu',       label: 'Biguaçu',       ibge: '4202305', cnes: '420230' },
]

/** Parâmetro do Ministério da Saúde: cobertura de CAPS ≥ 0,70 por 100 mil hab. = faixa "muito boa". */
export const CAPS_REFERENCE_PER_100K = 0.7

const round1 = (n: number) => Math.round(n * 10) / 10

/** Taxa de emprego formal (%) = pessoal ocupado assalariado (CEMPRE) / população (Censo). */
export const employmentRate = (salariedWorkers: number, population: number): number => {
  if (!Number.isFinite(salariedWorkers) || !Number.isFinite(population) || population <= 0) {
    throw new Error('employmentRate: valores inválidos')
  }
  // pessoal ocupado é contado no município onde trabalha, por isso pode passar de 100% em polos de emprego
  return round1(Math.min(100, (salariedWorkers / population) * 100))
}

/** Cobertura de CAPS: unidades por 100 mil hab. e pontuação 0–100 face à meta de 0,70. */
export const capsCoverage = (capsCount: number, population: number): { per100k: number; score: number } => {
  if (!Number.isFinite(capsCount) || capsCount < 0 || !Number.isFinite(population) || population <= 0) {
    throw new Error('capsCoverage: valores inválidos')
  }
  const per100k = (capsCount / population) * 100_000
  return {
    per100k: Math.round(per100k * 100) / 100,
    score: round1(Math.min(100, (per100k / CAPS_REFERENCE_PER_100K) * 100)),
  }
}

const toRad = (d: number) => (d * Math.PI) / 180

/** Distância em km entre dois pontos (haversine). */
export const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Região mais próxima de um ponto, apenas entre as do mesmo município. */
export const nearestRegion = <R extends { id: string; municipality: string; lat: number; lng: number }>(
  point: { lat: number; lng: number },
  municipality: string,
  regions: readonly R[],
): R | null => {
  let best: R | null = null
  let bestDist = Infinity
  for (const r of regions) {
    if (r.municipality !== municipality) continue
    const d = distanceKm(point, r)
    if (d < bestDist) { best = r; bestDist = d }
  }
  return best
}

export interface CnesEstablishment {
  codigo_cnes: number
  nome_fantasia?: string | null
  nome_razao_social?: string | null
  descricao_esfera_administrativa?: string | null
  tipo_gestao?: string | null
  bairro_estabelecimento?: string | null
  endereco_estabelecimento?: string | null
  numero_estabelecimento?: string | null
  latitude_estabelecimento_decimo_grau?: number | null
  longitude_estabelecimento_decimo_grau?: number | null
  codigo_tipo_unidade?: number | null
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, m => m.toLowerCase())

/** Converte um CAPS do CNES numa linha da tabela `programs` (sem regionId). */
export const capsToProgram = (e: CnesEstablishment, municipality: MunicipalityRef) => {
  const rawName = (e.nome_fantasia || e.nome_razao_social || `CNES ${e.codigo_cnes}`).trim()
  const name = rawName.length > 200 ? rawName.slice(0, 200) : rawName
  const sphere = e.descricao_esfera_administrativa ? titleCase(e.descricao_esfera_administrativa) : null
  return {
    name,
    description: `Centro de Atenção Psicossocial (CAPS) registado no CNES/DATASUS${e.bairro_estabelecimento ? `, bairro ${titleCase(e.bairro_estabelecimento)}` : ''}.`,
    category: 'mental_health' as const,
    organization: [e.nome_razao_social ? titleCase(e.nome_razao_social) : null, sphere ? `(${sphere})` : null].filter(Boolean).join(' ') || null,
    municipality: municipality.name,
    state: 'SC',
    url: `https://cnes.datasus.gov.br/pages/estabelecimentos/ficha/identificacao/${municipality.cnes}${String(e.codigo_cnes).padStart(7, '0')}`,
    metadata: {
      source: 'DATASUS/CNES',
      cnes: e.codigo_cnes,
      tipoUnidade: e.codigo_tipo_unidade ?? 70,
      lat: e.latitude_estabelecimento_decimo_grau ?? null,
      lng: e.longitude_estabelecimento_decimo_grau ?? null,
    },
  }
}

/** Valores SIDRA vêm como string; "-", "..." e "X" significam sem dado. */
export const parseSidraValue = (v: string | undefined): number | null => {
  if (v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
