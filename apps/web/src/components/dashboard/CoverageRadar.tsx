import { useNavigate } from 'react-router-dom'
import type { Regiao } from '../../types'
import { useAppStore } from '../../store'

const SIZE = 420
const CENTER = SIZE / 2
const MAX_R = 168
const GOLDEN_ANGLE = 137.508

function nivelColor(n: Regiao['cobertura_nivel']) {
  return n === 'boa' ? 'var(--color-status-good)' : n === 'atencao' ? 'var(--color-status-warn)' : 'var(--color-status-bad)'
}

function blipRadius(concentracao: number) {
  return Math.max(4, Math.min(13, 3 + Math.sqrt(concentracao) / 220))
}

export default function CoverageRadar({ regioes }: { regioes: Regiao[] }) {
  const { setRegiaoSelecionada } = useAppStore()
  const navigate = useNavigate()

  function go(r: Regiao) {
    setRegiaoSelecionada(r)
    navigate('/mapa')
  }

  const pontos = regioes.map((r, i) => {
    const radius = Math.max(0.06, r.cobertura_rede) * MAX_R
    const angle = (i * GOLDEN_ANGLE * Math.PI) / 180
    const x = CENTER + radius * Math.cos(angle)
    const y = CENTER + radius * Math.sin(angle)
    return { r, x, y, radius: blipRadius(r.concentracao) }
  })

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-auto max-w-[420px] mx-auto block">
        <defs>
          <radialGradient id="radarFade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-status-bad)" stopOpacity="0.16" />
            <stop offset="38%" stopColor="var(--color-status-warn)" stopOpacity="0.10" />
            <stop offset="68%" stopColor="var(--color-status-good)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--color-status-good)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-signal-400)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-signal-400)" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={MAX_R} fill="url(#radarFade)" />

        {[0.34, 0.65, 1].map(f => (
          <circle
            key={f}
            cx={CENTER}
            cy={CENTER}
            r={MAX_R * f}
            fill="none"
            stroke="var(--color-ink-border)"
            strokeWidth={1}
            strokeDasharray={f === 1 ? undefined : '2 5'}
          />
        ))}
        <line x1={CENTER - MAX_R} y1={CENTER} x2={CENTER + MAX_R} y2={CENTER} stroke="var(--color-ink-border-soft)" strokeWidth={1} />
        <line x1={CENTER} y1={CENTER - MAX_R} x2={CENTER} y2={CENTER + MAX_R} stroke="var(--color-ink-border-soft)" strokeWidth={1} />

        {/* radar sweep */}
        <g className="radar-sweep" style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
          <path
            d={`M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - MAX_R} A ${MAX_R} ${MAX_R} 0 0 1 ${CENTER + MAX_R * Math.sin(0.5)} ${CENTER - MAX_R * Math.cos(0.5)} Z`}
            fill="url(#sweepGrad)"
          />
        </g>

        <circle cx={CENTER} cy={CENTER} r={3} fill="var(--color-signal-400)" />

        {pontos.map(({ r, x, y, radius }) => (
          <g key={r.id} className="cursor-pointer group" onClick={() => go(r)}>
            <circle cx={x} cy={y} r={radius + 6} fill={nivelColor(r.cobertura_nivel)} opacity={0} className="group-hover:opacity-10 transition-opacity" />
            <circle cx={x} cy={y} r={radius} fill={nivelColor(r.cobertura_nivel)} fillOpacity={0.85} stroke="var(--color-ink-950)" strokeWidth={1.5} />
            <circle cx={x} cy={y} r={radius + 3} fill="none" stroke={nivelColor(r.cobertura_nivel)} strokeWidth={1} opacity={0.45} className="group-hover:opacity-90 transition-opacity" />
            <title>{`${r.nome} · cobertura ${Math.round(r.cobertura_rede * 100)}% · ${r.concentracao.toLocaleString('pt-BR')} hab`}</title>
          </g>
        ))}
      </svg>

      <div className="absolute top-2 left-2 font-mono text-[9px] tracking-wider text-mist-600 uppercase">centro · sem rede</div>
      <div className="absolute bottom-2 right-2 font-mono text-[9px] tracking-wider text-mist-600 uppercase">borda · cobertura plena</div>
    </div>
  )
}