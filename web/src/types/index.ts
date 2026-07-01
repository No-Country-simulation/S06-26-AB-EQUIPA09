export type CoberturaNivel = 'boa' | 'atencao' | 'critica'

export interface Indicador {
  slug: string
  nome: string
  categoria: 'formacoes' | 'empregabilidade' | 'experiencias' | 'mentorias' | 'saude_mental'
  valor: number
  unidade: string
}

export interface Regiao {
  id: string
  nome: string
  municipio: string
  estado: string
  lat: number
  lng: number
  concentracao: number
  cobertura_rede: number
  cobertura_nivel: CoberturaNivel
  indicadores: Indicador[]
  programas_count: number
}

export interface DadosResponse {
  resposta_ia: string
  dados: { regiao: string; valor: number; fonte: string }[]
  fontes: string[]
  sql_gerado?: string
}

export interface QueryLogEntry {
  id: string
  consulta: string
  resposta_ia: string
  timestamp: string
  regioes_afetadas: string[]
}
