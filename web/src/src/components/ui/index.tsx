import type { ReactNode, CSSProperties } from 'react'

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: '12px',
      border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: 'red' | 'gold' | 'green'
}) {
  const colors = {
    red: 'var(--ao-red)',
    gold: 'var(--ao-gold)',
    green: '#16a34a',
    undefined: 'var(--ao-black)',
  }
  const color = colors[accent as keyof typeof colors] ?? 'var(--ao-black)'
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: '12px',
      border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)',
      padding: '20px 22px',
    }}>
      <p style={{ fontSize: '11px', fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        {label}
      </p>
      <p style={{ fontSize: '28px', fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>{sub}</p>}
    </div>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ao-black)', letterSpacing: '-0.01em' }}>{title}</h2>
      {action}
    </div>
  )
}

export function CoberturaBadge({ nivel }: { nivel: 'boa' | 'atencao' | 'critica' }) {
  const map = {
    boa:     { label: 'Boa cobertura',  bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
    atencao: { label: 'Atenção',        bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
    critica: { label: 'Crítica',        bg: '#fff0f0', color: 'var(--ao-red-deep)', dot: 'var(--ao-red)' },
  }
  const { label, bg, color, dot } = map[nivel]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '11px', fontWeight: 500, padding: '3px 9px', borderRadius: '20px',
      background: bg, color,
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
      {label}
    </span>
  )
}

export function MiniBar({ valor, max = 100 }: { valor: number; max?: number }) {
  const pct = Math.min(100, (valor / max) * 100)
  const color = pct < 30 ? 'var(--ao-red)' : pct < 60 ? 'var(--ao-gold)' : '#16a34a'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '4px', background: '#f0efec', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '12px', color: '#666', fontWeight: 500, minWidth: '28px', textAlign: 'right' }}>{valor}</span>
    </div>
  )
}
