import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, AlignLeft, List, Upload } from 'lucide-react'
import { api, apiPost, apiPut } from '../lib/api'
import {
  Card,
  Button,
  Input,
  Textarea,
  QuestionCardEdit,
  CardSkeleton,
  ErrorState,
  useToast,
} from '../components/ui'
import type {
  QuestionType,
  AssignmentScope,
  AssignmentCreateRequest,
  AssignmentCreateResponse,
  AssignmentDetailResponse,
} from '../types/assignment'

interface QuestionData {
  id?: number
  tempId: string
  question_type: QuestionType
  body: string
  options: string[]
  required: boolean
}

export function AssignmentForm() {
  const { classId, assignmentId } = useParams<{
    classId: string
    assignmentId?: string
  }>()
  const navigate = useNavigate()
  const toast = useToast()
  const isEdit = !!assignmentId

  // 폼 상태
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<AssignmentScope>('individual')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('23:59')
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null)

  // 로딩/제출 상태
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 반 목록 (전체 반 선택용)
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(
    classId ? parseInt(classId) : null
  )

  // 데이터 로드 (수정 모드)
  useEffect(() => {
    if (!isEdit) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await api<AssignmentDetailResponse>(
          `/assignments/${assignmentId}`
        )
        const { assignment, questions: loadedQuestions } = result

        setTitle(assignment.title)
        setDescription(assignment.description)
        setScope(assignment.scope)
        setSelectedClassId(assignment.class_id)

        if (assignment.due_at) {
          const d = new Date(assignment.due_at)
          setDueDate(d.toISOString().split('T')[0])
          setDueTime(d.toTimeString().slice(0, 5))
        }

        setQuestions(
          loadedQuestions.map((q) => ({
            id: q.id,
            tempId: `q-${q.id}`,
            question_type: q.question_type,
            body: q.body,
            options: q.options || [],
            required: q.required,
          }))
        )
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '과제를 불러올 수 없습니다.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isEdit, assignmentId])

  // 반 목록 로드
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const result = await api<{ classes: { id: number; name: string }[] }>(
          '/classes'
        )
        setClasses(result.classes)
      } catch {
        // 무시
      }
    }
    fetchClasses()
  }, [])

  // 질문 추가
  const addQuestion = (type: QuestionType) => {
    const tempId = `q-${Date.now()}`
    const newQuestion: QuestionData = {
      tempId,
      question_type: type,
      body: '',
      options: type === 'multiple_choice' ? ['보기 1', '보기 2'] : [],
      required: true,
    }
    setQuestions([...questions, newQuestion])
    setFocusedQuestionId(tempId)
  }

  // 질문 업데이트
  const updateQuestion = (
    tempId: string,
    updates: Partial<QuestionData>
  ) => {
    setQuestions(
      questions.map((q) => (q.tempId === tempId ? { ...q, ...updates } : q))
    )
  }

  // 질문 삭제
  const deleteQuestion = (tempId: string) => {
    setQuestions(questions.filter((q) => q.tempId !== tempId))
  }

  // 질문 이동
  const moveQuestion = (tempId: string, direction: -1 | 1) => {
    const index = questions.findIndex((q) => q.tempId === tempId)
    if (
      (direction === -1 && index === 0) ||
      (direction === 1 && index === questions.length - 1)
    ) {
      return
    }

    const newQuestions = [...questions]
    const temp = newQuestions[index]
    newQuestions[index] = newQuestions[index + direction]
    newQuestions[index + direction] = temp
    setQuestions(newQuestions)
  }

  // 제출
  const handleSubmit = async () => {
    // 검증
    if (!title.trim()) {
      toast.error('과제 제목을 입력하세요.')
      return
    }

    if (questions.length === 0) {
      toast.error('최소 1개의 질문을 추가하세요.')
      return
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].body.trim()) {
        toast.error(`질문 ${i + 1}의 내용을 입력하세요.`)
        return
      }
      if (
        questions[i].question_type === 'multiple_choice' &&
        questions[i].options.length < 2
      ) {
        toast.error(`질문 ${i + 1}은 최소 2개의 선택지가 필요합니다.`)
        return
      }
    }

    setSubmitting(true)

    try {
      // 마감일 조합
      let dueAt: string | null = null
      if (dueDate) {
        dueAt = `${dueDate}T${dueTime || '23:59'}:00`
      }

      const payload: AssignmentCreateRequest = {
        title: title.trim(),
        description: description.trim(),
        scope,
        class_id: selectedClassId,
        due_at: dueAt,
        questions: questions.map((q, i) => ({
          question_type: q.question_type,
          body: q.body.trim(),
          options: q.question_type === 'multiple_choice' ? q.options : undefined,
          required: q.required,
          order_num: i + 1,
        })),
      }

      if (isEdit) {
        await apiPut<AssignmentCreateResponse>(
          `/assignments/${assignmentId}`,
          payload
        )
        toast.success('과제가 수정되었습니다.')
      } else {
        await apiPost<AssignmentCreateResponse>('/assignments', payload)
        toast.success('과제가 출제되었습니다.')
      }

      navigate(`/class/${classId}/assignments`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : '과제 저장에 실패했습니다.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // 로딩 상태
  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <ErrorState
        title="과제를 불러올 수 없습니다"
        description={error}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6">
      {/* 메인 폼 */}
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">
            {isEdit ? '과제 수정' : '과제 출제'}
          </h1>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
            >
              {isEdit ? '수정하기' : '출제하기'}
            </Button>
          </div>
        </div>

        {/* 기본 정보 */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">제목</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="과제 제목을 입력하세요"
                filled={!!title}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                설명 (선택)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="과제에 대한 설명을 입력하세요"
                rows={3}
                filled={!!description}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  과제 유형
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as AssignmentScope)}
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm
                    outline-none focus:border-[#AFA9EC] focus:ring-2 focus:ring-[#534AB7]/15"
                >
                  <option value="individual">개인 과제</option>
                  <option value="team">팀 과제</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  대상 반
                </label>
                <select
                  value={selectedClassId ?? ''}
                  onChange={(e) =>
                    setSelectedClassId(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-sm
                    outline-none focus:border-[#AFA9EC] focus:ring-2 focus:ring-[#534AB7]/15"
                >
                  <option value="">전체 반</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  마감일 (선택)
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  마감 시간
                </label>
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* 질문 목록 */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500">질문 목록</p>

          {questions.map((q, index) => (
            <QuestionCardEdit
              key={q.tempId}
              index={index}
              type={q.question_type}
              body={q.body}
              required={q.required}
              options={q.options}
              focused={focusedQuestionId === q.tempId}
              onTypeChange={(type) => {
                const updates: Partial<QuestionData> = { question_type: type }
                if (type === 'multiple_choice' && q.options.length < 2) {
                  updates.options = ['보기 1', '보기 2']
                }
                updateQuestion(q.tempId, updates)
              }}
              onBodyChange={(body) => updateQuestion(q.tempId, { body })}
              onRequiredChange={(required) =>
                updateQuestion(q.tempId, { required })
              }
              onOptionsChange={(options) =>
                updateQuestion(q.tempId, { options })
              }
              onMoveUp={() => moveQuestion(q.tempId, -1)}
              onMoveDown={() => moveQuestion(q.tempId, 1)}
              onDelete={() => deleteQuestion(q.tempId)}
            />
          ))}
        </div>

        {/* 질문 추가 버튼 */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addQuestion('essay')}
          >
            <AlignLeft size={14} strokeWidth={1.5} />
            서술형
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addQuestion('short')}
          >
            <FileText size={14} strokeWidth={1.5} />
            단답형
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addQuestion('multiple_choice')}
          >
            <List size={14} strokeWidth={1.5} />
            객관식
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => addQuestion('file')}
          >
            <Upload size={14} strokeWidth={1.5} />
            파일 첨부
          </Button>
        </div>
      </div>

      {/* 사이드바: 요약 */}
      <div className="hidden lg:block">
        <div className="sticky top-4">
          <Card>
            <p className="text-xs font-medium text-gray-900 mb-3">과제 요약</p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">질문 수</span>
                <span className="font-medium">{questions.length}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">필수 질문</span>
                <span className="font-medium">
                  {questions.filter((q) => q.required).length}개
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">과제 유형</span>
                <span className="font-medium">
                  {scope === 'team' ? '팀 과제' : '개인 과제'}
                </span>
              </div>
              {dueDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">마감일</span>
                  <span className="font-medium">
                    {dueDate} {dueTime}
                  </span>
                </div>
              )}
            </div>

            <hr className="my-3 border-black/8" />

            <p className="text-xs font-medium text-gray-900 mb-2">
              체크리스트
            </p>
            <div className="space-y-1.5 text-xs">
              <ChecklistItem
                checked={!!title.trim()}
                label="제목 입력"
              />
              <ChecklistItem
                checked={questions.length > 0}
                label="질문 1개 이상"
              />
              <ChecklistItem
                checked={questions.every((q) => q.body.trim())}
                label="모든 질문 내용 입력"
              />
              <ChecklistItem checked={!!dueDate} label="마감일 설정" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ChecklistItem({
  checked,
  label,
}: {
  checked: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-4 h-4 rounded flex items-center justify-center text-[10px]
          ${checked ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-gray-100 text-gray-400'}`}
      >
        {checked ? '✓' : ''}
      </span>
      <span className={checked ? 'text-gray-700' : 'text-gray-400'}>
        {label}
      </span>
    </div>
  )
}

export default AssignmentForm
