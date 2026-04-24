import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'
import {
  Tabs,
  Tab,
  AssignmentRow,
  EmptyState,
  CardSkeleton,
  ErrorState,
  Button,
} from '../components/ui'
import type { Assignment, AssignmentListResponse } from '../types/assignment'

type FilterTab = 'all' | 'individual' | 'team'

export function AssignmentList() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isTeacher = user?.role === 'teacher'

  const [filter, setFilter] = useState<FilterTab>('all')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!classId) return

    const fetchAssignments = async () => {
      setLoading(true)
      setError(null)

      try {
        const scope = filter === 'all' ? undefined : filter
        const query = scope ? `?scope=${scope}` : ''
        const data = await api<AssignmentListResponse>(
          `/classes/${classId}/assignments${query}`
        )
        setAssignments(data.assignments)
      } catch (err) {
        setError(err instanceof Error ? err.message : '과제를 불러올 수 없습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchAssignments()
  }, [classId, filter])

  const handleAssignmentClick = (assignmentId: number) => {
    if (isTeacher) {
      navigate(`/class/${classId}/assignments/${assignmentId}`)
    } else {
      navigate(`/class/${classId}/assignments/${assignmentId}`)
    }
  }

  const handleCreateClick = () => {
    navigate(`/class/${classId}/assignments/new`)
  }

  // 마감일 파싱
  const parseDueDate = (dueAt: string | null) => {
    if (!dueAt) return { date: '', time: '' }
    const d = new Date(dueAt)
    return {
      date: d.toISOString().split('T')[0],
      time: d.toTimeString().slice(0, 5),
    }
  }

  // 제출 상태 변환
  const getSubmissionStatus = (
    status: string | null | undefined
  ): 'submitted' | 'draft' | 'not_started' => {
    if (status === 'submitted') return 'submitted'
    if (status === 'draft') return 'draft'
    return 'not_started'
  }

  // 학생 뷰
  if (!isTeacher) {
    return (
      <div className="space-y-4">
        {/* 필터 탭 */}
        <Tabs value={filter} onChange={(v) => setFilter(v as FilterTab)}>
          <Tab value="all" label="전체" />
          <Tab value="individual" label="개인과제" />
          <Tab value="team" label="팀과제" />
        </Tabs>

        {/* 과제 목록 */}
        {loading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <ErrorState
            title="과제를 불러올 수 없습니다"
            description={error}
            onRetry={() => setFilter(filter)}
          />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={FileText}
            message={
              filter === 'all'
                ? '등록된 과제가 없습니다'
                : filter === 'individual'
                ? '개인 과제가 없습니다'
                : '팀 과제가 없습니다'
            }
          />
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => {
              const { date, time } = parseDueDate(assignment.due_at)
              return (
                <AssignmentRow
                  key={assignment.id}
                  title={assignment.title}
                  dueDate={date}
                  dueTime={time}
                  status={getSubmissionStatus(assignment.submission_status)}
                  questionCount={assignment.question_count}
                  isTeam={assignment.scope === 'team'}
                  onClick={() => handleAssignmentClick(assignment.id)}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // 교사 뷰
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">과제 목록</h1>
        <Button variant="primary" onClick={handleCreateClick}>
          <Plus size={16} strokeWidth={1.5} />
          과제 출제
        </Button>
      </div>

      {/* 필터 탭 */}
      <Tabs value={filter} onChange={(v) => setFilter(v as FilterTab)}>
        <Tab value="all" label="전체" />
        <Tab value="individual" label="개인과제" />
        <Tab value="team" label="팀과제" />
      </Tabs>

      {/* 과제 목록 */}
      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <ErrorState
          title="과제를 불러올 수 없습니다"
          description={error}
          onRetry={() => setFilter(filter)}
        />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={FileText}
          message={
            filter === 'all'
              ? '등록된 과제가 없습니다'
              : filter === 'individual'
              ? '개인 과제가 없습니다'
              : '팀 과제가 없습니다'
          }
          action={
            <Button variant="primary" size="sm" onClick={handleCreateClick}>
              첫 과제 출제하기
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {assignments.map((assignment) => {
            const { date, time } = parseDueDate(assignment.due_at)
            return (
              <TeacherAssignmentRow
                key={assignment.id}
                assignment={assignment}
                date={date}
                time={time}
                onClick={() => handleAssignmentClick(assignment.id)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// 교사용 과제 행 컴포넌트
function TeacherAssignmentRow({
  assignment,
  date,
  time,
  onClick,
}: {
  assignment: Assignment
  date: string
  time: string
  onClick: () => void
}) {
  // 마감 임박 여부 (24시간 이내)
  const isUrgent = (() => {
    if (!assignment.due_at) return false
    const due = new Date(assignment.due_at)
    const now = new Date()
    const diff = due.getTime() - now.getTime()
    return diff > 0 && diff < 24 * 60 * 60 * 1000
  })()

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-xl border border-black/10
        bg-white hover:bg-[#F7F6F3] transition-colors text-left"
    >
      {/* 아이콘 */}
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
        ${assignment.scope === 'team' ? 'bg-[#E1F5EE]' : 'bg-[#EEEDFE]'}`}
      >
        <FileText
          size={18}
          strokeWidth={1.5}
          className={
            assignment.scope === 'team' ? 'text-[#0F6E56]' : 'text-[#534AB7]'
          }
        />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {assignment.title}
          </p>
          {assignment.scope === 'team' && (
            <span className="text-[10px] text-[#0F6E56] bg-[#E1F5EE] px-1.5 py-0.5 rounded-full">
              팀
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {date && (
            <span
              className={`text-[11px] ${
                isUrgent ? 'text-[#993C1D] font-medium' : 'text-gray-400'
              }`}
            >
              마감: {date} {time}
            </span>
          )}
          <span className="text-[11px] text-gray-400">
            {assignment.question_count}문항
          </span>
        </div>
      </div>

      {/* 제출 통계 (교사 뷰에서는 별도 API 필요, 여기서는 placeholder) */}
      <div className="text-right">
        <p className="text-[10px] text-gray-400">출제자</p>
        <p className="text-xs text-gray-600">{assignment.author.name}</p>
      </div>
    </button>
  )
}

export default AssignmentList
