import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store'
import { api, useLogout } from '../hooks/useAuth'

export default function Profile() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const logout = useLogout()
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function handlePasswordChange() {
    setMessage(null)

    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setMessage({ text: 'Preencha todos os campos de password.', ok: false })
      return
    }

    if (passwords.next !== passwords.confirm) {
      setMessage({ text: 'A confirmação não corresponde à nova password.', ok: false })
      return
    }

    setSaving(true)
    try {
      await api.patch('/users/me', {
        password: {
          current: passwords.current,
          new: passwords.next,
        },
      })
      setPasswords({ current: '', next: '', confirm: '' })
      setMessage({ text: 'Password actualizada com sucesso.', ok: true })
    } catch (err: any) {
      const text = err?.response?.data?.message
        ?? err?.response?.data?.error
        ?? 'Não foi possível alterar a password.'
      setMessage({ text, ok: false })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await logout.mutateAsync()
    navigate('/login')
  }

  return (
    <div className="p-7 max-w-3xl mx-auto">
      <header className="mb-6">
        <div className="h-1 w-12 rounded-full bg-status-bad mb-3" />
        <h1 className="font-display text-[26px] font-bold text-mist-50 tracking-tight">
          Perfil
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-wider text-mist-600 mt-1">
          Conta e segurança
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <section className="bg-ink-900 rounded-2xl border border-ink-border-soft p-6">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-border-soft">
            <div className="w-12 h-12 rounded-xl bg-signal-500 flex items-center justify-center text-[18px] font-display font-bold text-ink-950 shrink-0">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-mist-100 truncate">
                {user?.name ?? 'Utilizador'}
              </p>
              <p className="text-[12px] font-mono text-mist-600 truncate">
                {user?.email ?? 'Sem email'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
                Nome
              </label>
              <div className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50">
                {user?.name ?? '—'}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
                Email
              </label>
              <div className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50">
                {user?.email ?? '—'}
              </div>
            </div>
          </div>
        </section>

        <aside className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5 h-fit">
          <p className="text-[11px] font-mono uppercase tracking-wider text-mist-600 mb-3">
            Sessão
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="w-full rounded-lg border border-status-bad/40 bg-status-bad-soft hover:bg-status-bad/20 transition-colors py-2.5 text-[13px] text-status-bad disabled:opacity-60"
          >
            {logout.isPending ? 'A sair…' : 'Terminar sessão'}
          </button>
        </aside>
      </div>

      <section className="mt-5 bg-ink-900 rounded-2xl border border-ink-border-soft p-6">
        <div className="mb-5">
          <h2 className="text-[16px] font-medium text-mist-100">Segurança</h2>
          <p className="text-[12px] text-mist-600 mt-1">Alteração de password da conta autenticada.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
              Password actual
            </label>
            <input
              type="password"
              value={passwords.current}
              onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
              Nova password
            </label>
            <input
              type="password"
              value={passwords.next}
              onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
              Confirmar nova password
            </label>
            <input
              type="password"
              value={passwords.confirm}
              onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handlePasswordChange()}
              className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500 transition-colors"
            />
          </div>
        </div>

        {message && (
          <div className={`mt-4 px-3.5 py-2.5 rounded-lg border ${
            message.ok
              ? 'bg-status-good-soft border-status-good/40'
              : 'bg-status-bad-soft border-status-bad/40'
          }`}>
            <p className={`text-[13px] m-0 ${message.ok ? 'text-status-good' : 'text-status-bad'}`}>
              {message.text}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handlePasswordChange}
          disabled={saving}
          className="mt-5 rounded-lg bg-signal-500 text-ink-950 hover:bg-signal-400 disabled:bg-ink-border disabled:text-mist-600 transition-colors px-4 py-2.5 text-[13px] font-medium"
        >
          {saving ? 'A guardar…' : 'Alterar password'}
        </button>
      </section>
    </div>
  )
}
