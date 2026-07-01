import { useRegioes } from '../hooks/useApi'
import MapView from '../components/map/MapView'
import RegionPanel from '../components/map/RegionPanel'
import { useAppStore } from '../store'

const INDICADORES = [
  { slug: 'cobertura-formacao-tech', label: 'Formação' },
  { slug: 'taxa-emprego-formal', label: 'Emprego' },
  { slug: 'densidade-iniciativas', label: 'Iniciativas' },
  { slug: 'cobertura-mentoria', label: 'Mentoria' },
  { slug: 'indice-saude-mental', label: 'Saúde mental' },
]

const FILTROS = [
  { value: 'todas', label: 'Todos' },
  { value: 'critica', label: 'Crítica' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'boa', label: 'Boa' },
] as const

export default function Mapa() {
  const { data: regioes = [], isLoading } = useRegioes()
  const { indicadorAtivo, setIndicadorAtivo, filtroCobertura, setFiltroCobertura, regiaoSelecionada } = useAppStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border-card)',
        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
      }}>
        <h1 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ao-black)', flexShrink: 0 }}>
          Mapa de cobertura
        </h1>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 600, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '2px' }}>
            Indicador
          </span>
          {INDICADORES.map(ind => (
            <button key={ind.slug} onClick={() => setIndicadorAtivo(ind.slug)}
              style={{
                fontSize: '12px', padding: '5px 12px', borderRadius: '20px', border: '1px solid',
                borderColor: indicadorAtivo === ind.slug ? 'var(--ao-black)' : 'var(--border-strong)',
                background: indicadorAtivo === ind.slug ? 'var(--ao-black)' : '#fff',
                color: indicadorAtivo === ind.slug ? '#fff' : '#555',
                cursor: 'pointer', fontWeight: indicadorAtivo === ind.slug ? 600 : 400,
                transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
              }}>
              {ind.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 600, alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '2px' }}>
            Filtro
          </span>
          {FILTROS.map(f => (
            <button key={f.value} onClick={() => setFiltroCobertura(f.value)}
              style={{
                fontSize: '12px', padding: '5px 12px', borderRadius: '20px', border: '1px solid',
                borderColor: filtroCobertura === f.value ? 'var(--ao-red)' : 'var(--border-strong)',
                background: filtroCobertura === f.value ? 'var(--ao-red-light)' : '#fff',
                color: filtroCobertura === f.value ? 'var(--ao-red-deep)' : '#555',
                cursor: 'pointer', fontWeight: filtroCobertura === f.value ? 600 : 400,
                transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {isLoading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f3f0' }}>
              <p style={{ fontSize: '13px', color: '#aaa' }}>A carregar mapa de Luanda…</p>
            </div>
          ) : (
            <MapView regioes={regioes} />
          )}

          <div style={{
            position: 'absolute', bottom: '24px', left: '20px', zIndex: 400,
            background: 'var(--bg-card)', borderRadius: '10px',
            border: '1px solid var(--border-card)', padding: '14px 16px',
            boxShadow: 'var(--shadow-lift)',
          }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Cobertura de rede
            </p>
            {[
              { cor: '#16a34a', label: 'Boa  (>65%)' },
              { cor: '#d97706', label: 'Atenção  (35–65%)' },
              { cor: '#CC0000', label: 'Crítica  (<35%)' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.cor, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#555' }}>{l.label}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border-card)', marginTop: '10px', paddingTop: '10px' }}>
              <p style={{ fontSize: '11px', color: '#aaa' }}>Tamanho do círculo = concentração populacional</p>
            </div>
          </div>
        </div>

        {regiaoSelecionada && <RegionPanel regiao={regiaoSelecionada} />}
      </div>
    </div>
  )
}
