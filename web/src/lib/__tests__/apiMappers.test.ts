import { describe, it, expect } from 'vitest'
import { mapAgentResponse, mapBackendRegioes, pickValor } from '../apiMappers'

describe('pickValor', () => {
  it('converte scores 0–1 em percentagem', () => {
    expect(pickValor({ name: 'A', network_coverage_score: 0.25 })).toEqual({ valor: 25, unidade: '%' })
  })
  it('mantém contagens sem unidade', () => {
    expect(pickValor({ municipality: 'Florianopolis', total_antenas: 92 })).toEqual({ valor: 92, unidade: '' })
    expect(pickValor({ name: 'A', total: 7 })).toEqual({ valor: 7, unidade: '' })
  })
  it('aceita números vindos como string (Postgres)', () => {
    expect(pickValor({ name: 'A', avg_value: '12.5' })).toEqual({ valor: 12.5, unidade: '' })
  })
  it('ignora ids e booleanos ao procurar a coluna numérica', () => {
    expect(pickValor({ id: 3, ativo: true, name: 'A', pessoas: 40 })).toEqual({ valor: 40, unidade: '' })
  })
  it('sem coluna numérica devolve 0', () => {
    expect(pickValor({ name: 'A' })).toEqual({ valor: 0, unidade: '' })
  })
})

describe('mapAgentResponse', () => {
  it('mapeia resposta, linhas e SQL gerado', () => {
    const r = mapAgentResponse({
      aiResponse: 'X: 0.25',
      generatedSql: 'SELECT 1',
      result: [{ name: 'CENTRO', network_coverage_score: 0.25 }, { name: 'COQUEIROS', network_coverage_score: 0.37 }],
    })
    expect(r.resposta_ia).toBe('X: 0.25')
    expect(r.sql_gerado).toBe('SELECT 1')
    expect(r.dados).toEqual([
      { regiao: 'CENTRO', valor: 25, unidade: '%', fonte: 'Vísent CDRView' },
      { regiao: 'COQUEIROS', valor: 37, unidade: '%', fonte: 'Vísent CDRView' },
    ])
    expect(r.fontes).toEqual(['Vísent CDRView'])
  })
  it('resultado nulo (sem dados) não quebra', () => {
    const r = mapAgentResponse({ aiResponse: 'Não foram encontrados dados.', result: null })
    expect(r.dados).toEqual([])
  })
})

describe('mapBackendRegioes', () => {
  const regions = [
    { id: 'r1', name: 'CENTRO_HISTORICO', municipality: 'Florianopolis', state: 'SC', lat: -27.59, lng: -48.54 },
    { id: 'r2', name: 'PALHOCA_CENTRO', municipality: 'Palhoca', state: 'SC', lat: -27.64, lng: -48.67 },
  ]
  const coverages = [
    { regionId: 'r1', networkCoverageScore: 0.25, maxConcentration: 5929 },
    { regionId: 'r2', networkCoverageScore: 0.7, maxConcentration: 4432 },
  ]

  it('classifica o nível de cobertura e usa a concentração máxima', () => {
    const [a, b] = mapBackendRegioes(regions, coverages, [])
    expect(a).toMatchObject({ id: 'r1', cobertura_rede: 0.25, cobertura_nivel: 'critica', concentracao: 5929, estado: 'SC' })
    expect(b.cobertura_nivel).toBe('boa')
  })

  // regressão: /indicators/data só traz indicatorId; sem o catálogo todos caíam na categoria errada
  it('resolve o slug do indicador pelo catálogo (indicatorId → slug)', () => {
    const data = [
      { regionId: 'r1', indicatorId: 'ind-emp', value: 53.8 },
      { regionId: 'r1', indicatorId: 'ind-sm', value: 100 },
    ]
    const [a] = mapBackendRegioes(regions, coverages, data, { 'ind-emp': 'taxa-emprego-formal', 'ind-sm': 'indice-saude-mental' })
    expect(a.indicadores).toEqual([
      { slug: 'taxa-emprego-formal', nome: 'Emprego formal', categoria: 'empregabilidade', valor: 54, unidade: '%' },
      { slug: 'indice-saude-mental', nome: 'Saúde mental', categoria: 'saude_mental', valor: 100, unidade: '%' },
    ])
  })

  it('região sem indicadores recebe a lista base com valor 0', () => {
    const [, b] = mapBackendRegioes(regions, coverages, [{ regionId: 'r1', indicatorId: 'x', value: 1 }])
    expect(b.indicadores).toHaveLength(5)
    expect(b.indicadores.every(i => i.valor === 0)).toBe(true)
  })

  it('normaliza scores em 0–100 e usa Florianópolis como coordenada de recurso', () => {
    const [a] = mapBackendRegioes([{ id: 'x', name: 'X' }], [{ regionId: 'x', networkCoverageScore: 65 }], [])
    expect(a.cobertura_rede).toBe(0.65)
    expect(a.lat).toBeLessThan(-27)
    expect(a.estado).toBe('SC')
  })
})
