import { useState, useEffect } from 'react'
import { useConsultaAgente } from '../../hooks/useApi'
import { useAppStore } from '../../store'

const EXEMPLOS = [
  'Onde faltam programas de formação para jovens de baixa renda?',
  'Regiões com alta concentração de pessoas mas baixo emprego formal?',
  'Onde falta conectividade antes de chegarem os programas de saúde mental?',
]

interface Props {
  onResposta?: () => void
  compact?: boolean
}

export default function AIQueryBar({ onResposta, compact }: Props) {
  const { consultaAtual, setConsultaAtual, setUltimaResposta, ultimaResposta } = useAppStore()
  const [input, setInput] = useState(consultaAtual)
  const consulta = useConsultaAgente()

  useEffect(() => { if (consultaAtual) setInput(consultaAtual) }, [consultaAtual])

  async function handleSubmit() {
    if (!input.trim()) return
    setConsultaAtual(input)
    const res = await consulta.mutateAsync(input)
    setUltimaResposta(res)
    onResposta?.()
  }

  return (
    <div className="w-full">
      <div className="flex gap-2 group">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-signal-400 font-mono text-[13px] select-none">›</span>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Faça uma pergunta sobre os dados públicos…"
            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-ink-border bg-ink-850 text-[14px] text-mist-100 placeholder:text-mist-600 focus:outline-none focus:ring-2 focus:ring-signal-500/30 focus:border-signal-500/60 transition-all"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={consulta.isPending || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-signal-500 text-ink-950 text-[13px] font-semibold hover:bg-signal-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {consulta.isPending ? 'A analisar…' : 'Consultar ✦'}
        </button>
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-2 mt-3">
          {EXEMPLOS.map(ex => (
            <button
              key={ex}
              onClick={() => { setInput(ex); setConsultaAtual(ex) }}
              className="text-[12px] px-3 py-1.5 rounded-full border border-ink-border text-mist-400 hover:border-signal-500/50 hover:text-signal-400 transition-colors bg-ink-850"
            >
              {ex.length > 55 ? ex.slice(0, 52) + '…' : ex}
            </button>
          ))}
        </div>
      )}

      {consulta.isPending && (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-mist-500 font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-signal-400 animate-pulse" />
          a analisar os dados…
        </div>
      )}

      {consulta.isError && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--color-status-bad)' }}>
          Não foi possível processar a consulta. Tente novamente.
        </p>
      )}

      {ultimaResposta && !consulta.isPending && (
        <div className="mt-4 p-4 rounded-xl bg-ink-850 border border-ink-border-soft border-l-2 border-l-signal-500">
          <p className="text-[13px] text-mist-100 leading-relaxed">{ultimaResposta.resposta_ia}</p>
          {ultimaResposta.fontes.length > 0 && (
            <p className="mt-2 text-[11px] text-mist-600 font-mono">Fontes: {ultimaResposta.fontes.join(' · ')}</p>
          )}
        </div>
      )}
    </div>
  )
}