import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { useAuthStore } from '../stores/authStore'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)

  // AuthGuard에서 전달한 원래 페이지 경로
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        // 에러 코드별 메시지 처리
        const errorMessage = getErrorMessage(data.error?.code, data.error?.message)
        setError(errorMessage)
        return
      }

      login(data.user)

      // 이전 페이지가 있으면 해당 페이지로, 없으면 역할에 따라 리다이렉트
      if (from) {
        navigate(from, { replace: true })
      } else if (data.user.role === 'teacher') {
        navigate('/dashboard', { replace: true })
      } else {
        navigate(`/class/${data.user.class_id}`, { replace: true })
      }
    } catch {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3] p-4">
      <div className="w-full max-w-[360px]">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#534AB7] rounded-2xl mx-auto mb-3 flex items-center justify-center">
            <span className="text-white text-2xl font-medium">C</span>
          </div>
          <h1 className="text-lg font-medium text-gray-900">수업 관리 시스템</h1>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">아이디</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              disabled={loading}
              className={username ? 'border-[#AFA9EC] bg-[#EEEDFE]' : ''}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">비밀번호</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              disabled={loading}
              className={password ? 'border-[#AFA9EC] bg-[#EEEDFE]' : ''}
            />
          </div>

          {error && (
            <div className="text-[13px] text-[#993C1D] bg-[#FAECE7] px-3 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
            disabled={!username || !password}
          >
            로그인
          </Button>
        </form>

        {/* 안내 문구 */}
        <p className="text-center text-[11px] text-gray-400 mt-6">
          교사 계정은 관리자에게 문의하세요
        </p>
      </div>
    </div>
  )
}

// 에러 코드별 사용자 친화적 메시지
function getErrorMessage(code?: string, defaultMessage?: string): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return '아이디 또는 비밀번호가 올바르지 않습니다.'
    case 'TOO_MANY_REQUESTS':
      return '로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.'
    case 'ACCOUNT_DISABLED':
      return '비활성화된 계정입니다. 관리자에게 문의하세요.'
    case 'VALIDATION_ERROR':
      return '아이디와 비밀번호를 모두 입력해주세요.'
    default:
      return defaultMessage || '로그인에 실패했습니다.'
  }
}
