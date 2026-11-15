import { describe, it, expect } from 'vitest'
import {
  MUNICIPALITIES,
  capsCoverage,
  capsToProgram,
  distanceKm,
  employmentRate,
  nearestRegion,
  parseSidraValue,
} from '../application/services/public-data'

describe('employmentRate', () => {
  it('assalariados / população em %', () => {
    // Florianópolis: CEMPRE 2021 / Censo 2022
    expect(employmentRate(288_928, 537_211)).toBe(53.8)
    expect(employmentRate(16_523, 76_773)).toBe(21.5)
  })
  it('limita a 100% (polos de emprego)', () => {
    expect(employmentRate(200, 100)).toBe(100)
  })
  it.each([
    [1, 0],
    [1, -5],
    [NaN, 10],
    [10, NaN],
  ])('recusa valores inválidos: %j', (a, b) => {
    expect(() => employmentRate(a, b)).toThrow()
  })
})

describe('capsCoverage', () => {
  it('calcula CAPS por 100 mil hab. e pontuação face à meta de 0,70', () => {
    const r = capsCoverage(5, 537_211)
    expect(r.per100k).toBe(0.93)
    expect(r.score).toBe(100)
  })
  it('pontuação proporcional abaixo da meta', () => {
    // 1 CAPS para 285.714 hab. = 0,35 por 100 mil = 50% da meta
    expect(capsCoverage(1, 285_714).score).toBe(50)
    expect(capsCoverage(0, 100_000)).toEqual({ per100k: 0, score: 0 })
  })
  it.each([
    [-1, 100],
    [1, 0],
    [NaN, 100],
  ])('recusa valores inválidos: %j', (c, p) => {
    expect(() => capsCoverage(c, p)).toThrow()
  })
})

describe('geografia', () => {
  it('distanceKm: 0 para o mesmo ponto e coerente entre pontos conhecidos', () => {
    const a = { lat: -27.5954, lng: -48.548 }
    expect(distanceKm(a, a)).toBe(0)
    // Centro de Florianópolis ↔ Centro de São José ≈ 8–10 km
    const d = distanceKm(a, { lat: -27.6136, lng: -48.6366 })
    expect(d).toBeGreaterThan(7)
    expect(d).toBeLessThan(11)
  })

  const regions = [
    { id: 'a', municipality: 'Florianopolis', lat: -27.6, lng: -48.55 },
    { id: 'b', municipality: 'Florianopolis', lat: -27.7, lng: -48.5 },
    { id: 'c', municipality: 'Sao Jose', lat: -27.61, lng: -48.63 },
  ]
  it('nearestRegion escolhe a mais próxima dentro do mesmo município', () => {
    expect(nearestRegion({ lat: -27.69, lng: -48.5 }, 'Florianopolis', regions)?.id).toBe('b')
  })
  it('nearestRegion ignora regiões de outro município, mesmo que mais próximas', () => {
    expect(nearestRegion({ lat: -27.61, lng: -48.63 }, 'Florianopolis', regions)?.id).toBe('a')
  })
  it('nearestRegion devolve null se o município não tem regiões', () => {
    expect(nearestRegion({ lat: 0, lng: 0 }, 'Palhoca', regions)).toBeNull()
  })
})

describe('capsToProgram', () => {
  const flp = MUNICIPALITIES.find((m) => m.name === 'Florianopolis')!
  const caps = {
    codigo_cnes: 2663082,
    nome_fantasia: 'CAPS PONTA DO CORAL',
    nome_razao_social: 'PREF MUN FLORIANOPOLIS SMS FMS',
    descricao_esfera_administrativa: 'MUNICIPAL',
    bairro_estabelecimento: 'AGRONOMICA',
    latitude_estabelecimento_decimo_grau: -27.5727,
    longitude_estabelecimento_decimo_grau: -48.5379,
    codigo_tipo_unidade: 70,
  }
  it('mapeia o CAPS para uma linha de programa de saúde mental', () => {
    const p = capsToProgram(caps, flp)
    expect(p.name).toBe('CAPS PONTA DO CORAL')
    expect(p.category).toBe('mental_health')
    expect(p.municipality).toBe('Florianopolis')
    expect(p.state).toBe('SC')
    expect(p.description).toContain('Agronomica')
    expect(p.organization).toBe('Pref Mun Florianopolis Sms Fms (Municipal)')
    expect(p.metadata).toMatchObject({ source: 'DATASUS/CNES', cnes: 2663082, lat: -27.5727 })
    expect(p.url).toBe(
      'https://cnes.datasus.gov.br/pages/estabelecimentos/ficha/identificacao/4205402663082'
    )
  })
  it('usa a razão social sem nome fantasia, o código CNES como último recurso, e trunca nomes longos', () => {
    expect(capsToProgram({ codigo_cnes: 1, nome_razao_social: 'ORG X' }, flp).name).toBe('ORG X')
    expect(
      capsToProgram({ codigo_cnes: 1, nome_fantasia: 'A'.repeat(300) }, flp).name
    ).toHaveLength(200)
    expect(capsToProgram({ codigo_cnes: 7 }, flp).name).toBe('CNES 7')
  })
})

describe('parseSidraValue', () => {
  it('converte números e trata marcadores de ausência como null', () => {
    expect(parseSidraValue('537211')).toBe(537211)
    expect(parseSidraValue('4.5')).toBe(4.5)
    expect(parseSidraValue('-')).toBeNull()
    expect(parseSidraValue('...')).toBeNull()
    expect(parseSidraValue('X')).toBeNull()
    expect(parseSidraValue(undefined)).toBeNull()
  })
})
