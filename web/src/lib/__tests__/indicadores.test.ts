import { describe, it, expect } from 'vitest'
import { calcularPrioridades, mediaIndicador, regiaoMaisCritica, temDadosIndicador } from '../indicadores'
import type { Regiao } from '../../types'

const regiao = (over: Partial<Regiao> & { id: string }): Regiao => ({
  nome: over.id, municipio: 'M', estado: 'SC', lat: 0, lng: 0, concentracao: 1000,
  cobertura_rede: 0.5, cobertura_nivel: 'atencao', programas_count: 0, indicadores: [], ...over,
})
const ind = (slug: string, valor: number) =>
  ({ slug, nome: slug, categoria: 'empregabilidade' as const, valor, unidade: '%' })

describe('mediaIndicador', () => {
  it('média arredondada por slug; regiões sem o indicador contam como 0', () => {
    const rs = [
      regiao({ id: 'a', indicadores: [ind('x', 40)] }),
      regiao({ id: 'b', indicadores: [ind('x', 21)] }),
      regiao({ id: 'c' }),
    ]
    expect(mediaIndicador(rs, 'x')).toBe(20)
    expect(mediaIndicador([], 'x')).toBe(0)
  })
})

describe('regiaoMaisCritica', () => {
  it('devolve a de menor cobertura de rede', () => {
    const rs = [regiao({ id: 'a', cobertura_rede: 0.6 }), regiao({ id: 'b', cobertura_rede: 0.25 })]
    expect(regiaoMaisCritica(rs)?.id).toBe('b')
    expect(regiaoMaisCritica([])).toBeNull()
  })
})

describe('calcularPrioridades', () => {
  it('lista vazia', () => {
    expect(calcularPrioridades([])).toEqual([])
  })

  it('ordena da mais urgente para a menos urgente (mais gente + pior rede + piores indicadores)', () => {
    const pior = regiao({ id: 'pior', concentracao: 5000, cobertura_rede: 0.2, indicadores: [ind('x', 10)] })
    const melhor = regiao({ id: 'melhor', concentracao: 500, cobertura_rede: 0.9, indicadores: [ind('x', 90)] })
    const r = calcularPrioridades([melhor, pior])
    expect(r.map(p => p.regiao.id)).toEqual(['pior', 'melhor'])
    expect(r[0].indice).toBeGreaterThan(r[1].indice)
  })

  it('aplica os pesos 40/35/25', () => {
    // única região: população 100, défice de rede (1-0.5)*100=50, défice de indicadores 100-60=40
    const [p] = calcularPrioridades([regiao({ id: 'a', concentracao: 10, cobertura_rede: 0.5, indicadores: [ind('x', 60)] })])
    expect(p.indice).toBe(Math.round(100 * 0.4 + 50 * 0.35 + 40 * 0.25))
  })

  it('explica o motivo dominante', () => {
    const rede = calcularPrioridades([
      regiao({ id: 'a', concentracao: 100, cobertura_rede: 0.05, indicadores: [ind('x', 99)] }),
      regiao({ id: 'b', concentracao: 100000 }),
    ]).find(p => p.regiao.id === 'a')
    expect(rede?.motivo).toBe('Cobertura de rede é o principal obstáculo')

    const gente = calcularPrioridades([regiao({ id: 'a', concentracao: 9000, cobertura_rede: 0.9, indicadores: [ind('x', 95)] })])
    expect(gente[0].motivo).toBe('Alta concentração populacional amplifica o impacto')

    const programas = calcularPrioridades([
      regiao({ id: 'a', concentracao: 1, cobertura_rede: 0.9, indicadores: [ind('x', 0)] }),
      regiao({ id: 'b', concentracao: 10000, cobertura_rede: 0.9, indicadores: [ind('x', 100)] }),
    ]).find(p => p.regiao.id === 'a')
    expect(programas?.motivo).toBe('Défice acentuado em programas sociais')
  })
})

describe('temDadosIndicador', () => {
  it('"tudo zero" ou ausente significa sem dados; qualquer valor real conta como dados', () => {
    expect(temDadosIndicador([], 'x')).toBe(false)
    expect(temDadosIndicador([regiao({ id: 'a', indicadores: [ind('x', 0)] })], 'x')).toBe(false)
    expect(temDadosIndicador([regiao({ id: 'a' })], 'x')).toBe(false)
    expect(temDadosIndicador([regiao({ id: 'a', indicadores: [ind('x', 0)] }), regiao({ id: 'b', indicadores: [ind('x', 22)] })], 'x')).toBe(true)
    expect(temDadosIndicador([regiao({ id: 'a', indicadores: [ind('y', 50)] })], 'x')).toBe(false)
  })
})
