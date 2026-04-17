# 반/팀/학생 관리 프론트엔드 스펙 (Admin)

> 반, 팀, 학생 계정 관리 화면의 프론트엔드 구현 스펙
> **권한**: 교사(teacher) 전용 페이지

## 페이지 구조

### 경로 및 권한

| 화면 | 경로 | 권한 |
|------|------|------|
| 반 관리 | `/admin/classes` | 교사 전용 |
| 학생 계정 관리 | `/admin/users` | 교사 전용 |
| 팀 관리 | `/admin/classes/:classId/teams` | 교사 전용 |

### 탭 네비게이션

```
┌─────────────────────────────────────────────────────────────────┐
│ 관리                                                            │
├─────────────────────────────────────────────────────────────────┤
│  [반 목록]  [학생 계정]  [팀 구성]                                │
│   ^^^^^^                                                        │
│   활성 탭                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  (탭 내용 영역)                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 반 관리 (AdminClasses.tsx)

### 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│ 반 관리                                      [+ 반 추가] 버튼    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│ │ 1반             │  │ 2반             │  │ 3반             │  │
│ │                 │  │                 │  │                 │  │
│ │ ┌─────┬─────┐   │  │ ┌─────┬─────┐   │  │ ┌─────┬─────┐   │  │
│ │ │ 28  │  5  │   │  │ │ 25  │  4  │   │  │ │ 30  │  6  │   │  │
│ │ │학생 │ 팀  │   │  │ │학생 │ 팀  │   │  │ │학생 │ 팀  │   │  │
│ │ ├─────┼─────┤   │  │ ├─────┼─────┤   │  │ ├─────┼─────┤   │  │
│ │ │  3  │  2  │   │  │ │  0  │  1  │   │  │ │  5  │  0  │   │  │
│ │ │미배정│미제출│   │  │ │미배정│미제출│   │  │ │미배정│미제출│   │  │
│ │ └─────┴─────┘   │  │ └─────┴─────┘   │  │ └─────┴─────┘   │  │
│ │                 │  │                 │  │                 │  │
│ │ [수정] [삭제]   │  │ [수정] [삭제]   │  │ [수정] [삭제]   │  │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│ (최대 6개 반)                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ClassCard 컴포넌트

```tsx
// components/ClassCard.tsx
interface ClassCardProps {
  classInfo: {
    id: number
    name: string
    stats: {
      student_count: number
      team_count: number
      unassigned_count: number
    }
  }
  onEdit: () => void
  onDelete: () => void
  onClick: () => void  // 클릭 시 팀 관리 페이지로 이동
}

export function ClassCard({ classInfo, onEdit, onDelete, onClick }: ClassCardProps) {
  return (
    <div
      className="border border-black/10 rounded-xl p-4 hover:border-[#AFA9EC] transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">{classInfo.name}</h3>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 size={14} className="text-[#993C1D]" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <MetricCard value={classInfo.stats.student_count} label="학생" size="sm" />
        <MetricCard value={classInfo.stats.team_count} label="팀" size="sm" />
        <MetricCard
          value={classInfo.stats.unassigned_count}
          label="미배정"
          size="sm"
          highlight={classInfo.stats.unassigned_count > 0 ? 'warning' : undefined}
        />
        <MetricCard value={0} label="미제출" size="sm" />
      </div>
    </div>
  )
}
```

---

## 2. 학생 계정 관리 (AdminUsers.tsx)

### 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│ 학생 계정 관리                        [일괄 등록] [+ 학생 추가]  │
├─────────────────────────────────────────────────────────────────┤
│ 반 필터: [전체 ▼]  검색: [_______________]                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 이름      │ 아이디     │ 반    │ 팀      │ 등록일   │ 액션  │   │
│ ├───────────┼───────────┼───────┼─────────┼─────────┼───────┤   │
│ │ 김민준    │ student01 │ 1반   │ 1모둠   │ 04/01   │ ⋮     │   │
│ │ 이서연    │ student02 │ 1반   │ 1모둠   │ 04/01   │ ⋮     │   │
│ │ 박지호    │ student03 │ 1반   │ 미배정  │ 04/01   │ ⋮     │   │
│ │ 최유진    │ student04 │ 2반   │ A팀     │ 04/02   │ ⋮     │   │
│ │ ...                                                       │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│                              [◀ 1 2 3 4 5 ▶]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 테이블 컴포넌트

```tsx
// pages/AdminUsers.tsx
import { Table, Badge, Button, Dropdown } from '../components/ui'

