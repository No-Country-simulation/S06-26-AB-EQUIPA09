import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store'

export default function ProtectedRoute({
    children,
}: {
    children: React.ReactNode
}) {
    const { accessToken } = useAuthStore()

    if (!accessToken) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}