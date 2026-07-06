import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { useLogout } from '../../hooks/useAuth'

const NAV = [
  { to: '/', label: 'Visão Geral', icon: '▦', end: true },
  { to: '/mapa', label: 'Mapa de Cobertura', icon: '◎', end: false },
  { to: '/consulta', label: 'Consulta IA', icon: '✦', end: false },
  { to: '/perfil', label: 'Meu Perfil', icon: '◉', end: false },
]

export default function Layout() {
  const { user } = useAuthStore()
  const logout = useLogout()
  const navigate = useNavigate()
  const isMock = import.meta.env.VITE_USE_MOCK === 'true'

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <aside style={{
        width: '220px', flexShrink: 0, background: 'var(--bg-sidebar)',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              width: '28px', height: '28px', background: 'var(--ao-red)',
              borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', color: '#fff', fontWeight: 700, flexShrink: 0,
            }}>S</div>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-on-dark)', letterSpacing: '-0.01em' }}>
              SQLens
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted-dark)', lineHeight: 1.4, paddingLeft: '38px' }}>
            Painel de Dados Públicos
          </p>
        </div>

        <div style={{ padding: '12px 10px', flex: 1 }}>
          <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted-dark)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 10px 6px' }}>
            Módulos
          </p>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 10px', borderRadius: '8px', marginBottom: '2px',
              fontSize: '13px', fontWeight: isActive ? 500 : 400, textDecoration: 'none',
              color: isActive ? '#fff' : 'var(--text-muted-dark)',
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition: 'all 0.15s',
            })}>
              <span style={{ fontSize: '15px', lineHeight: 1, opacity: 0.9 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-ink-border-soft">
  <div className="rounded-xl bg-ink-850 border border-ink-border-soft p-3">

    <div className="flex items-center gap-2 mb-3">
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex w-full h-full rounded-full bg-status-good signal-ping" />
        <span className="relative inline-flex w-2 h-2 rounded-full bg-status-good" />
      </span>

      <span className="text-[11px] text-mist-300 truncate">
        {user?.name ?? user?.email}
      </span>
    </div>

    <button
      onClick={handleLogout}
      disabled={logout.isPending}
      className="w-full rounded-lg border border-ink-border bg-ink-800 hover:bg-ink-700 transition-colors py-2 text-[12px] text-mist-300 mb-3"
    >
      {logout.isPending ? 'A sair…' : 'Terminar sessão'}
    </button>

    <p className="text-[10px] font-mono uppercase tracking-wider text-mist-600 mb-1">
      App BiT · Desafio B2G
    </p>

    <p className="text-[11px] text-mist-400 leading-relaxed">
      Fonte de dados: Vísent CDRView
    </p>

  </div>
</div>
      </aside>

      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  )
}
