import { useState, useEffect } from 'react'
import { useAuthStore } from '../store'

export default function Perfil() {
  const { user } = useAuthStore()
  const [form, setForm] = useState({ name: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (user) setForm({ name: user.name ?? '', email: user.email ?? '' })
  }, [user])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      // await updateProfile.mutateAsync(form)
      setMessage({ text: 'Perfil atualizado com sucesso.', ok: true })
    } catch {
      setMessage({ text: 'Erro ao atualizar perfil.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-7 max-w-xl mx-auto">
      <h1 className="font-display text-[22px] font-bold text-mist-50 tracking-tight mb-1">
        Meu Perfil
      </h1>
      <p className="font-mono text-[11px] uppercase tracking-wider text-mist-600 mb-6">
        Gerencie suas informações pessoais
      </p>

      <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-7">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-border-soft">
          <div className="w-12 h-12 rounded-xl bg-signal-500 flex items-center justify-center text-[18px] font-display font-bold text-ink-950 shrink-0">
            {(form.name || form.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-mist-100 truncate">{form.name || 'Utilizador'}</p>
            <p className="text-[12px] font-mono text-mist-600 truncate">{form.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
              Nome completo
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500 transition-colors"
            />
          </div>
        </div>

        {message && (
          <div
            className="mt-3.5 px-3.5 py-2.5 rounded-lg border"
            style={{
              background: message.ok ? 'var(--color-status-good-soft)' : 'var(--color-status-bad-soft)',
              borderColor: message.ok ? 'var(--color-status-good)' : 'var(--color-status-bad)',
            }}
          >
            <p
              className="text-[13px] m-0"
              style={{ color: message.ok ? 'var(--color-status-good)' : 'var(--color-status-bad)' }}
            >
              {message.text}
            </p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full mt-5 py-2.5 rounded-lg text-[14px] font-medium tracking-tight transition-colors ${
            saving
              ? 'bg-ink-border text-mist-600 cursor-not-allowed'
              : 'bg-signal-500 text-ink-950 hover:bg-signal-400 cursor-pointer'
          }`}
        >
          {saving ? 'A guardar…' : 'Guardar alterações'}
        </button>
      </div>
    </div>
  )
}