import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

interface AuthGuardProps {
  children: React.ReactNode
  requireRole?: 'teacher' | 'student'
}

export function AuthGuard({ children, requireRole }: AuthGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const location = useLocation()

  // 초기 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
        <div className="animate-spin w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full" />
      </div>
    )
  }

  // 미인증
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 역할 검증
  if (requireRole && user?.role !== requireRole) {
    // 잘못된 역할이면 적절한 페이지로 리다이렉트
    if (user?.role === 'teacher') {
      return <Navigate to="/dashboard" replace />
    } else {
      return <Navigate to={`/class/${user?.class_id}`} replace />
    }
  }

  return <>{children}</>
}

// 비로그인 전용 가드 (로그인 페이지용)
interface GuestGuardProps {
  children: React.ReactNode
}

export function GuestGuard({ children }: GuestGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
        <div className="animate-spin w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full" />
      </div>
    )
  }

  // 이미 로그인된 경우 리다이렉트
  if (isAuthenticated) {
    if (user?.role === 'teacher') {
      return <Navigate to="/dashboard" replace />
    } else {
      return <Navigate to={`/class/${user?.class_id}`} replace />
    }
  }

  return <>{children}</>
}
