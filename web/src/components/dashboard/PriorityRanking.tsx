import { useNavigate } from 'react-router-dom'
import type { Regiao } from '../../types'
import { calcularPrioridades } from '../../lib/indicadores'
import { useAppStore } from '../../store'

function indiceColor(indice: number) {
  if (indice >= 65) return 'var(--color-status-bad)'
  if (indice >= 40) return 'var(--color-status-warn)'
  return 'var(--color-status-good)'
}

export default function PriorityRanking({ regioes }: { regioes: Regiao[] }) {
  const { setRegiaoSelecionada } = useAppStore()
  const navigate = useNavigate()
  const ranking = calcularPrioridades(regioes).slice(0, 5)

  function investigar(r: Regiao) {
    setRegiaoSelecionada(r)
    navigate('/app/mapa')
  }

  return (
    <div className="bg-ink-900 rounded-2xl border border-ink-border-soft overflow-hidden">
      <div className="px-5 py-3.5 border-b border-ink-border-soft">
        <h2 className="text-[13px] font-medium text-mist-200 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-400" />
          Prioridade de investimento
        </h2>
        <p className="text-[11px] text-mist-600 mt-0.5">
          Ranking algorítmico · população, cobertura de rede e défice de programas sociais
        </p>
      </div>

      <div className="divide-y divide-ink-border-soft">
        {ranking.map(({ regiao, indice, motivo }, i) => (
          <button
            key={regiao.id}
            onClick={() => investigar(regiao)}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-ink-850 transition-colors text-left group"
          >
            <span className="font-mono text-[13px] text-mist-600 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium text-mist-100 truncate">{regiao.nome}</p>
                <span className="font-mono text-[13px] font-semibold shrink-0" style={{ color: indiceColor(indice) }}>
                  {indice}
                </span>
              </div>
              <p className="text-[11px] text-mist-600 truncate mt-0.5">{motivo}</p>
              <div className="mt-1.5 h-1 rounded-full bg-ink-border-soft overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${indice}%`, background: indiceColor(indice) }}
                />
              </div>
            </div>

            <span className="text-mist-600 group-hover:text-signal-400 transition-colors text-[13px] shrink-0">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
