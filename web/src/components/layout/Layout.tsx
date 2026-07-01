import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useRegioes } from '../../hooks/useApi'
import { useAppStore } from '../../store'
import { calcularPrioridades } from '../../lib/indicadores'

const NAV = [
  { to: '/', label: 'Painel', icon: DashIcon, end: true, eyebrow: '01' },
  { to: '/mapa', label: 'Mapa', icon: MapIcon, end: false, eyebrow: '02' },
  { to: '/consulta', label: 'Consulta IA', icon: SparkIcon, end: false, eyebrow: '03' },
]

const TITLES: Record<string, { title: string; desc: string }> = {
  '/': { title: 'Radar de cobertura', desc: 'Visão geral das lacunas de inclusão digital' },
  '/mapa': { title: 'Mapa territorial', desc: 'Distribuição geográfica por nível de cobertura' },
  '/consulta': { title: 'Consulta com IA', desc: 'Pergunte em linguagem natural sobre os dados' },
}

function DashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none">
      <rect x="2.5" y="2.5" width="6" height="8" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11.5" y="2.5" width="6" height="5" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11.5" y="10.5" width="6" height="7" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="13.5" width="6" height="4" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
function MapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none">
      <circle cx="10" cy="8.2" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 17c3.5-3.8 6-6.8 6-9.6A6 6 0 0 0 4 7.4C4 10.2 6.5 13.2 10 17Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none">
      <path d="M10 2.5c.4 2.8 1.1 4.5 2.2 5.6 1.1 1.1 2.8 1.8 5.6 2.2-2.8.4-4.5 1.1-5.6 2.2-1.1 1.1-1.8 2.8-2.2 5.6-.4-2.8-1.1-4.5-2.2-5.6-1.1-1.1-2.8-1.8-5.6-2.2 2.8-.4 4.5-1.1 5.6-2.2 1.1-1.1 1.8-2.8 2.2-5.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const meta = TITLES[pathname] ?? TITLES['/']
  const isMapa = pathname === '/mapa'

  const { data: regioes = [] } = useRegioes()
  const { setRegiaoSelecionada } = useAppStore()
  const navigate = useNavigate()

  const totalCriticas = regioes.filter(r => r.cobertura_nivel === 'critica').length
  const mediaRede = regioes.length ? Math.round((regioes.reduce((a, r) => a + r.cobertura_rede, 0) / regioes.length) * 100) : 0
  const ranking = calcularPrioridades(regioes)
  const topPrioridade = ranking[0] ?? null

  function investigar() {
    if (!topPrioridade) return
    setRegiaoSelecionada(topPrioridade.regiao)
    navigate('/mapa')
  }

  return (
    <div className="min-h-screen flex bg-ink-950">
      <aside className="w-60 shrink-0 border-r border-ink-border-soft bg-ink-900 flex flex-col">
        <div className="px-5 py-5 border-b border-ink-border-soft flex items-center gap-2.5">
          <div className="relative w-8 h-8 shrink-0 rounded-lg bg-ink-800 border border-ink-border flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-signal-400" />
            <span className="absolute w-2 h-2 rounded-full bg-signal-400 signal-ping" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[17px] text-mist-50 leading-none tracking-tight">SQLens</p>
            <p className="text-[10px] text-mist-600 mt-1 leading-none font-mono uppercase tracking-wider">Dados Públicos</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                  isActive ? 'bg-ink-800 text-mist-50' : 'text-mist-400 hover:bg-ink-850 hover:text-mist-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full transition-all ${
                      isActive ? 'h-5 bg-signal-400' : 'h-0 bg-signal-400'
                    }`}
                  />
                  <n.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-signal-400' : 'text-mist-600 group-hover:text-mist-300'}`} />
                  <span className="flex-1 font-medium">{n.label}</span>
                  <span className="font-mono text-[10px] text-mist-600">{n.eyebrow}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-3">
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-lg bg-ink-850 border border-ink-border-soft py-2 text-center">
              <p className="font-mono text-[14px] font-semibold text-mist-50 leading-none">{regioes.length}</p>
              <p className="font-mono text-[8.5px] uppercase tracking-wider text-mist-600 mt-1">Regiões</p>
            </div>
            <div className="rounded-lg bg-ink-850 border border-ink-border-soft py-2 text-center">
              <p className="font-mono text-[14px] font-semibold leading-none" style={{ color: 'var(--color-status-bad)' }}>{totalCriticas}</p>
              <p className="font-mono text-[8.5px] uppercase tracking-wider text-mist-600 mt-1">Críticas</p>
            </div>
            <div className="rounded-lg bg-ink-850 border border-ink-border-soft py-2 text-center">
              <p className="font-mono text-[14px] font-semibold text-mist-50 leading-none">{mediaRede}%</p>
              <p className="font-mono text-[8.5px] uppercase tracking-wider text-mist-600 mt-1">Rede média</p>
            </div>
          </div>
        </div>

        {topPrioridade && (
          <div className="px-3 pb-3">
            <button
              onClick={investigar}
              className="w-full text-left rounded-xl border border-ink-border-soft bg-ink-850 hover:border-status-bad/40 transition-colors p-3 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider" style={{ color: 'var(--color-status-bad)' }}>
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full signal-ping" style={{ background: 'var(--color-status-bad)' }} />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-status-bad)' }} />
                  </span>
                  Prioridade nº1
                </span>
                <span className="font-mono text-[10px] text-mist-600">índice {topPrioridade.indice}</span>
              </div>
              <p className="text-[13px] font-medium text-mist-100 leading-tight">{topPrioridade.regiao.nome}</p>
              <p className="text-[11px] text-mist-500 mt-0.5">{topPrioridade.motivo}</p>
              <span className="inline-flex items-center gap-1 mt-2 text-[11px] text-signal-400 group-hover:text-signal-300 font-medium">
                Investigar região →
              </span>
            </button>
          </div>
        )}

        <div className="p-4 border-t border-ink-border-soft">
          <div className="rounded-xl bg-ink-850 border border-ink-border-soft p-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-mist-600 mb-1">App BiT · Desafio B2G</p>
            <p className="text-[11px] text-mist-400 leading-relaxed">Fonte de dados: Vísent CDRView</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {!isMapa && (
          <header className="px-7 py-4 border-b border-ink-border-soft bg-ink-950/80 backdrop-blur flex items-center justify-between">
            <div>
              <h1 className="font-display text-[20px] text-mist-50 tracking-tight">{meta.title}</h1>
              <p className="text-[12px] text-mist-500 mt-0.5">{meta.desc}</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-ink-border-soft bg-ink-900">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-signal-400 signal-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-signal-400" />
              </span>
              <span className="font-mono text-[10px] text-mist-400 uppercase tracking-wider">Dados sincronizados</span>
            </div>
          </header>
        )}
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
