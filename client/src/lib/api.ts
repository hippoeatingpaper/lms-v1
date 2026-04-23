import { useAuthStore } from '../stores/authStore'

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

export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
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
        throw new ApiError('세션이 만료되었습니다.', 'SESSION_EXPIRED', 401)
      }

      // 갱신 실패 시 로그아웃
      useAuthStore.getState().logout()
      throw new ApiError('세션이 만료되었습니다.', 'SESSION_EXPIRED', 401)
    }

    // 다른 401 에러는 그대로 throw
    throw new ApiError(
      errorData.error?.message || '인증 오류',
      errorData.error?.code || 'UNAUTHORIZED',
      401
    )
  }

  if (!res.ok) {
    const errorData = await res.json()
    throw new ApiError(
      errorData.error?.message || '요청 실패',
      errorData.error?.code || 'UNKNOWN_ERROR',
      res.status
    )
  }

  return res.json()
}

// 편의 메서드들
export const apiGet = <T>(path: string) => api<T>(path)

export const apiPost = <T>(path: string, data?: unknown) =>
  api<T>(path, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })

export const apiPatch = <T>(path: string, data: unknown) =>
  api<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

export const apiPut = <T>(path: string, data: unknown) =>
  api<T>(path, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: 'DELETE' })
