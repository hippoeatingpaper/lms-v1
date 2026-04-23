import { useState, useEffect, useMemo } from 'react'
import { Plus, MoreVertical, Upload } from 'lucide-react'
import {
  Button,
  Input,
  Textarea,
  Modal,
  Badge,
  Table,
  TableHeader,
  TableRow,
  Skeleton,
  EmptyState,
  ErrorState,
  useToast,
} from '../components/ui'
import { useAdminStore, UserInfo, ClassInfo } from '../stores/adminStore'

// 날짜 포맷
function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

// 사용자 액션 드롭다운
function UserActions({
  onEdit,
  onResetPassword,
  onDelete,
}: {
  onEdit: () => void
  onResetPassword: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        <MoreVertical size={14} />
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 bg-white border border-black/10 rounded-lg shadow-sm py-1 z-20 min-w-[120px]">
            <button
              className="w-full px-4 py-2 text-xs text-left hover:bg-gray-50"
              onClick={() => {
                setOpen(false)
                onEdit()
              }}
            >
              정보 수정
            </button>
            <button
              className="w-full px-4 py-2 text-xs text-left hover:bg-gray-50"
              onClick={() => {
                setOpen(false)
                onResetPassword()
              }}
            >
              비밀번호 초기화
            </button>
            <button
              className="w-full px-4 py-2 text-xs text-left text-[#993C1D] hover:bg-[#FAECE7]"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
            >
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// 학생 생성 모달
function CreateUserModal({
  open,
  onClose,
  onSuccess,
  classes,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  classes: ClassInfo[]
}) {
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    class_id: '',
  })
  const [loading, setLoading] = useState(false)
  const { createUser } = useAdminStore()
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setForm({ name: '', username: '', password: '', class_id: '' })
    }
  }, [open])

  const handleSubmit = async () => {
    if (!form.name || !form.username || !form.password) {
      toast.error('모든 필수 항목을 입력하세요.')
      return
    }

    setLoading(true)
    try {
      await createUser({
        name: form.name,
        username: form.username,
        password: form.password,
        class_id: form.class_id ? Number(form.class_id) : null,
      })
      toast.success('학생 계정이 생성되었습니다.')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '계정 생성에 실패했습니다.')
    } finally {
      setLoading(false)
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
            autoFocus
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
            className="w-full text-sm border border-black/15 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#534AB7]/15 focus:border-[#AFA9EC]"
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
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            추가
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 일괄 등록 모달
function BulkCreateModal({
  open,
  onClose,
  onSuccess,
  classes,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  classes: ClassInfo[]
}) {
  const [classId, setClassId] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const { createUsersBulk } = useAdminStore()
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setClassId('')
      setText('')
    }
  }, [open])

  const handleSubmit = async () => {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length === 0) {
      toast.error('학생 목록을 입력하세요.')
      return
    }

    const users = lines.map((line) => {
      const [name, username, password] = line.split(',').map((s) => s.trim())
      return { name, username, password }
    })

    // 유효성 검사
    const invalid = users.find((u) => !u.name || !u.username || !u.password)
    if (invalid) {
      toast.error('형식이 올바르지 않습니다. "이름,아이디,비밀번호" 형식으로 입력하세요.')
      return
    }

    setLoading(true)
    try {
      const result = await createUsersBulk(
        classId ? Number(classId) : null,
        users
      )

      if (result.failed.length > 0) {
        toast.warning(`${result.created}명 등록, ${result.failed.length}명 실패`)
      } else {
        toast.success(`${result.created}명의 학생이 등록되었습니다.`)
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error('일괄 등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학생 일괄 등록" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">소속 반</label>
          <select
            className="w-full text-sm border border-black/15 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#534AB7]/15 focus:border-[#AFA9EC]"
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
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            등록
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 학생 수정 모달
function EditUserModal({
  open,
  onClose,
  user,
  classes,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  user: UserInfo | null
  classes: ClassInfo[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState({ name: '', class_id: '' })
  const [loading, setLoading] = useState(false)
  const { updateUser } = useAdminStore()
  const toast = useToast()

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        class_id: user.class_id ? String(user.class_id) : '',
      })
    }
  }, [user])

  const handleSubmit = async () => {
    if (!user || !form.name) return

    setLoading(true)
    try {
      await updateUser(user.id, {
        name: form.name,
        class_id: form.class_id ? Number(form.class_id) : null,
      } as any)
      toast.success('학생 정보가 수정되었습니다.')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '수정에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학생 정보 수정">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">이름</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">아이디</label>
          <Input value={user?.username || ''} disabled />
          <p className="mt-1 text-[10px] text-gray-400">아이디는 변경할 수 없습니다.</p>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">소속 반</label>
          <select
            className="w-full text-sm border border-black/15 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#534AB7]/15 focus:border-[#AFA9EC]"
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
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            저장
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 비밀번호 초기화 모달
function ResetPasswordModal({
  open,
  onClose,
  user,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  user: UserInfo | null
  onSuccess: () => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAdminStore()
  const toast = useToast()

  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  const handleSubmit = async () => {
    if (!user || !password) return

    setLoading(true)
    try {
      await resetPassword(user.id, password)
      toast.success('비밀번호가 초기화되었습니다.')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '초기화에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="비밀번호 초기화">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{user?.name}</span>
          ({user?.username}) 학생의 비밀번호를 초기화합니다.
        </p>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">새 비밀번호</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="새 비밀번호 입력"
            autoFocus
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!password}
            loading={loading}
          >
            초기화
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 삭제 확인 모달
function DeleteUserModal({
  open,
  onClose,
  user,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  user: UserInfo | null
  onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학생 삭제">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{user?.name}</span>
          ({user?.username}) 학생을 삭제하시겠습니까?
        </p>
        <p className="text-xs text-[#993C1D] bg-[#FAECE7] p-3 rounded-lg">
          해당 학생의 과제 제출 기록도 함께 삭제됩니다.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={loading}
          >
            삭제
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 학생 계정 관리 페이지
export function AdminUsers() {
  const {
    users,
    classes,
    isLoading,
    error,
    fetchUsers,
    fetchClasses,
    deleteUser,
    clearError,
  } = useAdminStore()
  const toast = useToast()

  const [filter, setFilter] = useState({ classId: '', search: '' })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<UserInfo | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetchClasses()
    fetchUsers()
  }, [fetchClasses, fetchUsers])

  // 필터링된 사용자 목록
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // 반 필터
      if (filter.classId && user.class_id !== Number(filter.classId)) {
        return false
      }
      // 검색어 필터
      if (filter.search) {
        const search = filter.search.toLowerCase()
        return (
          user.name.toLowerCase().includes(search) ||
          user.username.toLowerCase().includes(search)
        )
      }
      return true
    })
  }, [users, filter])

  const handleRefetch = () => {
    fetchUsers(filter.classId ? Number(filter.classId) : undefined)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return
    try {
      await deleteUser(deletingUser.id)
      toast.success('학생이 삭제되었습니다.')
      setDeletingUser(null)
      handleRefetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  if (error) {
    return (
      <ErrorState
        title="학생 목록을 불러올 수 없습니다"
        description={error}
        onRetry={() => {
          clearError()
          fetchUsers()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">학생 계정 관리</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowBulkModal(true)}>
            <Upload size={14} />
            일괄 등록
          </Button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            학생 추가
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3">
        <select
          className="text-sm border border-black/15 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#534AB7]/15 focus:border-[#AFA9EC]"
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

      {/* 테이블 */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Plus}
          message={filter.search || filter.classId ? '검색 결과가 없습니다' : '등록된 학생이 없습니다'}
          action={
            !filter.search && !filter.classId && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} />
                학생 추가
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <TableHeader
            columns={['이름', '아이디', '반', '팀', '등록일', '']}
            widths={['20%', '20%', '15%', '15%', '15%', '48px']}
          />
          <tbody>
            {filteredUsers.map((user) => (
              <TableRow
                key={user.id}
                cells={[
                  <span className="font-medium">{user.name}</span>,
                  <span className="text-gray-500">{user.username}</span>,
                  user.class_name || <Badge variant="gray">미배정</Badge>,
                  user.team_name || <Badge variant="gray">미배정</Badge>,
                  <span className="text-gray-400">{formatDate(user.created_at)}</span>,
                  <UserActions
                    onEdit={() => setEditingUser(user)}
                    onResetPassword={() => setResetPasswordUser(user)}
                    onDelete={() => setDeletingUser(user)}
                  />,
                ]}
              />
            ))}
          </tbody>
        </Table>
      )}

      {/* 모달들 */}
      <CreateUserModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleRefetch}
        classes={classes}
      />

      <BulkCreateModal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={handleRefetch}
        classes={classes}
      />

      <EditUserModal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
        classes={classes}
        onSuccess={handleRefetch}
      />

      <ResetPasswordModal
        open={!!resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        user={resetPasswordUser}
        onSuccess={handleRefetch}
      />

      <DeleteUserModal
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        user={deletingUser}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
