import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin, useRegister } from '../hooks/useAuth'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const login = useLogin()
  const register = useRegister()

  const mutation = mode === 'login' ? login : register

  async function handleSubmit() {
    setError('')
    try {
      if (mode === 'login') {
        await login.mutateAsync({ email: form.email, password: form.password })
      } else {
        await register.mutateAsync({ name: form.name, email: form.email, password: form.password })
      }
      navigate('/app')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erro ao autenticar. Tente novamente.'
      setError(msg)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950">
      <div className="w-full max-w-[400px] px-5">

        <div className="text-center mb-9 animate-fade-up">
          <div className="w-11 h-11 rounded-xl bg-signal-500 flex items-center justify-center text-[20px] font-display font-bold text-ink-950 mx-auto mb-4 shadow-[0_0_24px_var(--color-signal-glow)]">
            S
          </div>
          <h1 className="font-display text-[22px] font-bold text-mist-50 tracking-tight">
            SQLens
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-wider text-mist-600 mt-1.5">
            Painel de Dados Públicos · Luanda
          </p>
        </div>

        <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-7 animate-fade-up">
          <div className="flex gap-1 bg-ink-850 rounded-lg p-[3px] mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-[7px] rounded-md text-[13px] font-sans transition-colors ${
                  mode === m
                    ? 'bg-ink-700 text-mist-50 font-medium'
                    : 'text-mist-600 hover:text-mist-400'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Registar'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3.5">
            {mode === 'register' && (
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: João Silva"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 placeholder:text-mist-600 outline-none focus:border-signal-500 transition-colors"
                />
              </div>
            )}
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-mist-600 block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="gestor@governo.ao"
                className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 placeholder:text-mist-600 outline-none focus:border-signal-500 transition-colors"
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
                className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 placeholder:text-mist-600 outline-none focus:border-signal-500 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3.5 px-3.5 py-2.5 rounded-lg bg-status-bad-soft border border-[color:var(--color-status-bad)]/30">
              <p className="text-[13px] text-[color:var(--color-status-bad)] m-0">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className={`w-full mt-5 py-2.5 rounded-lg text-[14px] font-medium tracking-tight transition-colors ${
              mutation.isPending
                ? 'bg-ink-border text-mist-600 cursor-not-allowed'
                : 'bg-signal-500 text-ink-950 hover:bg-signal-400 cursor-pointer'
            }`}
          >
            {mutation.isPending
              ? (mode === 'login' ? 'A entrar…' : 'A registar…')
              : (mode === 'login' ? 'Entrar' : 'Criar conta')}
          </button>
        </div>
        <div className="text-center mt-4">
          
            <a href="/staff/login"
            className="font-mono text-[10.5px] text-mist-600 hover:text-mist-400 transition-colors">
            Acesso staff →
          </a>
        </div>

        <p className="text-center font-mono text-[10.5px] text-mist-600 mt-5">
          App BiT · Desafio B2G · Angola 2025
        </p>
      </div>
    </div>
  )
}
