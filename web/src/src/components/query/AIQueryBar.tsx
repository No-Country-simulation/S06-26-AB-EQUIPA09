import { useState, useEffect } from 'react'
import { useConsultaAgente } from '../../hooks/useApi'
import { useAppStore } from '../../store'

const EXEMPLOS = [
  'Onde faltam programas de formação tech para jovens?',
  'Regiões com alta concentração mas baixo emprego formal?',
  'Onde falta conectividade antes dos programas de saúde mental?',
]

export default function AIQueryBar({ compact, onResposta }: { compact?: boolean; onResposta?: () => void }) {
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
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Faça uma pergunta sobre os dados de Luanda..."
          style={{
            flex: 1, padding: '11px 16px', borderRadius: '10px',
            border: '1.5px solid var(--border-strong)', background: '#fafafa',
            fontSize: '14px', color: 'var(--ao-black)', outline: 'none',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        <button onClick={handleSubmit} disabled={consulta.isPending || !input.trim()}
          style={{
            padding: '11px 20px', borderRadius: '10px', border: 'none',
            background: consulta.isPending ? '#ccc' : 'var(--ao-black)',
            color: '#fff', fontSize: '13px', fontWeight: 600,
            cursor: consulta.isPending ? 'not-allowed' : 'pointer',
            flexShrink: 0, letterSpacing: '-0.01em',
          }}>
          {consulta.isPending ? 'A analisar…' : 'Consultar ✦'}
        </button>
      </div>

      {!compact && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {EXEMPLOS.map(ex => (
            <button key={ex} onClick={() => { setInput(ex); setConsultaAtual(ex) }}
              style={{
                fontSize: '12px', padding: '6px 12px', borderRadius: '20px',
                border: '1px solid var(--border-strong)', background: '#fff',
                color: '#555', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
              {ex.length > 52 ? ex.slice(0, 49) + '…' : ex}
            </button>
          ))}
        </div>
      )}

      {consulta.isPending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--ao-red)', animation: 'pulse 1.2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '13px', color: '#666' }}>A analisar os dados de Luanda…</span>
        </div>
      )}

      {consulta.isError && (
        <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--ao-red)' }}>
          Não foi possível processar a consulta. Tente novamente.
        </p>
      )}

      {ultimaResposta && !consulta.isPending && (
        <div style={{
          marginTop: '16px', padding: '18px 20px',
          borderRadius: '10px', background: '#f9f8f5',
          border: '1px solid var(--border-card)',
          borderLeft: '3px solid var(--ao-red)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--ao-black)', lineHeight: 1.7 }}>
            {ultimaResposta.resposta_ia}
          </p>
          {ultimaResposta.fontes.length > 0 && (
            <p style={{ marginTop: '10px', fontSize: '11px', color: '#aaa', fontWeight: 500 }}>
              Fontes: {ultimaResposta.fontes.join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
