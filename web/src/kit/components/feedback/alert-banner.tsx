import type { ComponentType, ReactNode } from 'react'
import { ExclamationTriangleIcon, InformationCircleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

export type AlertTone = 'warning' | 'info' | 'success' | 'danger'

const TONE_CLS: Record<AlertTone, { wrap: string; icon: string; defaultIcon: ComponentType<{ className?: string }> }> = {
  warning: { wrap: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400', icon: 'text-amber-500', defaultIcon: ExclamationTriangleIcon },
  info:    { wrap: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400',       icon: 'text-blue-500',  defaultIcon: InformationCircleIcon },
  success: { wrap: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400', icon: 'text-emerald-500', defaultIcon: CheckCircleIcon },
  danger:  { wrap: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400',             icon: 'text-red-500',   defaultIcon: XCircleIcon },
}

interface AlertBannerProps {
  tone?: AlertTone
  children: ReactNode
  icon?: ComponentType<{ className?: string }>
}

/**
 * Banner inline p/ avisos (ex: "3 produtos com stock baixo"), erros de form, ou mensagens
 * de sucesso pós-ação. Substitui os `<p className="text-xs text-red-500 bg-red-50 ...">` soltos.
 */
export const AlertBanner = ({ tone = 'info', children, icon }: AlertBannerProps) => {
  const styles = TONE_CLS[tone]
  const Icon = icon ?? styles.defaultIcon
  return (
    <div className={`flex items-center gap-2 px-4 py-3 border rounded-xl text-sm ${styles.wrap}`}>
      <Icon className={`w-4 h-4 shrink-0 ${styles.icon}`} />
      <div>{children}</div>
    </div>
  )
}
