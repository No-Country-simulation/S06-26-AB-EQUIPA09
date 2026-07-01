import { useNavigate } from 'react-router-dom'
import { useRegioes } from '../hooks/useApi'
import AIQueryBar from '../components/query/AIQueryBar'
import { CoberturaBadge, MiniBar } from '../components/ui'
import { useAppStore } from '../store'

const INDICADORES = [
  { slug: 'cobertura-formacao-tech', label: 'Formação tech', icon: '📚' },
  { slug: 'taxa-emprego-formal', label: 'Emprego formal', icon: '💼' },
  { slug: 'densidade-iniciativas', label: 'Iniciativas sociais', icon: '🤝' },
  { slug: 'cobertura-mentoria', label: 'Mentorias', icon: '🎯' },
  { slug: 'indice-saude-mental', label: 'Saúde mental', icon: '🧠' },
]

function media(regioes: any[], slug: string) {
  if (!regioes.length) return 0
  const vals = regioes.map((r: any) => r.indicadores.find((i: any) => i.slug === slug)?.valor ?? 0)
  return Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length)
}

export default function Dashboard() {
  const { data: regioes = [], isLoading } = useRegioes()
  const { setUltimaResposta } = useAppStore()
  const navigate = useNavigate()

  const criticas = regioes.filter(r => r.cobertura_nivel === 'critica').length
  const totalHab = regioes.reduce((a, r) => a + r.concentracao, 0)
  const cobMedia = regioes.length
    ? Math.round(regioes.reduce((a, r) => a + r.cobertura_rede, 0) / regioes.length * 100)
    : 0

  return (
    <div style={{ padding: '32px', maxWidth: '1080px', margin: '0 auto' }}>

      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              República de Angola · Província de Luanda
            </p>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ao-black)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Painel de Inclusão Digital
            </h1>
            <p style={{ fontSize: '13px', color: '#888', marginTop: '6px' }}>
              Dados Vísent CDRView · {regioes.length} municípios analisados
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', marginTop: '4px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#888' }}>Dados actualizados</span>
          </div>
        </div>
        <div style={{ marginTop: '20px', height: '2px', background: 'var(--border-card)' }}>
          <div style={{ width: '60px', height: '2px', background: 'var(--ao-red)' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Municípios analisados', value: regioes.length, sub: 'Luanda', accent: undefined },
          { label: 'Cobertura crítica', value: criticas, sub: 'municípios em alerta', accent: 'red' as const },
          { label: 'População total', value: `${(totalHab / 1000000).toFixed(1)}M`, sub: 'habitantes cobertos', accent: undefined },
          { label: 'Cobertura média rede', value: `${cobMedia}%`, sub: 'CDRView médio', accent: cobMedia < 50 ? 'red' as const : 'gold' as const },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', borderRadius: '12px',
            border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)', padding: '20px 22px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              {s.label}
            </p>
            <p style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: s.accent === 'red' ? 'var(--ao-red)' : s.accent === 'gold' ? 'var(--ao-gold)' : 'var(--ao-black)' }}>
              {isLoading ? '—' : s.value}
            </p>
            <p style={{ fontSize: '12px', color: '#aaa', marginTop: '6px' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: '20px', marginBottom: '28px', alignItems: 'start' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)', padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ao-black)' }}>Médias nacionais por indicador</h2>
            <span style={{ fontSize: '11px', color: '#aaa' }}>Luanda · {regioes.length} municípios</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {INDICADORES.map(ind => {
              const val = isLoading ? 0 : media(regioes, ind.slug)
              return (
                <div key={ind.slug} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 36px', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#444', fontWeight: 500 }}>{ind.label}</span>
                  <div style={{ height: '6px', background: '#f0efec', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${val}%`, height: '100%', borderRadius: '3px',
                      background: val < 30 ? 'var(--ao-red)' : val < 60 ? 'var(--ao-gold)' : '#16a34a',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ao-black)', textAlign: 'right' }}>{val}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)', padding: '22px 24px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ao-black)', marginBottom: '16px' }}>Cobertura por município</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...regioes].sort((a, b) => a.cobertura_rede - b.cobertura_rede).map(r => (
              <div key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#444', fontWeight: 500 }}>{r.nome}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: r.cobertura_rede < 0.35 ? 'var(--ao-red)' : r.cobertura_rede < 0.65 ? 'var(--ao-gold)' : '#16a34a' }}>
                    {Math.round(r.cobertura_rede * 100)}%
                  </span>
                </div>
                <div style={{ height: '4px', background: '#f0efec', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.round(r.cobertura_rede * 100)}%`, height: '100%', borderRadius: '2px',
                    background: r.cobertura_rede < 0.35 ? 'var(--ao-red)' : r.cobertura_rede < 0.65 ? 'var(--ao-gold)' : '#16a34a',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)', padding: '22px 24px', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ao-black)', marginBottom: '4px' }}>Consulta rápida</h2>
        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '16px' }}>Pergunte sobre os dados em linguagem natural</p>
        <AIQueryBar compact onResposta={() => navigate('/consulta')} />
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ao-black)' }}>Municípios de Luanda</h2>
          <button onClick={() => navigate('/mapa')} style={{
            background: 'none', border: 'none', fontSize: '12px', color: 'var(--ao-red)',
            cursor: 'pointer', fontWeight: 600,
          }}>Ver no mapa →</button>
        </div>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>A carregar…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafaf8' }}>
                {['Município', 'Habitantes', 'Cobertura rede', 'Formação', 'Emprego', 'Saúde mental', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', fontSize: '11px', fontWeight: 600, color: '#aaa', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-card)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regioes.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < regioes.length - 1 ? '1px solid #f5f4f1' : 'none' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ao-black)' }}>{r.nome}</p>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#555' }}>
                    {(r.concentracao / 1000).toFixed(0)}k
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: r.cobertura_rede < 0.35 ? 'var(--ao-red)' : r.cobertura_rede < 0.65 ? 'var(--ao-gold)' : '#16a34a' }}>
                    {Math.round(r.cobertura_rede * 100)}%
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#555' }}>
                    {r.indicadores.find(i => i.slug === 'cobertura-formacao-tech')?.valor}%
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#555' }}>
                    {r.indicadores.find(i => i.slug === 'taxa-emprego-formal')?.valor}%
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: '#555' }}>
                    {r.indicadores.find(i => i.slug === 'indice-saude-mental')?.valor} pts
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <CoberturaBadge nivel={r.cobertura_nivel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
