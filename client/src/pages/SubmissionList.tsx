import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight, FileText, Users } from 'lucide-react'
import { api } from '../lib/api'
import {
  Badge,
  Card,
  MetricCard,
  Table,
  TableHeader,
  TableRow,
  Tabs,
  Tab,
  CardSkeleton,
  ErrorState,
  EmptyState,
  useToast,
} from '../components/ui'
import type { SubmissionsResponse, AssignmentDetailResponse } from '../types/assignment'

type FilterTab = 'all' | 'submitted' | 'draft' | 'not_started'

export function SubmissionList() {
  const { classId, assignmentId } = useParams<{
    classId: string
    assignmentId: string
  }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignment, setAssignment] = useState<AssignmentDetailResponse['assignment'] | null>(null)
  const [data, setData] = useState<SubmissionsResponse | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')

  // 데이터 로드
  useEffect(() => {
    if (!assignmentId) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // 과제 정보와 제출 현황 동시 로드
        const [assignmentRes, submissionsRes] = await Promise.all([
          api<AssignmentDetailResponse>(`/assignments/${assignmentId}`),
          api<SubmissionsResponse>(`/assignments/${assignmentId}/submissions`),
        ])

        setAssignment(assignmentRes.assignment)
        setData(submissionsRes)
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러올 수 없습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [assignmentId])

  // 필터된 제출물 목록
  const filteredSubmissions = useMemo(() => {
    if (!data) return []

    if (filter === 'all') return data.submissions
    if (filter === 'submitted') {
      return data.submissions.filter((s) => s.status === 'submitted')
    }
    if (filter === 'draft') {
      return data.submissions.filter((s) => s.status === 'draft')
    }
    return []
  }, [data, filter])

  // 로딩 상태
  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  // 에러 상태
  if (error || !data || !assignment) {
    return (
      <ErrorState
        title="제출 현황을 불러올 수 없습니다"
        description={error || '알 수 없는 오류가 발생했습니다.'}
        onRetry={() => window.location.reload()}
      />
    )
  }

  const { stats } = data

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/class/${classId}/assignments/${assignmentId}`)}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
          </button>
          <div>
            <h1 className="text-lg font-medium">{assignment.title}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {assignment.scope === 'team' ? '팀 과제' : '개인 과제'} 제출 현황
            </p>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard value={stats.total} label="전체" />
        <MetricCard value={stats.submitted} label="제출완료" highlight="success" />
        <MetricCard value={stats.draft} label="임시저장" />
        <MetricCard value={stats.not_started} label="미제출" highlight="danger" />
      </div>

      {/* 필터 탭 */}
      <Tabs value={filter} onChange={(v) => setFilter(v as FilterTab)}>
        <Tab value="all" label={`전체 (${data.submissions.length})`} />
        <Tab value="submitted" label={`제출완료 (${stats.submitted})`} />
        <Tab value="draft" label={`임시저장 (${stats.draft})`} />
        <Tab value="not_started" label={`미제출 (${stats.not_started})`} />
      </Tabs>

      {/* 제출물 테이블 */}
      {filter === 'not_started' ? (
        <NotStartedList
          assignmentId={Number(assignmentId)}
          scope={assignment.scope}
          classId={assignment.class_id}
          submissions={data.submissions}
        />
      ) : filteredSubmissions.length === 0 ? (
        <EmptyState
          icon={FileText}
          message={
            filter === 'all'
              ? '아직 제출된 과제가 없습니다.'
              : filter === 'submitted'
              ? '제출 완료된 과제가 없습니다.'
              : '임시저장된 과제가 없습니다.'
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader
              columns={
                assignment.scope === 'team'
                  ? ['팀', '제출자', '상태', '제출일', '피드백', '']
                  : ['이름', '상태', '제출일', '피드백', '']
              }
              widths={
                assignment.scope === 'team'
                  ? ['15%', '15%', '15%', '20%', '15%', '20%']
                  : ['20%', '15%', '25%', '15%', '25%']
              }
            />
            <tbody>
              {filteredSubmissions.map((submission) => (
                <SubmissionRow
                  key={submission.id}
                  submission={submission}
                  isTeamAssignment={assignment.scope === 'team'}
                  classId={classId!}
                  assignmentId={assignmentId!}
                  onPublish={async () => {
                    try {
                      await api(`/submissions/${submission.id}/publish`, {
                        method: 'POST',
                      })
                      toast.success('제출물이 공개되었습니다.')
                      // 데이터 새로고침
                      const newData = await api<SubmissionsResponse>(
                        `/assignments/${assignmentId}/submissions`
                      )
                      setData(newData)
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : '공개에 실패했습니다.'
                      )
                    }
                  }}
                />
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}

// 제출물 행 컴포넌트
function SubmissionRow({
  submission,
  isTeamAssignment,
  classId,
  assignmentId,
  onPublish,
}: {
  submission: SubmissionsResponse['submissions'][0]
  isTeamAssignment: boolean
  classId: string
  assignmentId: string
  onPublish: () => void
}) {
  const navigate = useNavigate()

  const statusBadge = submission.status === 'submitted' ? (
    <Badge variant="teal">제출완료</Badge>
  ) : (
    <Badge variant="gray">임시저장</Badge>
  )

  const feedbackBadge = submission.has_feedback ? (
    <Badge variant="purple">작성됨</Badge>
  ) : (
    <span className="text-[10px] text-gray-400">-</span>
  )

  const submittedAt = submission.submitted_at
    ? new Date(submission.submitted_at).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'

  const actions = [
    {
      label: '보기',
      onClick: () =>
        navigate(
          `/class/${classId}/assignments/${assignmentId}/submissions/${submission.id}`
        ),
    },
  ]

  // 제출 완료되고 아직 공개 안 된 경우만 공개 버튼 표시
  if (submission.status === 'submitted' && !submission.is_published) {
    actions.push({
      label: '공개',
      onClick: onPublish,
    })
  }

  const cells = isTeamAssignment
    ? [
        <span className="text-xs font-medium text-gray-900">
          {submission.team?.name || '-'}
        </span>,
        <span className="text-xs text-gray-600">{submission.submitter.name}</span>,
        statusBadge,
        <span className="text-xs text-gray-500">{submittedAt}</span>,
        feedbackBadge,
      ]
    : [
        <span className="text-xs font-medium text-gray-900">
          {submission.submitter.name}
        </span>,
        statusBadge,
        <span className="text-xs text-gray-500">{submittedAt}</span>,
        feedbackBadge,
      ]

  return (
    <TableRow
      cells={cells}
      actions={actions}
      onClick={() =>
        navigate(
          `/class/${classId}/assignments/${assignmentId}/submissions/${submission.id}`
        )
      }
    />
  )
}

// 미제출자 목록 (별도 API 호출 필요 없이 기존 데이터로 계산 어려움 - 간소화 버전)
function NotStartedList({
  scope,
}: {
  assignmentId: number
  scope: 'individual' | 'team'
  classId: number | null
  submissions: SubmissionsResponse['submissions']
}) {
  return (
    <div className="py-8 text-center">
      <Users size={32} strokeWidth={1} className="mx-auto mb-3 text-gray-300" />
      <p className="text-sm text-gray-500 mb-2">
        {scope === 'team' ? '아직 제출하지 않은 팀이 있습니다.' : '아직 제출하지 않은 학생이 있습니다.'}
      </p>
      <p className="text-xs text-gray-400">
        제출을 완료하면 이 목록에서 사라집니다.
      </p>
    </div>
  )
}

export default SubmissionList
