import { useNavigate } from 'react-router-dom'
import { useRegioes } from '../hooks/useApi'
import AIQueryBar from '../components/query/AIQueryBar'
import CoberturaTag from '../components/map/CoberturaTag'
import CircularGauge from '../components/ui/CircularGauge'
import CoverageRadar from '../components/dashboard/CoverageRadar'
import { useAppStore } from '../store'
import type { Regiao } from '../types'

const INDICADORES = [
  { slug: 'cobertura-formacao-tech', label: 'Formações Tech' },
  { slug: 'taxa-emprego-formal', label: 'Emprego Formal' },
  { slug: 'densidade-iniciativas', label: 'Iniciativas Sociais' },
  { slug: 'cobertura-mentoria', label: 'Mentorias' },
  { slug: 'indice-saude-mental', label: 'Saúde Mental' },
]

function mediaNacional(regioes: Regiao[], slug: string) {
  if (!regioes.length) return 0
  const vals = regioes.map(r => r.indicadores.find(i => i.slug === slug)?.valor ?? 0)
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

function SignalBars({ pct }: { pct: number }) {
  const active = Math.round((pct / 100) * 5)
  return (
    <div className="flex items-end gap-[2px] h-3.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: `${i * 20}%`,
            background: i <= active ? (pct < 35 ? 'var(--color-status-bad)' : pct < 65 ? 'var(--color-status-warn)' : 'var(--color-status-good)') : 'var(--color-ink-border)',
          }}
        />
      ))}
    </div>
  )
}

function KpiCard({ eyebrow, value, accent }: { eyebrow: string; value: string; accent?: 'bad' | 'default' }) {
  return (
    <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5 relative overflow-hidden">
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20"
        style={{ background: accent === 'bad' ? 'var(--color-status-bad)' : 'var(--color-signal-500)' }}
      />
      <p className="text-[11px] font-mono uppercase tracking-wider text-mist-600 mb-2">{eyebrow}</p>
      <p
        className="font-display text-[32px] leading-none tracking-tight"
        style={{ color: accent === 'bad' ? 'var(--color-status-bad)' : 'var(--color-mist-50)' }}
      >
        {value}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const { data: regioes = [], isLoading } = useRegioes()
  const navigate = useNavigate()

  const criticas = regioes.filter(r => r.cobertura_nivel === 'critica').length
  const totalHab = regioes.reduce((a, r) => a + r.concentracao, 0)
  const mediaRede = regioes.length ? Math.round((regioes.reduce((a, r) => a + r.cobertura_rede, 0) / regioes.length) * 100) : 0

  return (
    <div className="p-7 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 mb-6">
        <div className="grid grid-cols-3 gap-3 content-start">
          <KpiCard eyebrow="Regiões analisadas" value={String(regioes.length)} />
          <KpiCard eyebrow="Cobertura crítica" value={String(criticas)} accent="bad" />
          <KpiCard eyebrow="População total" value={totalHab.toLocaleString('pt-BR')} />

          <div className="col-span-3 bg-ink-900 rounded-2xl border border-ink-border-soft p-5">
            <h2 className="text-[13px] font-medium text-mist-200 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-400" />
              Consulta rápida
            </h2>
            <AIQueryBar compact onResposta={() => navigate('/consulta')} />
          </div>

          <div className="col-span-3 grid grid-cols-5 gap-3">
            {isLoading
              ? INDICADORES.map(i => <div key={i.slug} className="bg-ink-900 border border-ink-border-soft rounded-2xl h-24 animate-pulse" />)
              : INDICADORES.map(ind => (
                <div key={ind.slug} className="bg-ink-900 rounded-2xl border border-ink-border-soft p-3 flex flex-col items-center text-center gap-2">
                  <CircularGauge value={mediaNacional(regioes, ind.slug)} size={48} stroke={4} />
                  <p className="text-[10.5px] text-mist-400 leading-tight">{ind.label}</p>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[13px] font-medium text-mist-200">Radar de cobertura</h2>
            <span className="font-mono text-[10px] text-mist-600 uppercase tracking-wider">média {mediaRede}%</span>
          </div>
          <p className="text-[11px] text-mist-600 mb-2">Cada ponto é uma região · proximidade ao centro = menor cobertura</p>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center min-h-[280px]">
              <span className="font-mono text-[11px] text-mist-600">a carregar radar…</span>
            </div>
          ) : (
            <div className="flex-1 flex items-center">
              <CoverageRadar regioes={regioes} />
            </div>
          )}
          <div className="flex items-center justify-center gap-4 mt-2 pt-3 border-t border-ink-border-soft">
            {[
              { c: 'var(--color-status-bad)', l: 'Crítica' },
              { c: 'var(--color-status-warn)', l: 'Atenção' },
              { c: 'var(--color-status-good)', l: 'Boa' },
            ].map(s => (
              <div key={s.l} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: s.c }} />
                <span className="text-[10.5px] text-mist-500">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-ink-900 rounded-2xl border border-ink-border-soft overflow-hidden">
        <div className="px-5 py-3.5 border-b border-ink-border-soft flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-mist-200">Regiões</h2>
          <button onClick={() => navigate('/mapa')} className="text-[12px] text-signal-400 hover:text-signal-500 transition-colors font-medium">
            Ver no mapa →
          </button>
        </div>
        <div className="divide-y divide-ink-border-soft">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-5 py-3 h-12 bg-ink-850 animate-pulse" />)
            : regioes.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-ink-850 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <SignalBars pct={r.cobertura_rede * 100} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-mist-100 truncate">{r.nome}</p>
                    <p className="text-[11px] text-mist-600 font-mono">{r.municipio} · {r.concentracao.toLocaleString('pt-BR')} hab</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-mono text-[12px] text-mist-500">{Math.round(r.cobertura_rede * 100)}%</span>
                  <CoberturaTag nivel={r.cobertura_nivel} />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}