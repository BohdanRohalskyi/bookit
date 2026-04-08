import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@bookit/shared/stores'

interface RequireAuthProps {
  children: React.ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    // Redirect to homepage
    return <Navigate to="/" state={{ from: location }} replace />
  }

  return <>{children}</>
}
