import { useAppStore } from '../store'
import AIQueryBar from '../components/query/AIQueryBar'

const EXEMPLOS_COMPLETOS = [
  { q: 'Onde faltam programas de formação para jovens de baixa renda?', tag: 'Formações' },
  { q: 'Regiões com alta concentração de pessoas mas baixo emprego formal?', tag: 'Emprego' },
  { q: 'Onde falta conectividade antes de chegarem os programas de saúde mental?', tag: 'Saúde Mental' },
]

export default function Consulta() {
  const { ultimaResposta, setConsultaAtual } = useAppStore()

  return (
    <div className="min-h-full p-7 max-w-3xl mx-auto">
      <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5 mb-6">
        <AIQueryBar />
      </div>

      <div className="mb-6">
        <p className="text-[10.5px] font-mono font-medium text-mist-600 uppercase tracking-wider mb-3">Exemplos de perguntas</p>
        <div className="space-y-2">
          {EXEMPLOS_COMPLETOS.map(ex => (
            <button
              key={ex.q}
              onClick={() => setConsultaAtual(ex.q)}
              className="w-full text-left px-4 py-3 rounded-xl border border-ink-border-soft bg-ink-900 hover:border-signal-500/40 hover:bg-ink-850 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-800 text-mist-500 shrink-0 mt-0.5 group-hover:bg-signal-500/15 group-hover:text-signal-400 transition-colors font-mono">
                  {ex.tag}
                </span>
                <span className="text-[13px] text-mist-200">{ex.q}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {ultimaResposta && (
        <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5">
          <h2 className="text-[12px] font-mono uppercase tracking-wider text-mist-500 mb-3">Dados da última consulta</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-ink-border-soft">
                  <th className="text-left py-2 text-mist-600 font-medium font-mono uppercase text-[10.5px] tracking-wider">Região</th>
                  <th className="text-right py-2 text-mist-600 font-medium font-mono uppercase text-[10.5px] tracking-wider">Valor</th>
                  <th className="text-right py-2 text-mist-600 font-medium font-mono uppercase text-[10.5px] tracking-wider">Fonte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border-soft">
                {ultimaResposta.dados.map((d, i) => (
                  <tr key={i}>
                    <td className="py-2 text-mist-200">{d.regiao}</td>
                    <td className="py-2 text-right font-medium text-mist-50 font-mono">{Math.round(d.valor)}%</td>
                    <td className="py-2 text-right text-mist-600 font-mono">{d.fonte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
