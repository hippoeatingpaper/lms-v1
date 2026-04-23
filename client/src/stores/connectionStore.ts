import { create } from 'zustand'

interface ConnectionState {
  // 상태
  isOnline: boolean // 네트워크 연결 상태
  socketConnected: boolean // Socket.IO 연결 상태
  needsResync: boolean // 재연결 후 동기화 필요 여부

  // 액션
  setOnline: (isOnline: boolean) => void
  setSocketConnected: (connected: boolean) => void
  setNeedsResync: (needsResync: boolean) => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  socketConnected: false,
  needsResync: false,

  setOnline: (isOnline) => {
    set({ isOnline })
    // 오프라인에서 온라인으로 전환 시 재동기화 필요
    if (isOnline) {
      set({ needsResync: true })
    }
  },

  setSocketConnected: (connected) => {
    set({ socketConnected: connected })
    // 재연결 시 재동기화 필요
    if (connected) {
      set({ needsResync: true })
    }
  },

  setNeedsResync: (needsResync) => {
    set({ needsResync })
  },
}))

// 브라우저 이벤트 리스너 설정
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useConnectionStore.getState().setOnline(true)
  })

  window.addEventListener('offline', () => {
    useConnectionStore.getState().setOnline(false)
  })
}
