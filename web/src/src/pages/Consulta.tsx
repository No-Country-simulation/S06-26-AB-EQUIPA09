import { useAppStore } from '../store'
import AIQueryBar from '../components/query/AIQueryBar'

const EXEMPLOS = [
  { q: 'Onde faltam programas de formação tech para jovens de baixa renda?', tag: 'Formação', cor: '#EEF2FF', corText: '#4338CA' },
  { q: 'Regiões com alta concentração de pessoas mas baixo emprego formal?', tag: 'Emprego', cor: '#FEF3C7', corText: '#92400E' },
  { q: 'Onde falta conectividade antes de chegarem os programas de saúde mental?', tag: 'Saúde mental', cor: '#FFF0F0', corText: '#991B1B' },
]

export default function Consulta() {
  const { ultimaResposta, setConsultaAtual } = useAppStore()

  return (
    <div style={{ minHeight: '100%', padding: '40px', maxWidth: '780px', margin: '0 auto' }}>

      <div style={{ marginBottom: '36px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          Agente de análise de dados
        </p>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ao-black)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Consulta em linguagem natural
        </h1>
        <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.6 }}>
          Pergunte sobre os dados de Luanda em português. O agente analisa o dataset Vísent CDRView e responde com evidências e fontes.
        </p>
        <div style={{ marginTop: '20px', height: '2px', background: 'var(--border-card)' }}>
          <div style={{ width: '60px', height: '2px', background: 'var(--ao-red)' }} />
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)', borderRadius: '14px',
        border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)',
        padding: '24px', marginBottom: '24px',
      }}>
        <AIQueryBar />
      </div>

      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          Perguntas sugeridas
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {EXEMPLOS.map(ex => (
            <button key={ex.q} onClick={() => setConsultaAtual(ex.q)}
              style={{
                textAlign: 'left', padding: '14px 18px', borderRadius: '10px',
                border: '1px solid var(--border-card)', background: 'var(--bg-card)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px',
                transition: 'border-color 0.15s', fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-card)')}>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                background: ex.cor, color: ex.corText, flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {ex.tag}
              </span>
              <span style={{ fontSize: '13px', color: '#444', lineHeight: 1.4 }}>{ex.q}</span>
            </button>
          ))}
        </div>
      </div>

      {ultimaResposta && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: '14px',
          border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ao-black)' }}>Dados detalhados</h2>
            <span style={{ fontSize: '11px', color: '#aaa' }}>Última consulta</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafaf8' }}>
                  {['Município', 'Valor', 'Fonte'].map(h => (
                    <th key={h} style={{ padding: '10px 24px', fontSize: '11px', fontWeight: 600, color: '#aaa', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-card)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ultimaResposta.dados.map((d, i) => (
                  <tr key={i} style={{ borderBottom: i < ultimaResposta.dados.length - 1 ? '1px solid #f5f4f1' : 'none' }}>
                    <td style={{ padding: '12px 24px', fontSize: '13px', fontWeight: 500, color: 'var(--ao-black)' }}>{d.regiao}</td>
                    <td style={{ padding: '12px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '80px', height: '4px', background: '#f0efec', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round(d.valor)}%`, height: '100%', background: d.valor < 30 ? 'var(--ao-red)' : d.valor < 60 ? 'var(--ao-gold)' : '#16a34a', borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ao-black)' }}>{Math.round(d.valor)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: '12px', color: '#aaa' }}>{d.fonte}</td>
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
