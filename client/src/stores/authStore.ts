import { create } from 'zustand'

export interface User {
  id: number
  name: string
  username: string
  role: 'teacher' | 'student'
  class_id: number | null
  class_name: string | null
  team_id: number | null
  team_name: string | null
}

interface AuthState {
  // 상태
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean // 초기 인증 확인 중

  // 액션
  login: (user: User) => void
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
  setTeamId: (teamId: number | null) => void
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

  setTeamId: (teamId) => {
    const { user } = get()
    if (user) {
      set({ user: { ...user, team_id: teamId } })
    }
  },
}))
