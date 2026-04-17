# 인증/보안 프론트엔드 스펙 (Auth & Security)

> 로그인, 인증 상태 관리, 토큰 자동 갱신의 프론트엔드 구현 스펙

## 인증 흐름 개요

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│  API 호출   │────▶│  자동 갱신  │
│   화면      │     │ (credentials)│     │ (인터셉터) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ authStore   │◀───│  httpOnly   │◀───│  /refresh   │
│ 상태 업데이트│     │  쿠키 자동   │     │  API 호출   │
└─────────────┘     │  관리       │     └─────────────┘
                    └─────────────┘
```

## 핵심 개념

| 항목 | 설명 |
|------|------|
| 토큰 저장 | httpOnly 쿠키 (JS 접근 불가) |
| 인증 확인 | `/api/v1/auth/me` API 호출 |
| 토큰 갱신 | 401 응답 시 `/api/v1/auth/refresh` 자동 호출 |
| 상태 관리 | Zustand `authStore` |

## 페이지 구조

### 1. 로그인 (Login.tsx)

```
경로: /login
권한: 비로그인 전용
```

**학생 모바일 뷰**:
```
┌─────────────────────────────────────────────────┐
│                                                 │
│              ┌─────────────────┐                │
│              │     로고        │                │
│              └─────────────────┘                │
│                 수업 관리 시스템                  │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│   아이디                                        │
│   ┌─────────────────────────────────────────┐   │
│   │ student01                               │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│   비밀번호                                      │
│   ┌─────────────────────────────────────────┐   │
│   │ ••••••••                                │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │             로그인                       │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│   (에러 메시지 영역)                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

**교사 데스크톱 뷰**:
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│           ┌─────────────────────────────────────┐             │
│           │                                     │             │
│           │              로고                   │             │
│           │         수업 관리 시스템             │             │
│           │                                     │             │
│           │   아이디                            │             │
│           │   ┌─────────────────────────────┐   │             │
│           │   │ teacher                     │   │             │
│           │   └─────────────────────────────┘   │             │
│           │                                     │             │
│           │   비밀번호                          │             │
│           │   ┌─────────────────────────────┐   │             │
│           │   │ ••••••••                    │   │             │
│           │   └─────────────────────────────┘   │             │
│           │                                     │             │
│           │   ┌─────────────────────────────┐   │             │
│           │   │         로그인              │   │             │
│           │   └─────────────────────────────┘   │             │
│           │                                     │             │
│           └─────────────────────────────────────┘             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## 상태 관리 (Zustand)

### authStore

```ts
// stores/authStore.ts
import { create } from 'zustand'

interface User {
  id: number
  name: string
  username: string
  role: 'teacher' | 'student'
  class_id: number | null
  team_id: number | null
}

interface AuthState {
  // 상태
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean       // 초기 인증 확인 중

  // 액션
  login: (user: User) => void
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: (user) => {
    set({ user, isAuthenticated: true, isLoading: false })
  },

  logout: async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // 네트워크 오류 무시
    }
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  checkAuth: async () => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      })

      if (res.ok) {
        const data = await res.json()
        set({ user: data.user, isAuthenticated: true, isLoading: false })
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  updateUser: (updates) => {
    const { user } = get()
    if (user) {
      set({ user: { ...user, ...updates } })
    }
  },
}))
```

## API 호출 (with 자동 토큰 갱신)

### api 유틸리티

```ts
// lib/api.ts

// 토큰 갱신 중복 방지
let refreshPromise: Promise<boolean> | null = null

async function refreshToken(): Promise<boolean> {
  // 이미 갱신 중이면 기존 Promise 반환
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })

      if (res.ok) {
        const data = await res.json()
        // authStore 업데이트
        useAuthStore.getState().login(data.user)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `/api/v1${path}`

  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  // 401 에러 시 토큰 갱신 시도
  if (res.status === 401) {
    const errorData = await res.json()

    // TOKEN_EXPIRED인 경우만 갱신 시도
    if (errorData.error?.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshToken()

      if (refreshed) {
        // 원래 요청 재시도
        const retryRes = await fetch(url, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          ...options,
        })

        if (retryRes.ok) {
          return retryRes.json()
        }

        // 재시도도 실패하면 로그아웃
        useAuthStore.getState().logout()
        throw new Error('세션이 만료되었습니다.')
      }

      // 갱신 실패 시 로그아웃
      useAuthStore.getState().logout()
      throw new Error('세션이 만료되었습니다.')
    }

    // 다른 401 에러는 그대로 throw
    throw new Error(errorData.error?.message || '인증 오류')
  }

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error?.message || '요청 실패')
  }

  return res.json()
}
```

## 컴포넌트 구현

### Login.tsx

```tsx
// pages/Login.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '../components/ui'
import { useAuthStore } from '../stores/authStore'

export function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

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
        setError(data.error?.message || '로그인에 실패했습니다.')
        return
      }

      login(data.user)

      // 역할에 따라 리다이렉트
      if (data.user.role === 'teacher') {
        navigate('/dashboard')
      } else {
        navigate(`/class/${data.user.class_id}`)
      }
    } catch (err) {
      setError('서버에 연결할 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-4">
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
            />
          </div>

          {error && (
            <div className="text-sm text-[#993C1D] bg-[#FAECE7] px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading || !username || !password}
          >
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

### AuthGuard (라우트 보호)

```tsx
// components/AuthGuard.tsx
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
      <div className="min-h-screen flex items-center justify-center">
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
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
```

### App.tsx (초기 인증 확인)

```tsx
// App.tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { AuthGuard } from './components/AuthGuard'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
// ... 기타 페이지

