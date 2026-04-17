# 실시간 알림 프론트엔드 스펙 (Socket.IO)

> Socket.IO 기반 실시간 알림, 댓글, 좋아요 UI 구현

## 파일 구조

```
client/src/
├── lib/
│   └── socket.ts              # Socket.IO 클라이언트 설정
├── stores/
│   ├── notificationStore.ts   # 알림 상태 관리
│   └── connectionStore.ts     # 연결 상태 관리
├── hooks/
│   └── useNotifications.ts    # 알림 훅
├── components/
│   ├── NotificationBell.tsx   # 헤더 알림 아이콘
│   ├── NotificationDropdown.tsx # 알림 드롭다운
│   └── Toast.tsx              # 토스트 알림
└── pages/
    └── Notifications.tsx      # 알림 목록 페이지
```

## Socket.IO 클라이언트 설정

### lib/socket.ts

```ts
// client/src/lib/socket.ts
import { io, Socket } from 'socket.io-client'
import { useConnectionStore } from '../stores/connectionStore'
import { useNotificationStore } from '../stores/notificationStore'
import { useAuthStore } from '../stores/authStore'
import { toast } from '../components/ui'

let socket: Socket | null = null

/**
 * Socket.IO 초기화 (로그인 후 호출)
 */
export function initSocket() {
  if (socket?.connected) return socket

  socket = io({
    path: '/socket.io',
    withCredentials: true,  // httpOnly 쿠키 전송
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  // 연결 상태 이벤트
  socket.on('connect', () => {
    console.log('[socket] 연결됨')
    useConnectionStore.getState().setSocketConnected(true)
  })

  socket.on('disconnect', (reason) => {
    console.log('[socket] 연결 해제:', reason)
    useConnectionStore.getState().setSocketConnected(false)
  })

  socket.on('connect_error', (error) => {
    console.error('[socket] 연결 오류:', error.message)
  })

  // 알림 이벤트
  socket.on('notification', handleNotification)
  socket.on('team:assigned', handleTeamAssigned)
  socket.on('comment:created', handleCommentCreated)
  socket.on('like:updated', handleLikeUpdated)

  return socket
}

/**
 * Socket.IO 인스턴스 반환
 */
export function getSocket() {
  if (!socket) {
    throw new Error('Socket이 초기화되지 않았습니다.')
  }
  return socket
}

/**
 * Socket.IO 연결 해제 (로그아웃 시)
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

// ─────────────────────────────────────────────────────────
// 이벤트 핸들러
// ─────────────────────────────────────────────────────────

/**
 * 일반 알림 처리
 */
function handleNotification(notification: Notification) {
  console.log('[socket] 알림 수신:', notification)

  // 알림 스토어에 추가
  useNotificationStore.getState().addNotification(notification)

  // 토스트 표시
  const icon = getNotificationIcon(notification.type)
  toast.info(`${icon} ${notification.message}`)
}

/**
 * 팀 배정 알림 (특별 처리)
 */
function handleTeamAssigned(data: { teamId: number; teamName: string }) {
  console.log('[socket] 팀 배정:', data)

  // 사용자 정보 업데이트 (BlockedState 즉시 해제)
  useAuthStore.getState().setTeamId(data.teamId)

  // 팀 room 참가 요청
  socket?.emit('team:join', { teamId: data.teamId })

  // 토스트 표시
  toast.success(`🎉 ${data.teamName} 팀에 배정되었습니다!`)
}

/**
 * 댓글 생성 알림
 */
function handleCommentCreated(data: { postId: number; comment: Comment }) {
  console.log('[socket] 새 댓글:', data)

  // 현재 보고 있는 게시물이면 댓글 목록 업데이트
  // → 해당 페이지 컴포넌트에서 처리 (useEffect로 구독)
  window.dispatchEvent(new CustomEvent('comment:created', { detail: data }))
}

/**
 * 좋아요 업데이트
 */
function handleLikeUpdated(data: { postId: number; likeCount: number }) {
  console.log('[socket] 좋아요 업데이트:', data)

  // 게시물 목록/상세에서 처리
  window.dispatchEvent(new CustomEvent('like:updated', { detail: data }))
}

// ─────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'notice': return '📢'
    case 'feedback': return '💬'
    case 'assignment': return '📝'
    case 'team_assigned': return '👥'
    default: return '🔔'
  }
}

// ─────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────

export interface Notification {
  id: number
  type: 'notice' | 'feedback' | 'assignment' | 'team_assigned' | 'comment'
  message: string
  data?: Record<string, any>
  is_read?: boolean
  created_at: string
}

export interface Comment {
  id: number
  body: string
  author: { id: number; name: string }
  created_at: string
}
```

## 상태 관리

### stores/notificationStore.ts

