import { NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useStaffLogout, useStaffMe } from '../../hooks/useStaffApi'

const NAV = [
  { to: '/staff/dashboard', label: 'Dashboard Staff', icon: '▦' },
  { to: '/staff/ingestao', label: 'Ingestão de Dados', icon: '↑' },
  { to: '/staff/indicadores', label: 'Indicadores', icon: '◉' },
  { to: '/staff/programas', label: 'Programas', icon: '☰' },
  { to: '/staff/dashboard', label: 'Membros', icon: '👤' },
  { to: '/staff/dashboard', label: 'Logs de Atividade', icon: '📋' },
]

export default function StaffShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const logout = useStaffLogout()
  const { data: staff } = useStaffMe()

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/staff/login')
  }

  return (
    <div className="min-h-screen bg-ink-950 flex">
      <aside className="w-[240px] shrink-0 bg-ink-900 border-r border-ink-border-soft sticky top-0 h-screen flex flex-col">
        <div className="px-5 pt-7 pb-5 border-b border-ink-border-soft">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-status-bad text-white flex items-center justify-center text-[14px] font-bold">
              S
            </div>
            <div>
              <p className="text-[15px] font-semibold text-mist-50 leading-tight">SQLens</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-status-bad">Staff</p>
            </div>
          </div>
          <p className="text-[11px] text-mist-600 leading-relaxed">Área administrativa restrita</p>
        </div>

        <nav className="flex-1 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-mist-600 px-2 py-2">Administração</p>
          {NAV.map(item => (
            <NavLink
              key={`${item.label}-${item.to}`}
              to={item.to}
              end
              className={({ isActive }) => [
                'flex items-center gap-2.5 rounded-lg px-3 py-2 mb-1 text-[13px] transition-colors',
                isActive ? 'bg-ink-800 text-mist-50' : 'text-mist-400 hover:bg-ink-850 hover:text-mist-200',
              ].join(' ')}
            >
              <span className="w-5 text-center text-[14px]">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-ink-border-soft">
          <div className="rounded-xl bg-ink-850 border border-ink-border-soft p-3">
            <p className="text-[11px] text-mist-300 truncate mb-1">{staff?.name ?? 'Staff'}</p>
            <p className="text-[10.5px] text-mist-600 truncate mb-3">{staff?.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logout.isPending}
              className="w-full rounded-lg border border-ink-border bg-ink-800 hover:bg-ink-700 transition-colors py-2 text-[12px] text-mist-300 disabled:opacity-60"
            >
              {logout.isPending ? 'A sair…' : 'Terminar sessão'}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="border-b border-ink-border-soft bg-ink-950/95 sticky top-0 z-10">
          <div className="px-7 py-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-status-bad mb-1">Área Restrita</p>
            <h1 className="font-display text-[24px] text-mist-50 tracking-tight">{title}</h1>
          </div>
        </div>
        <div className="p-7 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
