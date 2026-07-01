import { useNavigate } from 'react-router-dom'
import type { Regiao } from '../../types'
import { useAppStore } from '../../store'
import { CoberturaBadge, MiniBar } from '../ui'

const CAT_LABEL: Record<string, string> = {
  formacoes: 'Formação tech', empregabilidade: 'Emprego formal',
  experiencias: 'Iniciativas', mentorias: 'Mentoria', saude_mental: 'Saúde mental',
}

export default function RegionPanel({ regiao }: { regiao: Regiao }) {
  const { setConsultaAtual, setRegiaoSelecionada } = useAppStore()
  const navigate = useNavigate()

  return (
    <div style={{
      width: '280px', flexShrink: 0, background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border-card)', display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ao-black)', marginBottom: '2px' }}>
              {regiao.nome}
            </h2>
            <p style={{ fontSize: '12px', color: '#888' }}>{regiao.municipio} · {regiao.estado}</p>
          </div>
          <button onClick={() => setRegiaoSelecionada(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px',
            color: '#aaa', lineHeight: 1, padding: '2px',
          }}>×</button>
        </div>
        <CoberturaBadge nivel={regiao.cobertura_nivel} />
      </div>

      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            { label: 'Concentração', value: `${(regiao.concentracao / 1000).toFixed(0)}k`, sub: 'habitantes' },
            { label: 'Cobertura rede', value: `${Math.round(regiao.cobertura_rede * 100)}%`, sub: 'CDRView' },
            { label: 'Programas', value: `${regiao.programas_count}`, sub: 'activos' },
          ].map(m => (
            <div key={m.label}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{m.label}</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ao-black)', lineHeight: 1 }}>{m.value}</p>
              <p style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
        <p style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
          Indicadores
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {regiao.indicadores.map(ind => (
            <div key={ind.slug}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '12px', color: '#444', fontWeight: 500 }}>{CAT_LABEL[ind.categoria]}</span>
                <span style={{ fontSize: '11px', color: '#aaa' }}>{ind.unidade}</span>
              </div>
              <MiniBar valor={ind.valor} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-card)' }}>
        <button onClick={() => {
          setConsultaAtual(`Quais são os principais desafios de inclusão digital em ${regiao.nome}, Luanda?`)
          navigate('/consulta')
        }} style={{
          width: '100%', padding: '10px', borderRadius: '8px',
          background: 'var(--ao-red)', color: '#fff', border: 'none',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em',
        }}>
          Consultar sobre {regiao.nome} →
        </button>
      </div>
    </div>
  )
}