```ts
// client/src/stores/notificationStore.ts
import { create } from 'zustand'
import { Notification } from '../lib/socket'
import { api } from '../lib/api'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean

  // Actions
  fetchNotifications: () => Promise<void>
  addNotification: (notification: Notification) => void
  markAsRead: (notificationId: number) => void
  markAllAsRead: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true })
    try {
      const { notifications, unread_count } = await api<{
        notifications: Notification[]
        unread_count: number
      }>('/notifications')

      set({
        notifications,
        unreadCount: unread_count,
        isLoading: false,
      })
    } catch (err) {
      console.error('알림 조회 실패:', err)
      set({ isLoading: false })
    }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }))
  },

  markAsRead: (notificationId) => {
    const socket = (window as any).__socket
    socket?.emit('notification:read', { notificationId })

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllAsRead: () => {
    const socket = (window as any).__socket
    socket?.emit('notification:readAll')

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))
  },
}))
```

### stores/connectionStore.ts (업데이트)

```ts
// client/src/stores/connectionStore.ts
import { create } from 'zustand'

interface ConnectionState {
  isOnline: boolean
  socketConnected: boolean
  needsResync: boolean

  setOnline: (online: boolean) => void
  setSocketConnected: (connected: boolean) => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  isOnline: navigator.onLine,
  socketConnected: false,
  needsResync: false,

  setOnline: (online) => {
    set({ isOnline: online })
    if (online && !get().socketConnected) {
      set({ needsResync: true })
    }
  },

  setSocketConnected: (connected) => {
    const wasDisconnected = !get().socketConnected
    set({ socketConnected: connected })

    if (connected && wasDisconnected) {
      // 재연결 시 알림 새로고침
      set({ needsResync: true })
    }
  },
}))
```

## 컴포넌트

### NotificationBell.tsx — 헤더 알림 아이콘

```tsx
// client/src/components/NotificationBell.tsx
import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '../stores/notificationStore'
import { NotificationDropdown } from './NotificationDropdown'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { unreadCount, fetchNotifications } = useNotificationStore()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 초기 로드
  useEffect(() => {
    fetchNotifications()
  }, [])

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell size={18} strokeWidth={1.5} className="text-gray-600" />

        {/* 읽지 않은 알림 점 */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D85A30]" />
        )}
      </button>

      {/* 드롭다운 */}
      {isOpen && (
        <NotificationDropdown onClose={() => setIsOpen(false)} />
      )}
    </div>
  )
}
```

### NotificationDropdown.tsx — 알림 드롭다운

```tsx
// client/src/components/NotificationDropdown.tsx
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../stores/notificationStore'
import { Badge, Button } from './ui'
import { formatRelativeTime } from '../lib/utils'

interface Props {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: Props) {
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()

  function handleClick(notification: any) {
    // 읽음 처리
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    // 관련 페이지로 이동
    if (notification.data?.assignmentId) {
      navigate(`/assignments/${notification.data.assignmentId}`)
    } else if (notification.data?.submissionId) {
      navigate(`/submissions/${notification.data.submissionId}`)
    }

    onClose()
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-black/10 rounded-xl shadow-lg z-50">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
        <h3 className="text-sm font-medium">알림</h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-[#534AB7] hover:underline"
          >
            전체 읽음
          </button>
        )}
      </div>

      {/* 알림 목록 */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            알림이 없습니다
          </div>
        ) : (
          notifications.slice(0, 10).map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={`
                w-full text-left px-4 py-3 border-b border-black/5 last:border-0
                hover:bg-gray-50 transition-colors
                ${!notification.is_read ? 'bg-[#EEEDFE]/30' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <span className="text-lg">
                  {getNotificationIcon(notification.type)}
                </span>

                <div className="flex-1 min-w-0">
                  {/* 메시지 */}
                  <p className={`text-xs ${!notification.is_read ? 'font-medium' : ''}`}>
                    {notification.message}
                  </p>

                  {/* 시간 */}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>

                {/* 읽지 않음 표시 */}
                {!notification.is_read && (
                  <span className="w-2 h-2 rounded-full bg-[#534AB7] mt-1" />
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* 푸터 */}
      {notifications.length > 10 && (
        <div className="px-4 py-3 border-t border-black/8">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              navigate('/notifications')
              onClose()
            }}
          >
            전체 알림 보기
          </Button>
        </div>
      )}
    </div>
  )
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'notice': return '📢'
    case 'feedback': return '💬'
    case 'assignment': return '📝'
    case 'team_assigned': return '👥'
    default: return '🔔'
  }
}
```

### Notifications.tsx — 알림 목록 페이지

```tsx
// client/src/pages/Notifications.tsx
import { useEffect } from 'react'
import { useNotificationStore } from '../stores/notificationStore'
import { Badge, Card } from '../components/ui'
import { formatRelativeTime } from '../lib/utils'

