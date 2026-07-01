import type { Regiao, DadosResponse } from '../types'

export const REGIOES_MOCK: Regiao[] = [
  {
    id: 'r1', nome: 'Cazenga', municipio: 'Cazenga', estado: 'Luanda',
    lat: -8.8237, lng: 13.3014, concentracao: 942000,
    cobertura_rede: 0.28, cobertura_nivel: 'critica', programas_count: 2,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Formação tech', categoria: 'formacoes', valor: 9, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 18, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 2, unidade: '/10k' },
      { slug: 'cobertura-mentoria', nome: 'Mentoria', categoria: 'mentorias', valor: 5, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Saúde mental', categoria: 'saude_mental', valor: 29, unidade: 'pts' },
    ],
  },
  {
    id: 'r2', nome: 'Viana', municipio: 'Viana', estado: 'Luanda',
    lat: -8.9035, lng: 13.3740, concentracao: 1280000,
    cobertura_rede: 0.41, cobertura_nivel: 'atencao', programas_count: 4,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Formação tech', categoria: 'formacoes', valor: 22, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 31, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 5, unidade: '/10k' },
      { slug: 'cobertura-mentoria', nome: 'Mentoria', categoria: 'mentorias', valor: 14, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Saúde mental', categoria: 'saude_mental', valor: 41, unidade: 'pts' },
    ],
  },
  {
    id: 'r3', nome: 'Ingombota', municipio: 'Luanda', estado: 'Luanda',
    lat: -8.8147, lng: 13.2302, concentracao: 210000,
    cobertura_rede: 0.91, cobertura_nivel: 'boa', programas_count: 17,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Formação tech', categoria: 'formacoes', valor: 74, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 78, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 21, unidade: '/10k' },
      { slug: 'cobertura-mentoria', nome: 'Mentoria', categoria: 'mentorias', valor: 61, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Saúde mental', categoria: 'saude_mental', valor: 72, unidade: 'pts' },
    ],
  },
  {
    id: 'r4', nome: 'Cacuaco', municipio: 'Cacuaco', estado: 'Luanda',
    lat: -8.7714, lng: 13.3661, concentracao: 836000,
    cobertura_rede: 0.19, cobertura_nivel: 'critica', programas_count: 1,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Formação tech', categoria: 'formacoes', valor: 5, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 14, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 1, unidade: '/10k' },
      { slug: 'cobertura-mentoria', nome: 'Mentoria', categoria: 'mentorias', valor: 3, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Saúde mental', categoria: 'saude_mental', valor: 22, unidade: 'pts' },
    ],
  },
  {
    id: 'r5', nome: 'Maianga', municipio: 'Luanda', estado: 'Luanda',
    lat: -8.8270, lng: 13.2420, concentracao: 390000,
    cobertura_rede: 0.76, cobertura_nivel: 'boa', programas_count: 11,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Formação tech', categoria: 'formacoes', valor: 58, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 61, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 16, unidade: '/10k' },
      { slug: 'cobertura-mentoria', nome: 'Mentoria', categoria: 'mentorias', valor: 44, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Saúde mental', categoria: 'saude_mental', valor: 63, unidade: 'pts' },
    ],
  },
  {
    id: 'r6', nome: 'Kilamba Kiaxi', municipio: 'Kilamba Kiaxi', estado: 'Luanda',
    lat: -8.8600, lng: 13.2700, concentracao: 720000,
    cobertura_rede: 0.52, cobertura_nivel: 'atencao', programas_count: 6,
    indicadores: [
      { slug: 'cobertura-formacao-tech', nome: 'Formação tech', categoria: 'formacoes', valor: 34, unidade: '%' },
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 42, unidade: '%' },
      { slug: 'densidade-iniciativas', nome: 'Iniciativas sociais', categoria: 'experiencias', valor: 9, unidade: '/10k' },
      { slug: 'cobertura-mentoria', nome: 'Mentoria', categoria: 'mentorias', valor: 27, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Saúde mental', categoria: 'saude_mental', valor: 48, unidade: 'pts' },
    ],
  },
]

export const RESPOSTAS_MOCK: Record<string, DadosResponse> = {
  default: {
    resposta_ia: 'Com base nos dados Vísent CDRView para Luanda, identifico padrões críticos de exclusão digital. Os municípios periféricos — Cacuaco, Cazenga e Viana — concentram mais de 3 milhões de habitantes mas registam cobertura de rede abaixo de 50%, criando uma barreira estrutural ao acesso a serviços digitais e programas sociais.',
    dados: REGIOES_MOCK.map(r => ({ regiao: r.nome, valor: Math.round(r.cobertura_rede * 100), fonte: 'Vísent CDRView' })),
    fontes: ['Vísent CDRView', 'INE Angola'],
  },
  formacao: {
    resposta_ia: 'Cacuaco (5%) e Cazenga (9%) têm cobertura de formação tech criticamente baixa. Juntos somam mais de 1,7 milhões de habitantes sem acesso a qualificação digital. A ausência de conectividade agrava o problema: sem rede estável, formações online são inacessíveis. Recomenda-se priorizar centros de formação presencial nestes dois municípios antes de programas digitais.',
    dados: REGIOES_MOCK.map(r => ({ regiao: r.nome, valor: r.indicadores.find(i => i.slug === 'cobertura-formacao-tech')?.valor ?? 0, fonte: 'INE Angola' })),
    fontes: ['INE Angola', 'Vísent CDRView'],
  },
  emprego: {
    resposta_ia: 'Cacuaco (14%) e Cazenga (18%) têm as menores taxas de emprego formal de Luanda, apesar de serem municípios de alta densidade. A combinação de baixa conectividade e baixo emprego formal cria um ciclo de exclusão: sem acesso a plataformas de emprego online, a informalidade perpetua-se. Intervenções nestes municípios devem incluir infraestrutura digital antes de programas de empregabilidade.',
    dados: REGIOES_MOCK.map(r => ({ regiao: r.nome, valor: r.indicadores.find(i => i.slug === 'taxa-emprego-formal')?.valor ?? 0, fonte: 'INE Angola' })),
    fontes: ['INE Angola', 'Vísent CDRView'],
  },
  saude: {
    resposta_ia: 'Cacuaco regista o índice mais crítico de saúde mental (22 pts) com a menor cobertura de rede (19%). Sem conectividade, serviços de apoio psicológico remoto, linhas de crise e plataformas de triagem são inacessíveis. Qualquer política de saúde mental em Cacuaco deve começar por infraestrutura de rede — antenas antes de aplicações digitais.',
    dados: REGIOES_MOCK.map(r => ({ regiao: r.nome, valor: r.indicadores.find(i => i.slug === 'indice-saude-mental')?.valor ?? 0, fonte: 'OMS / INE Angola' })),
    fontes: ['OMS', 'INE Angola', 'Vísent CDRView'],
  },
}

export function getMockResposta(consulta: string): DadosResponse {
  const q = consulta.toLowerCase()
  if (q.includes('forma') || q.includes('curso') || q.includes('tech') || q.includes('qualifica')) return RESPOSTAS_MOCK.formacao
  if (q.includes('emprego') || q.includes('trabalho') || q.includes('mercado') || q.includes('formal')) return RESPOSTAS_MOCK.emprego
  if (q.includes('saúde') || q.includes('mental') || q.includes('saude') || q.includes('psicol')) return RESPOSTAS_MOCK.saude
  return RESPOSTAS_MOCK.default
}
