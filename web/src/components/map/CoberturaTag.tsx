import type { CoberturaNivel } from '../../types'

const MAP: Record<CoberturaNivel, { label: string; bg: string; fg: string; dot: string }> = {
  boa:     { label: 'Boa cobertura', bg: 'var(--color-status-good-soft)', fg: 'var(--color-status-good)', dot: 'var(--color-status-good)' },
  atencao: { label: 'Atenção',       bg: 'var(--color-status-warn-soft)', fg: 'var(--color-status-warn)', dot: 'var(--color-status-warn)' },
  critica: { label: 'Crítica',       bg: 'var(--color-status-bad-soft)',  fg: 'var(--color-status-bad)',  dot: 'var(--color-status-bad)' },
}

export default function CoberturaTag({ nivel }: { nivel: CoberturaNivel }) {
  const { label, bg, fg, dot } = MAP[nivel]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
      style={{ background: bg, color: fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  )
}