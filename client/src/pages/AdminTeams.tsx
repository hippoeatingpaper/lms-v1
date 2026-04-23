import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, X, Users } from 'lucide-react'
import {
  Button,
  Input,
  Modal,
  Skeleton,
  EmptyState,
  ErrorState,
  useToast,
} from '../components/ui'
import { useAdminStore, TeamInfo, TeamMember } from '../stores/adminStore'

// 팀 카드 컴포넌트
function TeamCard({
  team,
  onEdit,
  onDelete,
  onRemoveMember,
}: {
  team: TeamInfo
  onEdit: () => void
  onDelete: () => void
  onRemoveMember: (userId: number) => void
}) {
  return (
    <div className="border border-black/10 rounded-xl p-4 bg-white">
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

// 미배정 학생 패널
function UnassignedPanel({
  students,
  teams,
  onAssign,
}: {
  students: TeamMember[]
  teams: TeamInfo[]
  onAssign: (userIds: number[], teamId: number) => void
}) {
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
    setTargetTeam(null)
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
              className="w-4 h-4 rounded border-gray-300 text-[#534AB7] focus:ring-[#534AB7]"
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
          <span className="text-xs text-gray-500 whitespace-nowrap">선택한 학생 배정:</span>
          <select
            className="flex-1 text-sm border border-black/15 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[#534AB7]/15 focus:border-[#AFA9EC]"
            value={targetTeam || ''}
            onChange={(e) => setTargetTeam(Number(e.target.value) || null)}
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

// 팀 생성/수정 모달
function TeamFormModal({
  open,
  onClose,
  editingTeam,
  classId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  editingTeam?: TeamInfo | null
  classId: number
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const { createTeam, updateTeam } = useAdminStore()
  const toast = useToast()

  useEffect(() => {
    if (editingTeam) {
      setName(editingTeam.name)
    } else {
      setName('')
    }
  }, [editingTeam, open])

  const handleSubmit = async () => {
    if (!name.trim()) return

    setLoading(true)
    try {
      if (editingTeam) {
        await updateTeam(editingTeam.id, name.trim())
        toast.success('팀 이름이 수정되었습니다.')
      } else {
        await createTeam(classId, name.trim())
        toast.success('팀이 생성되었습니다.')
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
      title={editingTeam ? '팀 수정' : '팀 추가'}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">팀 이름</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 1모둠, A팀"
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
            {editingTeam ? '수정' : '추가'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 삭제 확인 모달
function DeleteTeamModal({
  open,
  onClose,
  team,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  team: TeamInfo | null
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
    <Modal open={open} onClose={onClose} title="팀 삭제">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">"{team?.name}"</span> 팀을 삭제하시겠습니까?
        </p>
        {team && team.members.length > 0 && (
          <p className="text-xs text-[#993C1D] bg-[#FAECE7] p-3 rounded-lg">
            소속된 {team.members.length}명의 학생은 미배정 상태가 됩니다.
          </p>
        )}

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

// 팀원 제거 확인 모달
function RemoveMemberModal({
  open,
  onClose,
  member,
  teamName,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  member: TeamMember | null
  teamName: string
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
    <Modal open={open} onClose={onClose} title="팀원 제거">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{member?.name}</span>
          을(를) <span className="font-medium text-gray-900">{teamName}</span>에서 제거하시겠습니까?
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={loading}
          >
            제거
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 팀 관리 페이지
export function AdminTeams() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const {
    classes,
    teams,
    unassignedStudents,
    isLoading,
    error,
    fetchClasses,
    fetchTeams,
    deleteTeam,
    assignMembers,
    removeMember,
    clearError,
  } = useAdminStore()
  const toast = useToast()

  const [showFormModal, setShowFormModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamInfo | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<TeamInfo | null>(null)
  const [removingMember, setRemovingMember] = useState<{
    member: TeamMember
    team: TeamInfo
  } | null>(null)

  const currentClass = classes.find((c) => c.id === Number(classId))

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  useEffect(() => {
    if (classId) {
      fetchTeams(Number(classId))
    }
  }, [classId, fetchTeams])

  const handleRefetch = () => {
    if (classId) {
      fetchTeams(Number(classId))
    }
  }

  const handleEdit = (team: TeamInfo) => {
    setEditingTeam(team)
    setShowFormModal(true)
  }

  const handleDeleteClick = (team: TeamInfo) => {
    setDeletingTeam(team)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTeam) return
    try {
      await deleteTeam(deletingTeam.id)
      toast.success('팀이 삭제되었습니다.')
      setDeletingTeam(null)
      handleRefetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const handleRemoveMemberClick = (member: TeamMember, team: TeamInfo) => {
    setRemovingMember({ member, team })
  }

  const handleRemoveMemberConfirm = async () => {
    if (!removingMember) return
    try {
      await removeMember(removingMember.team.id, removingMember.member.id)
      toast.success('팀원이 제거되었습니다.')
      setRemovingMember(null)
      handleRefetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '제거에 실패했습니다.')
    }
  }

  const handleAssign = async (userIds: number[], teamId: number) => {
    try {
      await assignMembers(teamId, userIds)
      toast.success(`${userIds.length}명의 학생이 배정되었습니다.`)
      handleRefetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '배정에 실패했습니다.')
    }
  }

  const handleCloseFormModal = () => {
    setShowFormModal(false)
    setEditingTeam(null)
  }

  if (error) {
    return (
      <ErrorState
        title="팀 목록을 불러올 수 없습니다"
        description={error}
        onRetry={() => {
          clearError()
          handleRefetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/classes')}>
            <ChevronLeft size={16} />
          </Button>
          <h1 className="text-lg font-medium">
            {currentClass?.name || '반'} 팀 관리
          </h1>
        </div>
        <Button variant="primary" onClick={() => setShowFormModal(true)}>
          <Plus size={16} />
          팀 추가
        </Button>
      </div>

      {/* 팀 목록 + 미배정 학생 */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="border border-black/10 rounded-xl p-4">
                <Skeleton className="h-4 w-1/3 mb-3" />
                <Skeleton className="h-10 mb-2" />
                <Skeleton className="h-10 mb-2" />
                <Skeleton className="h-10" />
              </div>
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 팀 목록 */}
          <div className="lg:col-span-2">
            {teams.length === 0 ? (
              <EmptyState
                icon={Users}
                message="등록된 팀이 없습니다"
                action={
                  <Button variant="primary" onClick={() => setShowFormModal(true)}>
                    <Plus size={16} />
                    팀 추가
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onEdit={() => handleEdit(team)}
                    onDelete={() => handleDeleteClick(team)}
                    onRemoveMember={(userId) => {
                      const member = team.members.find((m) => m.id === userId)
                      if (member) {
                        handleRemoveMemberClick(member, team)
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 미배정 학생 패널 */}
          <div>
            <UnassignedPanel
              students={unassignedStudents}
              teams={teams}
              onAssign={handleAssign}
            />
          </div>
        </div>
      )}

      {/* 모달 */}
      <TeamFormModal
        open={showFormModal}
        onClose={handleCloseFormModal}
        editingTeam={editingTeam}
        classId={Number(classId)}
        onSuccess={handleRefetch}
      />

      <DeleteTeamModal
        open={!!deletingTeam}
        onClose={() => setDeletingTeam(null)}
        team={deletingTeam}
        onConfirm={handleDeleteConfirm}
      />

      <RemoveMemberModal
        open={!!removingMember}
        onClose={() => setRemovingMember(null)}
        member={removingMember?.member || null}
        teamName={removingMember?.team.name || ''}
        onConfirm={handleRemoveMemberConfirm}
      />
    </div>
  )
}