export function App() {
  const { checkAuth, isAuthenticated, isLoading, user } = useAuthStore()

  // 앱 시작 시 인증 상태 확인
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="animate-spin w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 페이지 */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={user?.role === 'teacher' ? '/dashboard' : `/class/${user?.class_id}`} replace />
            ) : (
              <Login />
            )
          }
        />

        {/* 교사 전용 */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard requireRole="teacher">
              <Dashboard />
            </AuthGuard>
          }
        />

        {/* 인증 필요 */}
        <Route
          path="/class/:classId/*"
          element={
            <AuthGuard>
              {/* 반 관련 라우트 */}
            </AuthGuard>
          }
        />

        {/* 기본 리다이렉트 */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to={user?.role === 'teacher' ? '/dashboard' : `/class/${user?.class_id}`} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
```

## Socket.IO 인증 연동

```ts
// lib/socket.ts
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/authStore'

let socket: Socket | null = null

export function initSocket() {
  // 이미 연결되어 있으면 재사용
  if (socket?.connected) return socket

  socket = io({
    path: '/socket.io',
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => {
    console.log('[socket] connected')
  })

  socket.on('connect_error', (err) => {
    if (err.message === 'UNAUTHORIZED' || err.message === 'TOKEN_EXPIRED') {
      // 토큰 만료 시 로그아웃
      useAuthStore.getState().logout()
    }
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket() {
  return socket
}
```

## 토큰 자동 갱신 타이밍

```ts
// hooks/useTokenRefresh.ts
import { useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'

// Access Token 만료 10분 전에 갱신
const REFRESH_BEFORE_EXPIRE = 10 * 60 * 1000  // 10분
const TOKEN_LIFETIME = 3 * 60 * 60 * 1000     // 3시간

export function useTokenRefresh() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const scheduleRefresh = () => {
      // 만료 10분 전에 갱신
      const refreshIn = TOKEN_LIFETIME - REFRESH_BEFORE_EXPIRE

      timerRef.current = window.setTimeout(async () => {
        try {
          const res = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          })

          if (res.ok) {
            const data = await res.json()
            useAuthStore.getState().login(data.user)
            scheduleRefresh()  // 다음 갱신 예약
          } else {
            useAuthStore.getState().logout()
          }
        } catch {
          // 네트워크 오류 시 재시도
          timerRef.current = window.setTimeout(scheduleRefresh, 60 * 1000)
        }
      }, refreshIn)
    }

    scheduleRefresh()

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [isAuthenticated])
}
```

## 에러 처리

### 인증 에러 코드

| 코드 | 설명 | UI 처리 |
|------|------|---------|
| `UNAUTHORIZED` | 토큰 없음 | 로그인 페이지로 이동 |
| `TOKEN_EXPIRED` | 토큰 만료 | 자동 갱신 시도 |
| `TOKEN_REVOKED` | 세션 무효화 | 로그인 페이지로 이동 |
| `INVALID_CREDENTIALS` | 잘못된 인증 정보 | 에러 메시지 표시 |
| `TOO_MANY_REQUESTS` | Rate Limit 초과 | 에러 메시지 표시 |

### 에러 메시지 표시

```tsx
// components/AuthError.tsx
import { toast } from './ui'

export function handleAuthError(code: string) {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      toast.error('아이디 또는 비밀번호가 올바르지 않습니다.')
      break
    case 'TOO_MANY_REQUESTS':
      toast.error('로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도하세요.')
      break
    case 'TOKEN_REVOKED':
      toast.error('세션이 만료되었습니다. 다시 로그인하세요.')
      break
    default:
      toast.error('인증 오류가 발생했습니다.')
  }
}
```

## UI 상태별 처리

### 로딩 상태

```tsx
// 초기 인증 확인 중
{isLoading && (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full" />
  </div>
)}
```

### 로그인 버튼 상태

```tsx
<Button
  disabled={loading || !username || !password}
  className={loading ? 'opacity-50 cursor-not-allowed' : ''}
>
  {loading ? '로그인 중...' : '로그인'}
</Button>
```

### 세션 만료 알림

```tsx
// 토큰 갱신 실패 시
toast.error('세션이 만료되었습니다. 다시 로그인해주세요.')
navigate('/login')
```

## 보안 체크리스트

- [ ] 토큰은 httpOnly 쿠키로 관리 (JS 접근 불가)
- [ ] `/api/v1/auth/me`로 인증 상태 확인
- [ ] 401 응답 시 자동 토큰 갱신
- [ ] 갱신 실패 시 로그아웃 처리
- [ ] Socket.IO 연결 에러 시 인증 상태 확인
- [ ] 민감한 데이터는 localStorage에 저장하지 않음
- [ ] 역할별 라우트 보호 (AuthGuard)
