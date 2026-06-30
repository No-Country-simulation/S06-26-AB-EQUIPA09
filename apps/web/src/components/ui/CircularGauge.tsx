interface Props {
  value: number
  max?: number
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
  colorClass?: string
}

function statusColor(pct: number) {
  if (pct < 30) return 'var(--color-status-bad)'
  if (pct < 60) return 'var(--color-status-warn)'
  return 'var(--color-status-good)'
}

export default function CircularGauge({ value, max = 100, size = 56, stroke = 5, label, sublabel }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const color = statusColor(pct)

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink-border-soft)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-mono font-semibold text-mist-50"
          style={{ fontSize: size * 0.27 }}
        >
          {Math.round(value)}
        </span>
      </div>
      {label && (
        <div className="min-w-0">
          <p className="text-[12px] text-mist-200 leading-tight truncate">{label}</p>
          {sublabel && <p className="text-[10px] text-mist-600 leading-tight mt-0.5">{sublabel}</p>}
        </div>
      )}
    </div>
  )
}