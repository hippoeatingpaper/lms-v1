import { useEffect } from 'react'
import { useConnectionStore } from '../stores/connectionStore'

/**
 * 온라인/오프라인 상태 훅
 * 컴포넌트에서 네트워크 상태를 쉽게 사용
 *
 * @example
 * const { isOnline, socketConnected } = useOnlineStatus()
 *
 * if (!isOnline) {
 *   return <OfflineBanner />
 * }
 */
export function useOnlineStatus() {
  const isOnline = useConnectionStore((state) => state.isOnline)
  const socketConnected = useConnectionStore((state) => state.socketConnected)
  const needsResync = useConnectionStore((state) => state.needsResync)
  const setNeedsResync = useConnectionStore((state) => state.setNeedsResync)

  // needsResync 플래그 자동 처리 (필요시)
  useEffect(() => {
    if (needsResync && socketConnected) {
      // 재동기화 로직은 각 컴포넌트/훅에서 처리
      // 여기서는 플래그만 관리
    }
  }, [needsResync, socketConnected])

  return {
    isOnline,
    socketConnected,
    needsResync,
    clearResyncFlag: () => setNeedsResync(false),
  }
}
