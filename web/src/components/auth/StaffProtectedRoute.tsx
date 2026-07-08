import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useStaffMe } from '../../hooks/useStaffApi'

export default function StaffProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isError } = useStaffMe()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="w-9 h-9 rounded-full border-2 border-ink-border border-t-signal-500 animate-spin" />
      </div>
    )
  }

  if (isError) {
    return <Navigate to="/staff/login" replace />
  }

  return children
}
