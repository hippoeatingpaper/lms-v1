import { create } from 'zustand'
import { api } from '../lib/api'

// 타입 정의
export interface ClassInfo {
  id: number
  name: string
  created_at: string
  stats: {
    student_count: number
    team_count: number
    unassigned_count: number
  }
}

export interface UserInfo {
  id: number
  name: string
  username: string
  role: 'student' | 'teacher'
  class_id: number | null
  class_name: string | null
  team_id: number | null
  team_name: string | null
  created_at: string
}

export interface TeamInfo {
  id: number
  name: string
  class_id: number
  members: TeamMember[]
}

export interface TeamMember {
  id: number
  name: string
  username: string
}

interface AdminState {
  // 상태
  classes: ClassInfo[]
  users: UserInfo[]
  teams: TeamInfo[]
  unassignedStudents: TeamMember[]
  isLoading: boolean
  error: string | null

  // 액션
  fetchClasses: () => Promise<void>
  fetchUsers: (classId?: number, search?: string) => Promise<void>
  fetchTeams: (classId: number) => Promise<void>
  createClass: (name: string) => Promise<void>
  updateClass: (id: number, name: string) => Promise<void>
  deleteClass: (id: number) => Promise<void>
  createUser: (data: { name: string; username: string; password: string; class_id?: number | null }) => Promise<void>
  createUsersBulk: (classId: number | null, users: { name: string; username: string; password: string }[]) => Promise<{ created: number; failed: { username: string; reason: string }[] }>
  updateUser: (id: number, data: Partial<UserInfo>) => Promise<void>
  deleteUser: (id: number) => Promise<void>
  resetPassword: (id: number, newPassword: string) => Promise<void>
  createTeam: (classId: number, name: string) => Promise<void>
  updateTeam: (id: number, name: string) => Promise<void>
  deleteTeam: (id: number) => Promise<void>
  assignMembers: (teamId: number, userIds: number[]) => Promise<void>
  removeMember: (teamId: number, userId: number) => Promise<void>
  clearError: () => void
}

export const useAdminStore = create<AdminState>((set, get) => ({
  classes: [],
  users: [],
  teams: [],
  unassignedStudents: [],
  isLoading: false,
  error: null,

  fetchClasses: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ classes: ClassInfo[] }>('/classes')
      set({ classes: data.classes, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '반 목록을 불러올 수 없습니다.', isLoading: false })
    }
  },

  fetchUsers: async (classId, search) => {
    set({ isLoading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (classId) params.set('class_id', String(classId))
      if (search) params.set('search', search)
      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await api<{ users: UserInfo[] }>(`/users${query}`)
      set({ users: data.users, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '학생 목록을 불러올 수 없습니다.', isLoading: false })
    }
  },

  fetchTeams: async (classId) => {
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ teams: TeamInfo[]; unassigned: TeamMember[] }>(`/classes/${classId}/teams`)
      set({ teams: data.teams, unassignedStudents: data.unassigned, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '팀 목록을 불러올 수 없습니다.', isLoading: false })
    }
  },

  createClass: async (name) => {
    try {
      await api('/classes', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      await get().fetchClasses()
    } catch (err) {
      throw err
    }
  },

  updateClass: async (id, name) => {
    try {
      await api(`/classes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      })
      await get().fetchClasses()
    } catch (err) {
      throw err
    }
  },

  deleteClass: async (id) => {
    try {
      await api(`/classes/${id}`, { method: 'DELETE' })
      await get().fetchClasses()
    } catch (err) {
      throw err
    }
  },

  createUser: async (data) => {
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    } catch (err) {
      throw err
    }
  },

  createUsersBulk: async (classId, users) => {
    try {
      const result = await api<{ created: number; failed: { username: string; reason: string }[] }>('/users/bulk', {
        method: 'POST',
        body: JSON.stringify({ class_id: classId, users }),
      })
      return result
    } catch (err) {
      throw err
    }
  },

  updateUser: async (id, data) => {
    try {
      await api(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
    } catch (err) {
      throw err
    }
  },

  deleteUser: async (id) => {
    try {
      await api(`/users/${id}`, { method: 'DELETE' })
    } catch (err) {
      throw err
    }
  },

  resetPassword: async (id, newPassword) => {
    try {
      await api(`/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      })
    } catch (err) {
      throw err
    }
  },

  createTeam: async (classId, name) => {
    try {
      await api(`/classes/${classId}/teams`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      await get().fetchTeams(classId)
    } catch (err) {
      throw err
    }
  },

  updateTeam: async (id, name) => {
    try {
      await api(`/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      })
    } catch (err) {
      throw err
    }
  },

  deleteTeam: async (id) => {
    try {
      await api(`/teams/${id}`, { method: 'DELETE' })
    } catch (err) {
      throw err
    }
  },

  assignMembers: async (teamId, userIds) => {
    try {
      await api(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds }),
      })
    } catch (err) {
      throw err
    }
  },

  removeMember: async (teamId, userId) => {
    try {
      await api(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
    } catch (err) {
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))
