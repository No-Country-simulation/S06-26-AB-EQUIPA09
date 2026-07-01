import type { Regiao } from '../types'

/** Média nacional (entre as regiões dadas) de um indicador identificado por slug. */
export function mediaIndicador(regioes: Regiao[], slug: string): number {
  if (!regioes.length) return 0
  const vals = regioes.map(r => r.indicadores.find(i => i.slug === slug)?.valor ?? 0)
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/** A região com a cobertura de rede mais baixa — usada para destacar o alerta prioritário. */
export function regiaoMaisCritica(regioes: Regiao[]): Regiao | null {
  if (!regioes.length) return null
  return [...regioes].sort((a, b) => a.cobertura_rede - b.cobertura_rede)[0]
}

export interface PrioridadeRegiao {
  regiao: Regiao
  indice: number
  motivo: string
}

/**
 * Índice de prioridade de investimento (0–100).
 *
 * Combina três sinais normalizados para responder à pergunta que mais importa
 * num contexto B2G: "onde é que cada Kwanza investido gera mais impacto?"
 *
 *  - Concentração populacional (peso 0.40) — mais gente afetada, maior o retorno social.
 *  - Défice de cobertura de rede (peso 0.35) — sem rede, nenhum programa digital chega.
 *  - Défice médio nos indicadores sociais (peso 0.25) — mede a lacuna de programas já existentes.
 *
 * O resultado ordena as regiões da mais para a menos urgente e explica o motivo
 * dominante de cada uma, transformando os dados brutos numa recomendação acionável.
 */
export function calcularPrioridades(regioes: Regiao[]): PrioridadeRegiao[] {
  if (!regioes.length) return []

  const maxConcentracao = Math.max(...regioes.map(r => r.concentracao), 1)

  return regioes
    .map(r => {
      const scorePopulacao = (r.concentracao / maxConcentracao) * 100
      const scoreCobertura = (1 - r.cobertura_rede) * 100
      const mediaIndicadores = r.indicadores.reduce((a, i) => a + i.valor, 0) / (r.indicadores.length || 1)
      const scoreIndicadores = 100 - mediaIndicadores

      const indice = scorePopulacao * 0.4 + scoreCobertura * 0.35 + scoreIndicadores * 0.25

      let motivo = 'Lacuna equilibrada entre rede e programas sociais'
      if (scoreCobertura >= scorePopulacao && scoreCobertura >= scoreIndicadores) {
        motivo = 'Cobertura de rede é o principal obstáculo'
      } else if (scorePopulacao >= scoreCobertura && scorePopulacao >= scoreIndicadores) {
        motivo = 'Alta concentração populacional amplifica o impacto'
      } else if (scoreIndicadores >= scorePopulacao && scoreIndicadores >= scoreCobertura) {
        motivo = 'Défice acentuado em programas sociais'
      }

      return { regiao: r, indice: Math.round(indice), motivo }
    })
    .sort((a, b) => b.indice - a.indice)
}