export default function Notifications() {
  const { notifications, isLoading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotificationStore()

  useEffect(() => {
    fetchNotifications()
  }, [])

  if (isLoading) {
    return <div className="p-4">로딩 중...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium">알림</h1>
        <button
          onClick={markAllAsRead}
          className="text-xs text-[#534AB7] hover:underline"
        >
          전체 읽음 처리
        </button>
      </div>

      {/* 알림 목록 */}
      <div className="space-y-2">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={`p-4 cursor-pointer hover:bg-gray-50 ${
              !notification.is_read ? 'border-l-2 border-l-[#534AB7]' : ''
            }`}
            onClick={() => !notification.is_read && markAsRead(notification.id)}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{getNotificationIcon(notification.type)}</span>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <TypeBadge type={notification.type} />
                  <span className="text-[10px] text-gray-400">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                </div>

                <p className="text-sm mt-1">{notification.message}</p>
              </div>
            </div>
          </Card>
        ))}

        {notifications.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            알림이 없습니다
          </div>
        )}
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  const variants: Record<string, any> = {
    notice: { variant: 'coral', label: '공지' },
    feedback: { variant: 'purple', label: '피드백' },
    assignment: { variant: 'amber', label: '과제' },
    team_assigned: { variant: 'teal', label: '팀 배정' },
  }
  const { variant, label } = variants[type] || { variant: 'gray', label: '알림' }
  return <Badge variant={variant}>{label}</Badge>
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'notice': return '📢'
    case 'feedback': return '💬'
    case 'assignment': return '📝'
    case 'team_assigned': return '👥'
    default: return '🔔'
  }
}
```

## 댓글/좋아요 실시간 연동

### 게시물 상세에서 댓글 실시간 수신

```tsx
// client/src/pages/PostDetail.tsx (일부)
import { useEffect, useState } from 'react'
import { getSocket } from '../lib/socket'

function PostDetail({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [likeCount, setLikeCount] = useState(0)

  // 실시간 댓글 수신
  useEffect(() => {
    function handleCommentCreated(event: CustomEvent) {
      const { postId: eventPostId, comment } = event.detail
      if (eventPostId === Number(postId)) {
        setComments((prev) => [...prev, comment])
      }
    }

    window.addEventListener('comment:created', handleCommentCreated as EventListener)
    return () => {
      window.removeEventListener('comment:created', handleCommentCreated as EventListener)
    }
  }, [postId])

  // 실시간 좋아요 수신
  useEffect(() => {
    function handleLikeUpdated(event: CustomEvent) {
      const { postId: eventPostId, likeCount: newCount } = event.detail
      if (eventPostId === Number(postId)) {
        setLikeCount(newCount)
      }
    }

    window.addEventListener('like:updated', handleLikeUpdated as EventListener)
    return () => {
      window.removeEventListener('like:updated', handleLikeUpdated as EventListener)
    }
  }, [postId])

  // 댓글 작성
  function handleCommentSubmit(body: string) {
    const socket = getSocket()
    socket.emit('comment:create', { postId: Number(postId), body })
  }

  // 좋아요 토글
  function handleLikeToggle() {
    const socket = getSocket()
    socket.emit('like:toggle', { postId: Number(postId) })
  }

  // ... 렌더링
}
```

## App.tsx — Socket 초기화

```tsx
// client/src/App.tsx
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { initSocket, disconnectSocket } from './lib/socket'

function App() {
  const { isAuthenticated } = useAuthStore()

  // 로그인 상태에 따라 Socket 연결/해제
  useEffect(() => {
    if (isAuthenticated) {
      const socket = initSocket()
      ;(window as any).__socket = socket  // 전역 접근용
    } else {
      disconnectSocket()
      ;(window as any).__socket = null
    }
  }, [isAuthenticated])

  return (
    // ... 라우터
  )
}
```

## 유틸리티 함수

```ts
// client/src/lib/utils.ts

/**
 * 상대 시간 표시 (방금 전, 5분 전, 1시간 전, ...)
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`

  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  })
}
```

## 이벤트 요약

### 송신 (emit)

| 이벤트 | 데이터 | 용도 |
|--------|--------|------|
| `comment:create` | `{ postId, body }` | 댓글 작성 |
| `like:toggle` | `{ postId }` | 좋아요 토글 |
| `notification:read` | `{ notificationId }` | 알림 읽음 |
| `notification:readAll` | - | 전체 읽음 |
| `team:join` | `{ teamId }` | 팀 room 참가 |

### 수신 (on)

| 이벤트 | 처리 |
|--------|------|
| `notification` | 알림 스토어 추가 + 토스트 |
| `team:assigned` | 사용자 정보 업데이트 + 토스트 |
| `comment:created` | 게시물 상세에서 댓글 목록 업데이트 |
| `like:updated` | 게시물의 좋아요 수 업데이트 |

## UI 스타일

### 읽지 않은 알림 점
```tsx
{unreadCount > 0 && (
  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D85A30]" />
)}
```

### 읽지 않은 알림 행
```tsx
className={!notification.is_read ? 'bg-[#EEEDFE]/30 border-l-2 border-l-[#534AB7]' : ''}
```

### 알림 타입별 뱃지
```tsx
notice:        <Badge variant="coral">공지</Badge>
feedback:      <Badge variant="purple">피드백</Badge>
assignment:    <Badge variant="amber">과제</Badge>
team_assigned: <Badge variant="teal">팀 배정</Badge>
```
