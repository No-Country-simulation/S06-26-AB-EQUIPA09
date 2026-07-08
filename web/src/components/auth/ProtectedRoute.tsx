import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) 
{
  const { user } = useAuthStore()
  const isMock = import.meta.env.VITE_USE_MOCK === 'true'
  if (!isMock && !user) return <Navigate to="/login" replace />
  return <>{children}</>
}