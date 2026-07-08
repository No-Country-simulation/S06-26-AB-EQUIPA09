import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStaffLogin } from '../../hooks/useStaffApi'

export default function StaffLogin() {
  const navigate = useNavigate()
  const login = useStaffLogin()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    try {
      await login.mutateAsync(form)
      navigate('/staff/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.message
        ?? err?.response?.data?.error
        ?? err?.response?.data?.value?.message
        ?? 'Credenciais inválidas ou sessão indisponível.'
      setError(msg)
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 grid grid-cols-1 lg:grid-cols-[420px_1fr]">
      <aside className="bg-ink-900 border-r border-ink-border-soft p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-xl bg-status-bad flex items-center justify-center text-[20px] font-display font-bold text-white">
              S
            </div>
            <div>
              <h1 className="font-display text-[24px] font-bold text-mist-50 tracking-tight">SQLens</h1>
              <p className="font-mono text-[11px] uppercase tracking-wider text-mist-600">Painel administrativo</p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full border border-status-bad/40 bg-status-bad-soft px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-status-bad">
            Área Restrita — Staff
          </span>
        </div>

        <div>
          <p className="text-[13px] text-mist-400 leading-relaxed max-w-[280px]">
            Acesso reservado para operações, ingestão de dados e gestão dos indicadores públicos.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-7">
            <p className="font-mono text-[11px] uppercase tracking-wider text-status-bad mb-2">Staff Login</p>
            <h2 className="font-display text-[28px] text-mist-50 tracking-tight">Entrar na área restrita</h2>
          </div>

          <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-7">
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@sqlens.ao"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 placeholder:text-mist-600 outline-none focus:border-status-bad transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 placeholder:text-mist-600 outline-none focus:border-status-bad transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="mt-3.5 px-3.5 py-2.5 rounded-lg bg-status-bad-soft border border-status-bad/30">
                <p className="text-[13px] text-status-bad m-0">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={login.isPending}
              className="w-full mt-5 py-2.5 rounded-lg text-[14px] font-medium tracking-tight transition-colors bg-status-bad text-white hover:bg-status-bad/90 disabled:bg-ink-border disabled:text-mist-600"
            >
              {login.isPending ? 'A entrar…' : 'Entrar'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
