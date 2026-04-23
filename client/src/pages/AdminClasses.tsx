import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import {
  Button,
  Card,
  MetricCard,
  Modal,
  Input,
  Skeleton,
  EmptyState,
  ErrorState,
  useToast,
} from '../components/ui'
import { useAdminStore, ClassInfo } from '../stores/adminStore'

// 반 카드 컴포넌트
function ClassCard({
  classInfo,
  onEdit,
  onDelete,
  onClick,
}: {
  classInfo: ClassInfo
  onEdit: () => void
  onDelete: () => void
  onClick: () => void
}) {
  return (
    <div
      className="border border-black/10 rounded-xl p-4 hover:border-[#AFA9EC] transition-colors cursor-pointer bg-white"
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
        <MetricCard value={classInfo.stats.student_count} label="학생" />
        <MetricCard value={classInfo.stats.team_count} label="팀" />
        <MetricCard
          value={classInfo.stats.unassigned_count}
          label="미배정"
          highlight={classInfo.stats.unassigned_count > 0 ? 'danger' : undefined}
        />
        <MetricCard value={0} label="미제출" />
      </div>
    </div>
  )
}

// 반 생성/수정 모달
function ClassFormModal({
  open,
  onClose,
  editingClass,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  editingClass?: ClassInfo | null
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const { createClass, updateClass } = useAdminStore()
  const toast = useToast()

  useEffect(() => {
    if (editingClass) {
      setName(editingClass.name)
    } else {
      setName('')
    }
  }, [editingClass, open])

  const handleSubmit = async () => {
    if (!name.trim()) return

    setLoading(true)
    try {
      if (editingClass) {
        await updateClass(editingClass.id, name.trim())
        toast.success('반 정보가 수정되었습니다.')
      } else {
        await createClass(name.trim())
        toast.success('반이 생성되었습니다.')
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '작업에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingClass ? '반 수정' : '반 추가'}
    >
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
            loading={loading}
          >
            {editingClass ? '수정' : '추가'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 삭제 확인 모달
function DeleteConfirmModal({
  open,
  onClose,
  className,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  className: string
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
    <Modal open={open} onClose={onClose} title="반 삭제">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">"{className}"</span>을(를)
          삭제하시겠습니까?
        </p>
        <p className="text-xs text-[#993C1D] bg-[#FAECE7] p-3 rounded-lg">
          소속된 팀과 학생 배정 정보도 함께 해제됩니다.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={loading}
            loading={loading}
          >
            삭제
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 반 관리 페이지
export function AdminClasses() {
  const navigate = useNavigate()
  const { classes, isLoading, error, fetchClasses, deleteClass, clearError } = useAdminStore()
  const toast = useToast()

  const [showFormModal, setShowFormModal] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassInfo | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingClass, setDeletingClass] = useState<ClassInfo | null>(null)

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  const handleEdit = (classInfo: ClassInfo) => {
    setEditingClass(classInfo)
    setShowFormModal(true)
  }

  const handleDeleteClick = (classInfo: ClassInfo) => {
    setDeletingClass(classInfo)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingClass) return
    try {
      await deleteClass(deletingClass.id)
      toast.success('반이 삭제되었습니다.')
      setShowDeleteModal(false)
      setDeletingClass(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const handleClassClick = (classInfo: ClassInfo) => {
    navigate(`/admin/classes/${classInfo.id}/teams`)
  }

  const handleCloseFormModal = () => {
    setShowFormModal(false)
    setEditingClass(null)
  }

  if (error) {
    return (
      <ErrorState
        title="반 목록을 불러올 수 없습니다"
        description={error}
        onRetry={() => {
          clearError()
          fetchClasses()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">반 관리</h1>
        <Button
          variant="primary"
          onClick={() => setShowFormModal(true)}
          disabled={classes.length >= 6}
        >
          <Plus size={16} />
          반 추가
        </Button>
      </div>

      {/* 반 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-1/3 mb-3" />
              <div className="grid grid-cols-2 gap-1.5">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Users}
          message="등록된 반이 없습니다"
          action={
            <Button variant="primary" onClick={() => setShowFormModal(true)}>
              <Plus size={16} />
              반 추가
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((classInfo) => (
              <ClassCard
                key={classInfo.id}
                classInfo={classInfo}
                onEdit={() => handleEdit(classInfo)}
                onDelete={() => handleDeleteClick(classInfo)}
                onClick={() => handleClassClick(classInfo)}
              />
            ))}
          </div>
          {classes.length >= 6 && (
            <p className="text-xs text-gray-400 text-center">
              최대 6개의 반을 등록할 수 있습니다.
            </p>
          )}
        </>
      )}

      {/* 모달 */}
      <ClassFormModal
        open={showFormModal}
        onClose={handleCloseFormModal}
        editingClass={editingClass}
        onSuccess={fetchClasses}
      />

      <DeleteConfirmModal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeletingClass(null)
        }}
        className={deletingClass?.name || ''}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
