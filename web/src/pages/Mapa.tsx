import { useRegioes } from '../hooks/useApi'
import MapView from '../components/map/MapView'
import RegionPanel from '../components/map/RegionPanel'
import { useAppStore } from '../store'

const INDICADORES = [
  { slug: 'cobertura-formacao-tech', label: 'Formações' },
  { slug: 'taxa-emprego-formal', label: 'Emprego' },
  { slug: 'densidade-iniciativas', label: 'Iniciativas' },
  { slug: 'cobertura-mentoria', label: 'Mentorias' },
  { slug: 'indice-saude-mental', label: 'Saúde Mental' },
]

export default function Mapa() {
  const { data: regioes = [], isLoading } = useRegioes()
  const { indicadorAtivo, setIndicadorAtivo, filtroCobertura, setFiltroCobertura, regiaoSelecionada, setRegiaoSelecionada } = useAppStore()

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 px-6 py-3 bg-ink-900 border-b border-ink-border-soft flex-wrap">
        <div>
          <h1 className="font-display text-[16px] text-mist-50 leading-none">Mapa territorial</h1>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {INDICADORES.map(ind => (
            <button
              key={ind.slug}
              onClick={() => setIndicadorAtivo(ind.slug)}
              className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors font-medium ${
                indicadorAtivo === ind.slug
                  ? 'bg-signal-500 text-ink-950 border-signal-500'
                  : 'border-ink-border text-mist-400 hover:border-signal-500/50 hover:text-mist-200'
              }`}
            >
              {ind.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {(['todas', 'critica', 'atencao', 'boa'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroCobertura(f)}
              className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors capitalize font-medium ${
                filtroCobertura === f
                  ? 'bg-ink-700 text-mist-50 border-ink-border'
                  : 'border-ink-border text-mist-500 hover:border-mist-600'
              }`}
            >
              {f === 'todas' ? 'Todas' : f === 'critica' ? 'Crítica' : f === 'atencao' ? 'Atenção' : 'Boa'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950">
              <p className="text-[13px] text-mist-500 font-mono">a carregar mapa…</p>
            </div>
          ) : (
            <MapView regioes={regioes} />
          )}
          <div className="absolute bottom-4 left-4 bg-ink-900/95 backdrop-blur rounded-xl border border-ink-border-soft p-3 text-[11px] space-y-1.5 shadow-lg z-[400]">
            <p className="font-mono uppercase tracking-wider text-mist-600 mb-2 text-[10px]">Cobertura de rede</p>
            {[
              { cor: 'var(--color-status-good)', label: 'Boa (>65%)' },
              { cor: 'var(--color-status-warn)', label: 'Atenção (35–65%)' },
              { cor: 'var(--color-status-bad)', label: 'Crítica (<35%)' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.cor }} />
                <span className="text-mist-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        {regiaoSelecionada && (
          <div className="relative">
            <button
              onClick={() => setRegiaoSelecionada(null)}
              className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-ink-850 border border-ink-border-soft text-mist-400 hover:text-mist-100 hover:border-ink-border text-base leading-none transition-colors"
            >
              ×
            </button>
            <RegionPanel regiao={regiaoSelecionada} todasRegioes={regioes} />
          </div>
        )}
      </div>
    </div>
  )
}
