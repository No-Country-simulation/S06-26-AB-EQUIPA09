import type { Regiao, DadosResponse } from '../types'

export const REGIOES_MOCK: Regiao[] = [
  {
    id: 'r1',
    nome: 'Centro Histórico',
    municipio: 'Florianopolis',
    estado: 'SC',
    lat: -27.5954,
    lng: -48.5480,
    concentracao: 5900,
    cobertura_rede: 0.28,
    cobertura_nivel: 'critica',
    programas_count: 2,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Cobertura formação tech', categoria: 'formacoes', valor: 9, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 18, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 2, unidade: '/10k hab' },
      { slug: 'cobertura-mentoria', nome: 'Cobertura mentoria', categoria: 'mentorias', valor: 5, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Índice saúde mental', categoria: 'saude_mental', valor: 29, unidade: 'pts' },
    ],
  },
  {
    id: 'r2',
    nome: 'Palhoça Centro',
    municipio: 'Palhoca',
    estado: 'SC',
    lat: -27.6446,
    lng: -48.6678,
    concentracao: 4400,
    cobertura_rede: 0.41,
    cobertura_nivel: 'atencao',
    programas_count: 4,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Cobertura formação tech', categoria: 'formacoes', valor: 22, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 31, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 5, unidade: '/10k hab' },
      { slug: 'cobertura-mentoria', nome: 'Cobertura mentoria', categoria: 'mentorias', valor: 14, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Índice saúde mental', categoria: 'saude_mental', valor: 41, unidade: 'pts' },
    ],
  },
  {
    id: 'r3',
    nome: 'Jurerê',
    municipio: 'Florianopolis',
    estado: 'SC',
    lat: -27.4396,
    lng: -48.5025,
    concentracao: 2100,
    cobertura_rede: 0.91,
    cobertura_nivel: 'boa',
    programas_count: 17,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Cobertura formação tech', categoria: 'formacoes', valor: 74, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 78, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 21, unidade: '/10k hab' },
      { slug: 'cobertura-mentoria', nome: 'Cobertura mentoria', categoria: 'mentorias', valor: 61, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Índice saúde mental', categoria: 'saude_mental', valor: 72, unidade: 'pts' },
    ],
  },
  {
    id: 'r4',
    nome: 'Coqueiros',
    municipio: 'Florianopolis',
    estado: 'SC',
    lat: -27.5978,
    lng: -48.5871,
    concentracao: 4800,
    cobertura_rede: 0.19,
    cobertura_nivel: 'critica',
    programas_count: 1,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Cobertura formação tech', categoria: 'formacoes', valor: 5, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 14, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 1, unidade: '/10k hab' },
      { slug: 'cobertura-mentoria', nome: 'Cobertura mentoria', categoria: 'mentorias', valor: 3, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Índice saúde mental', categoria: 'saude_mental', valor: 22, unidade: 'pts' },
    ],
  },
  {
    id: 'r5',
    nome: 'Campeche',
    municipio: 'Florianopolis',
    estado: 'SC',
    lat: -27.6747,
    lng: -48.4756,
    concentracao: 2300,
    cobertura_rede: 0.76,
    cobertura_nivel: 'boa',
    programas_count: 11,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Cobertura formação tech', categoria: 'formacoes', valor: 58, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 61, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 16, unidade: '/10k hab' },
      { slug: 'cobertura-mentoria', nome: 'Cobertura mentoria', categoria: 'mentorias', valor: 44, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Índice saúde mental', categoria: 'saude_mental', valor: 63, unidade: 'pts' },
    ],
  },
  {
    id: 'r6',
    nome: 'São José Centro',
    municipio: 'Sao Jose',
    estado: 'SC',
    lat: -27.6136,
    lng: -48.6366,
    concentracao: 4200,
    cobertura_rede: 0.52,
    cobertura_nivel: 'atencao',
    programas_count: 6,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Cobertura formação tech', categoria: 'formacoes', valor: 34, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 42, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 9, unidade: '/10k hab' },
      { slug: 'cobertura-mentoria', nome: 'Cobertura mentoria', categoria: 'mentorias', valor: 27, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Índice saúde mental', categoria: 'saude_mental', valor: 48, unidade: 'pts' },
    ],
  },
]

export const RESPOSTAS_MOCK: Record<string, DadosResponse> = {
  default: {
    resposta_ia: 'Com base nos dados disponíveis, identifico padrões críticos de desigualdade digital na região metropolitana de Florianópolis. Coqueiros e o Centro Histórico concentram muitas pessoas por antena mas registam cobertura de rede abaixo de 30%, o que limita o alcance de qualquer programa digital.',
    dados: REGIOES_MOCK.map(r => ({ regiao: r.nome, valor: Math.round(r.cobertura_rede * 100), fonte: 'Vísent CDRView' })),
    fontes: ['Vísent CDRView', 'IBGE'],
  },
  formacao: {
    resposta_ia: 'Coqueiros (5%) e o Centro Histórico (9%) têm cobertura de formação tech criticamente baixa, apesar da alta concentração de pessoas. A falta de conectividade agrava o problema: sem rede, formações online não chegam a estas zonas.',
    dados: REGIOES_MOCK.map(r => ({ regiao: r.nome, valor: r.indicadores.find(i => i.slug === 'cobertura-formacao-tech')?.valor ?? 0, fonte: 'IBGE' })),
    fontes: ['IBGE', 'Vísent CDRView'],
  },
  emprego: {
    resposta_ia: 'Coqueiros (14%) e o Centro Histórico (18%) têm as menores taxas de emprego formal da amostra, apesar de estarem entre as zonas com maior concentração de pessoas. A baixa conectividade dificulta o acesso a plataformas de emprego online.',
    dados: REGIOES_MOCK.map(r => ({ regiao: r.nome, valor: r.indicadores.find(i => i.slug === 'taxa-emprego-formal')?.valor ?? 0, fonte: 'IBGE' })),
    fontes: ['IBGE', 'Vísent CDRView'],
  },
  saude: {
    resposta_ia: 'Coqueiros regista o índice mais crítico de saúde mental (22 pts) e a menor cobertura de rede da amostra (19%). Sem conectividade, serviços de apoio psicológico remoto e linhas de crise não chegam. Qualquer programa de saúde mental deve ser precedido de investimento em rede.',
    dados: REGIOES_MOCK.map(r => ({ regiao: r.nome, valor: r.indicadores.find(i => i.slug === 'indice-saude-mental')?.valor ?? 0, fonte: 'DATASUS / IBGE' })),
    fontes: ['DATASUS', 'IBGE', 'Vísent CDRView'],
  },
}

export function getMockResposta(consulta: string): DadosResponse {
  const q = consulta.toLowerCase()
  if (q.includes('forma') || q.includes('curso') || q.includes('tech') || q.includes('qualifica')) return RESPOSTAS_MOCK.formacao
  if (q.includes('emprego') || q.includes('trabalho') || q.includes('mercado') || q.includes('formal')) return RESPOSTAS_MOCK.emprego
  if (q.includes('saúde') || q.includes('mental') || q.includes('saude') || q.includes('psicol')) return RESPOSTAS_MOCK.saude
  return RESPOSTAS_MOCK.default
}