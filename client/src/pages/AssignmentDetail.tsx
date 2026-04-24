import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight, Users, Trash2 } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api, apiPost, apiDelete } from '../lib/api'
import {
  Card,
  Badge,
  Button,
  Modal,
  QuestionCardAnswer,
  TeamBanner,
  BlockedState,
  SubmitBar,
  CardSkeleton,
  ErrorState,
  useToast,
} from '../components/ui'
import type {
  AssignmentDetailResponse,
  Answer,
  SubmitResponse,
} from '../types/assignment'

export function AssignmentDetail() {
  const { classId, assignmentId } = useParams<{
    classId: string
    assignmentId: string
  }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const isTeacher = user?.role === 'teacher'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AssignmentDetailResponse | null>(null)

  // 답변 상태 (학생용)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [_saving, setSaving] = useState(false)

  // 팀원 정보 (팀 과제인 경우)
  const [teamMembers, setTeamMembers] = useState<string[]>([])

  // 데이터 로드
  useEffect(() => {
    if (!assignmentId) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await api<AssignmentDetailResponse>(
          `/assignments/${assignmentId}`
        )
        setData(result)

        // 기존 답변 로드
        if (result.answers) {
          const answerMap: Record<number, string> = {}
          for (const ans of result.answers) {
            answerMap[ans.question_id] = ans.answer_text
          }
          setAnswers(answerMap)
        }

        // 팀원 정보 로드 (팀 과제인 경우)
        if (result.assignment.scope === 'team' && user?.team_id) {
          try {
            const teamData = await api<{ team: { members: { name: string }[] } }>(
              `/teams/${user.team_id}`
            )
            setTeamMembers(teamData.team.members.map((m) => m.name))
          } catch {
            // 팀 정보 로드 실패 시 무시
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '과제를 불러올 수 없습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [assignmentId, user?.team_id])

  // 자동 임시저장 (디바운스 2초)
  useEffect(() => {
    if (!isDirty || isTeacher || !data) return

    const timer = setTimeout(async () => {
      await handleSaveDraft(true)
    }, 2000)

    return () => clearTimeout(timer)
  }, [answers, isDirty, isTeacher, data])

  // 답변 변경 핸들러
  const handleAnswerChange = useCallback(
    (questionId: number, value: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }))
      setIsDirty(true)
    },
    []
  )

  // 객관식 답변 변경 핸들러
  const handleOptionsChange = useCallback(
    (questionId: number, selected: string[]) => {
      // 단일 선택인 경우 첫 번째 값만, 복수 선택인 경우 JSON
      const question = data?.questions.find((q) => q.id === questionId)
      const value =
        question?.options && selected.length > 1
          ? JSON.stringify(selected)
          : selected[0] || ''
      setAnswers((prev) => ({ ...prev, [questionId]: value }))
      setIsDirty(true)
    },
    [data?.questions]
  )

  // 임시저장
  const handleSaveDraft = async (silent = false) => {
    if (!data || isTeacher) return

    setSaving(true)
    try {
      const answerArray: Answer[] = Object.entries(answers).map(
        ([qId, text]) => ({
          question_id: parseInt(qId),
          answer_text: text,
        })
      )

      await apiPost<SubmitResponse>(`/assignments/${assignmentId}/draft`, {
        answers: answerArray,
      })

      setIsDirty(false)
      if (!silent) {
        toast.success('임시저장되었습니다.')
      }
    } catch (err) {
      if (!silent) {
        toast.error(
          err instanceof Error ? err.message : '임시저장에 실패했습니다.'
        )
      }
    } finally {
      setSaving(false)
    }
  }

  // 최종 제출
  const handleSubmit = async () => {
    if (!data || isTeacher) return

    setSubmitting(true)
    try {
      const answerArray: Answer[] = Object.entries(answers).map(
        ([qId, text]) => ({
          question_id: parseInt(qId),
          answer_text: text,
        })
      )

      await apiPost<SubmitResponse>(`/assignments/${assignmentId}/submit`, {
        answers: answerArray,
      })

      toast.success('과제가 제출되었습니다.')
      setIsDirty(false)

      // 데이터 새로고침
      const result = await api<AssignmentDetailResponse>(
        `/assignments/${assignmentId}`
      )
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '제출에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // 필수 항목 완료 여부
  const requiredProgress = useMemo(() => {
    if (!data) return { completed: 0, total: 0 }

    const requiredQuestions = data.questions.filter((q) => q.required)
    const completed = requiredQuestions.filter((q) => {
      const answer = answers[q.id]
      if (q.question_type === 'file') {
        // 파일은 별도 처리 필요
        return false
      }
      return answer?.trim().length > 0
    }).length

    return { completed, total: requiredQuestions.length }
  }, [data, answers])

  const canSubmit = requiredProgress.completed === requiredProgress.total

  // 마감 여부
  const isPastDue = useMemo(() => {
    if (!data?.assignment.due_at) return false
    return new Date() > new Date(data.assignment.due_at)
  }, [data?.assignment.due_at])

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
  if (error || !data) {
    return (
      <ErrorState
        title="과제를 불러올 수 없습니다"
        description={error || '알 수 없는 오류가 발생했습니다.'}
        onRetry={() => window.location.reload()}
      />
    )
  }

  const { assignment, questions, submission } = data

  // 팀 과제인데 팀이 없는 경우
  if (assignment.scope === 'team' && !user?.team_id && !isTeacher) {
    return (
      <div className="space-y-4">
        <TopBarSection
          title={assignment.title}
          onBack={() => navigate(-1)}
          status={submission?.status}
        />
        <BlockedState
          title="팀 배정이 필요합니다"
          description="팀 과제에 참여하려면 먼저 팀에 배정되어야 합니다. 선생님에게 문의하세요."
        />
      </div>
    )
  }

  // 교사 뷰 (제출 현황 페이지로 이동)
  if (isTeacher) {
    return <TeacherAssignmentView data={data} classId={classId!} />
  }

  // 학생 뷰
  return (
    <div className="flex flex-col min-h-screen">
      {/* 상단 바 */}
      <TopBarSection
        title={assignment.title}
        onBack={() => navigate(-1)}
        status={submission?.status}
      />

      {/* 본문 */}
      <div className="flex-1 p-4 pb-40">
        {/* 마감일 */}
        {assignment.due_at && (
          <div className="mb-4">
            <p
              className={`text-xs ${
                isPastDue ? 'text-[#993C1D] font-medium' : 'text-gray-500'
              }`}
            >
              마감: {new Date(assignment.due_at).toLocaleString('ko-KR')}
              {isPastDue && ' (마감됨)'}
            </p>
          </div>
        )}

        {/* 설명 */}
        {assignment.description && (
          <Card className="mb-4">
            <p className="text-xs text-gray-600 whitespace-pre-wrap">
              {assignment.description}
            </p>
          </Card>
        )}

        {/* 팀 배너 */}
        {assignment.scope === 'team' && user?.team_id && (
          <TeamBanner
            teamName={`${user.team_id}모둠`}
            members={teamMembers}
            note="팀원 누구나 수정 가능"
          />
        )}

        {/* 질문 목록 */}
        {questions.map((question, index) => (
          <QuestionCardAnswer
            key={question.id}
            index={index}
            type={question.question_type}
            body={question.body}
            required={question.required}
            options={question.options || undefined}
            multipleSelect={false}
            allowCamera={true}
            answerText={answers[question.id] || ''}
            answerOptions={parseAnswerOptions(answers[question.id])}
            onTextChange={(v) => handleAnswerChange(question.id, v)}
            onOptionsChange={(v) => handleOptionsChange(question.id, v)}
          />
        ))}

        {/* 피드백 */}
        {submission?.feedback && (
          <Card className="mt-4 border-[#AFA9EC] bg-[#EEEDFE]/30">
            <p className="text-xs font-medium text-[#3C3489] mb-1">
              선생님 피드백
            </p>
            <p className="text-xs text-gray-700 whitespace-pre-wrap">
              {submission.feedback}
            </p>
          </Card>
        )}
      </div>

      {/* 하단 제출 바 */}
      {!isPastDue && (
        <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white">
          <SubmitBar
            progress={{
              completed: requiredProgress.completed,
              total: requiredProgress.total,
            }}
            onSaveDraft={() => handleSaveDraft(false)}
            onSubmit={handleSubmit}
            canSubmit={canSubmit && !submitting}
            isResubmit={submission?.status === 'submitted'}
          />
        </div>
      )}
    </div>
  )
}

// 상단 바 섹션
function TopBarSection({
  title,
  onBack,
  status,
}: {
  title: string
  onBack: () => void
  status?: 'draft' | 'submitted' | null
}) {
  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-black/8 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="w-7 h-7 -ml-1 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
        </button>
        <h1 className="text-[15px] font-medium text-gray-900 truncate max-w-[200px]">
          {title}
        </h1>
      </div>
      <div>
        {status === 'submitted' && <Badge variant="teal">제출완료</Badge>}
        {status === 'draft' && <Badge variant="gray">임시저장</Badge>}
        {!status && <Badge variant="amber">미제출</Badge>}
      </div>
    </header>
  )
}

// 교사 과제 상세 뷰
function TeacherAssignmentView({
  data,
  classId,
}: {
  data: AssignmentDetailResponse
  classId: string
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const { assignment, questions } = data

  // 삭제 모달 상태
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 과제 삭제 핸들러
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiDelete(`/assignments/${assignment.id}`)
      toast.success('과제가 삭제되었습니다.')
      navigate(`/class/${classId}/assignments`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">{assignment.title}</h1>
          <p className="text-xs text-gray-500 mt-1">
            {assignment.scope === 'team' ? '팀 과제' : '개인 과제'} ·{' '}
            {questions.length}문항
            {assignment.due_at &&
              ` · 마감: ${new Date(assignment.due_at).toLocaleDateString('ko-KR')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 size={16} strokeWidth={1.5} className="text-[#993C1D]" />
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              navigate(`/class/${classId}/assignments/${assignment.id}/edit`)
            }
          >
            수정
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              navigate(
                `/class/${classId}/assignments/${assignment.id}/submissions`
              )
            }
          >
            <Users size={16} strokeWidth={1.5} />
            제출 현황
          </Button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="과제 삭제"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">"{assignment.title}"</span>
            {' '}과제를 삭제하시겠습니까?
          </p>
          <p className="text-xs text-[#993C1D] bg-[#FAECE7] p-3 rounded-lg">
            삭제된 과제는 복구할 수 없으며, 학생들의 모든 제출물도 함께 삭제됩니다.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              취소
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={deleting}
            >
              삭제
            </Button>
          </div>
        </div>
      </Modal>

      {/* 설명 */}
      {assignment.description && (
        <Card>
          <p className="text-xs text-gray-600 whitespace-pre-wrap">
            {assignment.description}
          </p>
        </Card>
      )}

      {/* 질문 미리보기 */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-400">질문 목록</p>
        {questions.map((q, i) => (
          <Card key={q.id}>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#534AB7] text-white text-[9px] font-medium flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-900">
                  {q.body}
                  {q.required && (
                    <span className="text-[#D85A30] ml-1">*</span>
                  )}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {q.question_type === 'essay' && '서술형'}
                  {q.question_type === 'short' && '단답형'}
                  {q.question_type === 'multiple_choice' && '객관식'}
                  {q.question_type === 'file' && '파일 첨부'}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// 객관식 답변 파싱
function parseAnswerOptions(answer?: string): string[] {
  if (!answer) return []
  try {
    const parsed = JSON.parse(answer)
    if (Array.isArray(parsed)) return parsed
    return [answer]
  } catch {
    return answer ? [answer] : []
  }
}

export default AssignmentDetail