function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [filter, setFilter] = useState({ classId: '', search: '' })

  return (
    <div className="space-y-4">
      {/* 필터 & 액션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            className="text-xs border border-black/10 rounded-lg px-3 py-2"
            value={filter.classId}
            onChange={(e) => setFilter({ ...filter, classId: e.target.value })}
          >
            <option value="">전체 반</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <Input
            placeholder="이름 또는 아이디 검색"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="w-48"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowBulkModal(true)}>
            일괄 등록
          </Button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            + 학생 추가
          </Button>
        </div>
      </div>

      {/* 테이블 */}
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>이름</Table.Head>
            <Table.Head>아이디</Table.Head>
            <Table.Head>반</Table.Head>
            <Table.Head>팀</Table.Head>
            <Table.Head>등록일</Table.Head>
            <Table.Head className="w-12"></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {users.map((user) => (
            <Table.Row key={user.id}>
              <Table.Cell>{user.name}</Table.Cell>
              <Table.Cell className="text-gray-500">{user.username}</Table.Cell>
              <Table.Cell>{user.class_name || <Badge variant="gray">미배정</Badge>}</Table.Cell>
              <Table.Cell>{user.team_name || <Badge variant="gray">미배정</Badge>}</Table.Cell>
              <Table.Cell className="text-gray-400">
                {formatDate(user.created_at)}
              </Table.Cell>
              <Table.Cell>
                <UserActions user={user} onUpdate={refetch} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  )
}
```

### UserActions 드롭다운

```tsx
// components/UserActions.tsx
function UserActions({ user, onUpdate }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        <MoreVertical size={14} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-black/10 rounded-lg shadow-sm py-1 z-10">
          <button
            className="w-full px-4 py-2 text-xs text-left hover:bg-gray-50"
            onClick={() => handleEdit(user)}
          >
            정보 수정
          </button>
          <button
            className="w-full px-4 py-2 text-xs text-left hover:bg-gray-50"
            onClick={() => handleResetPassword(user)}
          >
            비밀번호 초기화
          </button>
          <button
            className="w-full px-4 py-2 text-xs text-left text-[#993C1D] hover:bg-[#FAECE7]"
            onClick={() => handleDelete(user)}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## 3. 팀 관리 (AdminTeams.tsx)

### 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│ ← 1반 팀 관리                                   [+ 팀 추가]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────┐    ┌─────────────────────────────┐  │
│ │ 1모둠                   │    │ 미배정 학생 (3명)            │  │
│ │ ─────────────────────── │    │ ─────────────────────────── │  │
│ │ ○ 김민준        [×]     │    │ ☐ 박지호                    │  │
│ │ ○ 이서연        [×]     │    │ ☐ 정하늘                    │  │
│ │ ○ 홍길동        [×]     │    │ ☐ 강우진                    │  │
│ │                         │    │                             │  │
│ │ [수정] [삭제]           │    │ 선택한 학생 배정:            │  │
│ └─────────────────────────┘    │ [1모둠 ▼] [배정하기]         │  │
│                                │                             │  │
│ ┌─────────────────────────┐    └─────────────────────────────┘  │
│ │ 2모둠                   │                                     │
│ │ ─────────────────────── │                                     │
│ │ ○ 최유진        [×]     │                                     │
│ │ ○ 이승현        [×]     │                                     │
│ │                         │                                     │
│ │ [수정] [삭제]           │                                     │
│ └─────────────────────────┘                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### TeamCard 컴포넌트

```tsx
// components/TeamCard.tsx
interface TeamCardProps {
  team: {
    id: number
    name: string
    members: Array<{ id: number; name: string; username: string }>
  }
  onEdit: () => void
  onDelete: () => void
  onRemoveMember: (userId: number) => void
}

export function TeamCard({ team, onEdit, onDelete, onRemoveMember }: TeamCardProps) {
  return (
    <div className="border border-black/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">{team.name}</h3>
        <span className="text-xs text-gray-400">{team.members.length}명</span>
      </div>

      <div className="space-y-2 mb-4">
        {team.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between py-1.5 px-2 bg-[#F8F7F4] rounded-lg"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#AFA9EC] flex items-center justify-center">
                <span className="text-[10px] text-white font-medium">
                  {member.name[0]}
                </span>
              </div>
              <span className="text-xs">{member.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveMember(member.id)}
            >
              <X size={12} className="text-gray-400" />
            </Button>
          </div>
        ))}

        {team.members.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            배정된 팀원이 없습니다
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-black/5">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onEdit}>
          수정
        </Button>
        <Button variant="danger" size="sm" className="flex-1" onClick={onDelete}>
          삭제
        </Button>
      </div>
    </div>
  )
}
```

### UnassignedPanel 컴포넌트

```tsx
// components/UnassignedPanel.tsx
interface UnassignedPanelProps {
  students: Array<{ id: number; name: string; username: string }>
  teams: Array<{ id: number; name: string }>
  onAssign: (userIds: number[], teamId: number) => void
}

export function UnassignedPanel({ students, teams, onAssign }: UnassignedPanelProps) {
  const [selected, setSelected] = useState<number[]>([])
  const [targetTeam, setTargetTeam] = useState<number | null>(null)

  const handleToggle = (userId: number) => {
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleAssign = () => {
    if (selected.length === 0 || !targetTeam) return
    onAssign(selected, targetTeam)
    setSelected([])
  }

  return (
    <div className="border border-black/10 rounded-xl p-4 bg-[#F8F7F4]">
      <h3 className="text-sm font-medium mb-3">
        미배정 학생
        <span className="ml-2 text-gray-400">({students.length}명)</span>
      </h3>

      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
        {students.map((student) => (
          <label
            key={student.id}
            className="flex items-center gap-3 py-2 px-3 bg-white rounded-lg cursor-pointer hover:bg-[#EEEDFE]"
          >
            <input
              type="checkbox"
              checked={selected.includes(student.id)}
              onChange={() => handleToggle(student.id)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-xs">{student.name}</span>
            <span className="text-xs text-gray-400">{student.username}</span>
          </label>
        ))}

        {students.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            모든 학생이 팀에 배정되었습니다
          </p>
        )}
      </div>

      {students.length > 0 && (
        <div className="flex items-center gap-2 pt-3 border-t border-black/10">
          <span className="text-xs text-gray-500">선택한 학생 배정:</span>
          <select
            className="flex-1 text-xs border border-black/10 rounded-lg px-2 py-1.5"
            value={targetTeam || ''}
            onChange={(e) => setTargetTeam(Number(e.target.value))}
          >
            <option value="">팀 선택</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAssign}
            disabled={selected.length === 0 || !targetTeam}
          >
            배정
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

## 4. 모달 컴포넌트

### CreateClassModal

```tsx
// components/modals/CreateClassModal.tsx
function CreateClassModal({ open, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return

    setLoading(true)
    try {
      await api('/classes', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      toast.success('반이 생성되었습니다.')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '반 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="반 추가">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">반 이름</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 1반, 화요일 3교시"
            autoFocus
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
          >
            {loading ? '생성 중...' : '추가'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

### CreateUserModal

```tsx
// components/modals/CreateUserModal.tsx
function CreateUserModal({ open, onClose, onSuccess, classes }: Props) {
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    class_id: '',
  })

  const handleSubmit = async () => {
    if (!form.name || !form.username || !form.password) {
      toast.error('모든 필수 항목을 입력하세요.')
      return
    }

    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          class_id: form.class_id ? Number(form.class_id) : null,
        }),
      })
      toast.success('학생 계정이 생성되었습니다.')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '계정 생성에 실패했습니다.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학생 추가">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">이름 *</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="홍길동"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">아이디 *</label>
          <Input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="student01"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">초기 비밀번호 *</label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="비밀번호"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">소속 반</label>
          <select
            className="w-full text-xs border border-black/10 rounded-lg px-3 py-2"
            value={form.class_id}
            onChange={(e) => setForm({ ...form, class_id: e.target.value })}
          >
            <option value="">반 미배정</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleSubmit}>추가</Button>
        </div>
      </div>
    </Modal>
  )
}
```

### BulkCreateModal (일괄 등록)

```tsx
// components/modals/BulkCreateModal.tsx
function BulkCreateModal({ open, onClose, onSuccess, classes }: Props) {
  const [classId, setClassId] = useState('')
  const [text, setText] = useState('')

  // 텍스트 형식: "이름,아이디,비밀번호" (줄바꿈으로 구분)
  const handleSubmit = async () => {
    const lines = text.trim().split('\n').filter(Boolean)
    const users = lines.map((line) => {
      const [name, username, password] = line.split(',').map((s) => s.trim())
      return { name, username, password }
    })

    try {
      const result = await api<{ created: number; failed: any[] }>('/users/bulk', {
        method: 'POST',
        body: JSON.stringify({
          class_id: classId ? Number(classId) : null,
          users,
        }),
      })

      if (result.failed.length > 0) {
        toast.error(`${result.created}명 등록, ${result.failed.length}명 실패`)
      } else {
        toast.success(`${result.created}명의 학생이 등록되었습니다.`)
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error('일괄 등록에 실패했습니다.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학생 일괄 등록">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">소속 반</label>
          <select
            className="w-full text-xs border border-black/10 rounded-lg px-3 py-2"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">반 미배정</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            학생 목록 (이름,아이디,비밀번호)
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`김민준,student01,pw1234\n이서연,student02,pw1234\n박지호,student03,pw1234`}
            rows={8}
          />
          <p className="mt-1 text-[10px] text-gray-400">
            한 줄에 한 명씩, 쉼표로 구분하여 입력하세요.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={handleSubmit}>등록</Button>
        </div>
      </div>
    </Modal>
  )
}
```

---

## 5. 상태 관리

### adminStore

```ts
// stores/adminStore.ts
import { create } from 'zustand'

interface AdminState {
  classes: ClassInfo[]
  users: UserInfo[]
  selectedClassId: number | null

  fetchClasses: () => Promise<void>
  fetchUsers: (classId?: number) => Promise<void>
  setSelectedClassId: (id: number | null) => void
}

export const useAdminStore = create<AdminState>((set, get) => ({
  classes: [],
  users: [],
  selectedClassId: null,

  fetchClasses: async () => {
    const data = await api<{ classes: ClassInfo[] }>('/classes')
    set({ classes: data.classes })
  },

  fetchUsers: async (classId) => {
    const query = classId ? `?class_id=${classId}` : ''
    const data = await api<{ users: UserInfo[] }>(`/users${query}`)
    set({ users: data.users })
  },

  setSelectedClassId: (id) => set({ selectedClassId: id }),
}))
```

---

## 6. Socket.IO 이벤트 처리

### 팀 배정 알림 수신 (학생 측)

```ts
// lib/socket.ts
import { useAuthStore } from '../stores/authStore'

socket.on('team:assigned', ({ teamId, teamName }) => {
  // authStore 업데이트 (새로고침 없이 팀 과제 접근 가능)
  useAuthStore.getState().updateUser({ team_id: teamId })
  toast.success(`${teamName} 팀에 배정되었습니다!`)
})

socket.on('team:removed', ({ teamId }) => {
  useAuthStore.getState().updateUser({ team_id: null })
  toast.info('팀 배정이 해제되었습니다.')
})

socket.on('user:updated', ({ user }) => {
  useAuthStore.getState().updateUser(user)
})
```

---

## 7. API 호출 예시

```ts
// 반 목록 조회
const { classes } = await api<{ classes: ClassInfo[] }>('/classes')

// 반 생성
await api('/classes', { method: 'POST', body: JSON.stringify({ name: '3반' }) })

// 반별 팀 목록 조회
const { teams, unassigned } = await api<TeamsResponse>(`/classes/${classId}/teams`)

// 팀원 배정
await api(`/teams/${teamId}/members`, {
  method: 'POST',
  body: JSON.stringify({ user_ids: [10, 11, 12] }),
})

// 팀원 제거
await api(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' })

// 학생 계정 생성
await api('/users', {
  method: 'POST',
  body: JSON.stringify({ name, username, password, class_id }),
})

// 비밀번호 초기화
await api(`/users/${userId}/reset-password`, {
  method: 'POST',
  body: JSON.stringify({ new_password: '새비밀번호' }),
})
```

---

## 8. 확인 다이얼로그

### 삭제 확인

```tsx
// 반 삭제
<ConfirmDialog
  open={showDeleteConfirm}
  title="반 삭제"
  message={`"${selectedClass?.name}"을(를) 삭제하시겠습니까?\n소속된 팀과 과제 데이터도 함께 삭제됩니다.`}
  confirmLabel="삭제"
  confirmVariant="danger"
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteConfirm(false)}
/>

// 팀원 제거
<ConfirmDialog
  open={showRemoveConfirm}
  title="팀원 제거"
  message={`"${selectedMember?.name}"을(를) 팀에서 제거하시겠습니까?`}
  confirmLabel="제거"
  onConfirm={handleRemoveMember}
  onCancel={() => setShowRemoveConfirm(false)}
/>
```

---

## 보안 체크리스트

- [ ] 모든 관리 페이지에 AuthGuard (requireRole="teacher") 적용
- [ ] 삭제 전 확인 다이얼로그 표시
- [ ] Socket.IO 이벤트로 실시간 상태 동기화
- [ ] 에러 발생 시 Toast로 피드백
- [ ] 로딩 상태 표시
