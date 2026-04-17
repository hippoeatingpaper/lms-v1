# Client - Frontend Rules

> 공통 컴포넌트: `src/components/ui.tsx` 참조
> 각 기능별 상세 스펙은 해당 SPEC 파일을 참조하세요.

## Feature Specs (기능별 상세 스펙)
| 기능 | 스펙 파일 |
|------|----------|
| 인증/로그인 (authStore) | `src/lib/SPEC_AUTH.md` |
| 파일 업로드 (XHR, 진행률) | `src/hooks/SPEC_UPLOAD.md` |
| 반/팀/학생 관리 (Admin) | `src/pages/SPEC_ADMIN.md` |
| 게시판 (공지/자료/댓글/좋아요) | `src/pages/SPEC_POSTS.md` |
| 과제 목록/출제/제출 UI | `src/pages/SPEC_ASSIGNMENTS.md` |
| 공동 문서 편집기 (TipTap) | `src/pages/SPEC_COLLAB.md` |
| 실시간 알림 (Socket.IO) | `src/pages/SPEC_REALTIME.md` |

> 해당 기능 구현 시 반드시 스펙 파일을 먼저 참조하세요.

## File Structure
```
client/
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx       # 교사: 반 목록 / 학생: 반 홈
│   │   ├── ClassHome.tsx
│   │   ├── Board.tsx           # 게시판
│   │   ├── AssignmentList.tsx
│   │   ├── AssignmentDetail.tsx
│   │   ├── DocEditor.tsx       # TipTap + Yjs
│   │   ├── AdminClasses.tsx
│   │   ├── AdminUsers.tsx
│   │   └── AdminTeams.tsx
│   ├── components/
│   │   ├── ui.tsx              # 공통 컴포넌트 (Badge, Button, Card...)
│   │   └── OfflineBanner.tsx
│   ├── stores/
│   │   ├── authStore.ts        # 사용자 인증 상태
│   │   └── connectionStore.ts  # 네트워크 연결 상태
│   ├── hooks/
│   │   ├── useOnlineStatus.ts
│   │   └── useFileUpload.ts
│   └── lib/
│       ├── socket.ts           # Socket.IO 클라이언트
│       ├── yjs.ts              # Yjs WebSocket 프로바이더
│       └── api.ts              # API 유틸리티
```

## Vite Config (개발 프록시)
```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/yjs': { target: 'ws://localhost:3000', ws: true },
    },
  },
})
```

## Design System

### Colors
```css
/* Brand */
--brand: #534AB7;
--brand-light: #EEEDFE;
--brand-mid: #AFA9EC;
--brand-dark: #3C3489;

/* Status */
teal:  bg-[#E1F5EE] text-[#085041]  /* 성공, 제출완료 */
amber: bg-[#FAEEDA] text-[#633806]  /* 경고, 미제출 */
coral: bg-[#FAECE7] text-[#993C1D]  /* 위험, 공지 */
gray:  bg-[#F1EFE8] text-[#5F5E5A]  /* 중립, 임시저장 */
```

### Typography
```css
font-family: 'Pretendard Variable', sans-serif;
/* CDN: https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable.css */

/* 크기 */
페이지 제목: 15-18px, font-medium
카드 제목: 13-14px, font-medium
본문: 12-13px
라벨: 10-11px, tracking-wider
```

### Border & Radius
```css
/* 카드 */
border: 0.5px solid rgba(0,0,0,0.10);
border-radius: 12px;

/* 버튼/입력 */
border: 0.5px solid rgba(0,0,0,0.18);
border-radius: 8px;

/* 뱃지 */
border-radius: 999px;

/* Focus ring (유일한 shadow) */
box-shadow: 0 0 0 3px rgba(83,74,183,0.15);
```

## Component Usage (from ui.tsx)

### Badge
```tsx
<Badge variant="teal">제출완료</Badge>
<Badge variant="amber">미제출</Badge>
<Badge variant="coral">공지</Badge>
<Badge variant="purple">자료</Badge>
<Badge variant="gray">임시저장</Badge>
```

### Button
```tsx
<Button variant="primary">제출하기</Button>
<Button variant="secondary">취소</Button>
<Button variant="danger">삭제</Button>
<Button variant="ghost" size="sm">아이콘</Button>
<Button disabled={!canSubmit}>제출하기</Button>
```

### Input / Textarea
```tsx
<Input placeholder="아이디" />
<Textarea rows={4} placeholder="내용을 입력하세요" />

// Filled 상태 (입력 완료)
className="border-[#AFA9EC] bg-[#EEEDFE]"
```

### Card
```tsx
<Card>기본 카드</Card>
<MetricCard value={28} label="오늘 접속" />
<MetricCard value={7} label="미제출" highlight="danger" />
```

### Modal
```tsx
<Modal open={isOpen} onClose={() => setIsOpen(false)} title="제목">
  <p>내용</p>
</Modal>
```

### Toast
```tsx
import { toast } from './components/ui'
toast.success('저장되었습니다')
toast.error('오류가 발생했습니다')
```

## State Management (Zustand)

### Auth Store
```ts
// stores/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}))
```

### Connection Store
```ts
// stores/connectionStore.ts
interface ConnectionState {
  isOnline: boolean
  socketConnected: boolean
  needsResync: boolean
}
```

## API Calls
```ts
// lib/api.ts
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',  // httpOnly 쿠키 전송
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || '요청 실패')
  }

  return res.json()
}

// 사용
const user = await api<User>('/auth/me')
await api('/assignments', { method: 'POST', body: JSON.stringify(data) })
```

## Socket.IO Client
```ts
// lib/socket.ts
import { io } from 'socket.io-client'
import { useConnectionStore } from '../stores/connectionStore'

export const socket = io({
  path: '/socket.io',
  autoConnect: true,
  reconnection: true,
})

socket.on('connect', () => {
  useConnectionStore.getState().setSocketConnected(true)
})

socket.on('notification', (data) => {
  toast.info(data.message)
})

socket.on('team:assigned', ({ teamId, teamName }) => {
  useAuthStore.getState().setTeamId(teamId)
  toast.success(`${teamName} 팀에 배정되었습니다!`)
})
```

## File Upload Hook
```ts
// hooks/useFileUpload.ts
export function useFileUpload() {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File, url: string) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      setProgress(Math.round((e.loaded / e.total) * 100))
    }
    // ... XHR 로직
  }

  return { progress, uploading, upload, cancel }
}
```

## Layout Patterns

### 교사 (Desktop)
```tsx
<div className="grid md:grid-cols-[200px_1fr] min-h-screen">
  <Sidebar />
  <main className="p-5">{children}</main>
</div>
```

### 학생 (Mobile)
```tsx
<div className="max-w-[430px] mx-auto min-h-screen flex flex-col">
  <TopBar />
  <main className="flex-1 p-3 pb-20">{children}</main>
  <BottomNav />  {/* 또는 SubmitBar */}
</div>
```

## Responsive Breakpoints
```
< 640px   → 모바일 (학생 기본)
640-1024  → 태블릿
> 1024px  → 데스크톱 (교사 기본)
```

## Icons
```tsx
import { Bell, FileText, Users, Lock, Upload } from 'lucide-react'
<Bell size={16} strokeWidth={1.5} />
```

## Forbidden
- `box-shadow` (focus ring 제외)
- 그라데이션
- `font-weight: 700+`
- 임의 hex 색상 (디자인 시스템 색상만 사용)
- 복잡한 애니메이션
