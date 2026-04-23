import { useState, useCallback } from 'react'
import { ApiError } from '../lib/api'

interface UseApiRequestState<T> {
  data: T | null
  error: ApiError | null
  isLoading: boolean
}

interface UseApiRequestReturn<T, Args extends unknown[] = []> extends UseApiRequestState<T> {
  execute: (...args: Args) => Promise<T | null>
  reset: () => void
}

/**
 * API 요청 로딩 상태 관리 훅
 *
 * @example
 * const { data, error, isLoading, execute } = useApiRequest(
 *   (id: number) => apiGet(`/users/${id}`)
 * )
 *
 * // 사용
 * await execute(123)
 */
export function useApiRequest<T, Args extends unknown[] = []>(
  apiFunction: (...args: Args) => Promise<T>
): UseApiRequestReturn<T, Args> {
  const [state, setState] = useState<UseApiRequestState<T>>({
    data: null,
    error: null,
    isLoading: false,
  })

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const data = await apiFunction(...args)
        setState({ data, error: null, isLoading: false })
        return data
      } catch (err) {
        const error = err instanceof ApiError
          ? err
          : new ApiError('알 수 없는 오류', 'UNKNOWN_ERROR', 500)
        setState({ data: null, error, isLoading: false })
        return null
      }
    },
    [apiFunction]
  )

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}

/**
 * 뮤테이션용 훅 (POST, PUT, DELETE 등)
 * execute 호출 시에만 요청 실행
 */
export function useMutation<T, Args extends unknown[] = []>(
  apiFunction: (...args: Args) => Promise<T>
) {
  return useApiRequest<T, Args>(apiFunction)
}
