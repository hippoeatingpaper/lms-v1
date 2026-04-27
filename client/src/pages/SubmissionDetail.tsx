import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight, Users, Share2, MessageSquare, Check, EyeOff, Download, FileText, Image, Film, File } from 'lucide-react'
import { api, apiPatch, apiPost, apiDelete } from '../lib/api'
import {
  Badge,
  Button,
  Card,
  Textarea,
  AvatarGroup,
  CardSkeleton,
  ErrorState,
  Modal,
  useToast,
} from '../components/ui'
import type { SubmissionDetailResponse, QuestionType, AttachedFile } from '../types/assignment'

export function SubmissionDetail() {
  const { classId, assignmentId, submissionId } = useParams<{
    classId: string
    assignmentId: string
    submissionId: string
  }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SubmissionDetailResponse | null>(null)

  // 피드백 관련 상태
  const [feedback, setFeedback] = useState('')
  const [feedbackDirty, setFeedbackDirty] = useState(false)
  const [savingFeedback, setSavingFeedback] = useState(false)

  // 공개 모달
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)

  // 데이터 로드
  useEffect(() => {
    if (!submissionId) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await api<SubmissionDetailResponse>(
          `/submissions/${submissionId}`
        )
        setData(result)
        setFeedback(result.submission.feedback || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : '제출물을 불러올 수 없습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [submissionId])

  // 피드백 저장
  const handleSaveFeedback = async () => {
    if (!submissionId) return

    setSavingFeedback(true)
    try {
      await apiPatch(`/submissions/${submissionId}/feedback`, { feedback })
      setFeedbackDirty(false)
      toast.success('피드백이 저장되었습니다.')

      // 데이터 새로고침
      const result = await api<SubmissionDetailResponse>(
        `/submissions/${submissionId}`
      )
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '피드백 저장에 실패했습니다.')
    } finally {
      setSavingFeedback(false)
    }
  }

  // 제출물 공개
  const handlePublish = async () => {
    if (!submissionId) return

    setPublishing(true)
    try {
      await apiPost(`/submissions/${submissionId}/publish`)
      toast.success('제출물이 게시판에 공개되었습니다.')
      setShowPublishModal(false)

      // 데이터 새로고침
      const result = await api<SubmissionDetailResponse>(
        `/submissions/${submissionId}`
      )
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '공개에 실패했습니다.')
    } finally {
      setPublishing(false)
    }
  }

  // 제출물 비공개
  const handleUnpublish = async () => {
    if (!submissionId) return

    setUnpublishing(true)
    try {
      await apiDelete(`/submissions/${submissionId}/publish`)
      toast.success('제출물이 비공개로 전환되었습니다.')

      // 데이터 새로고침
      const result = await api<SubmissionDetailResponse>(
        `/submissions/${submissionId}`
      )
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '비공개 전환에 실패했습니다.')
    } finally {
      setUnpublishing(false)
    }
  }

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
        title="제출물을 불러올 수 없습니다"
        description={error || '알 수 없는 오류가 발생했습니다.'}
        onRetry={() => window.location.reload()}
      />
    )
  }

  const { submission, assignment, questions } = data

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              navigate(`/class/${classId}/assignments/${assignmentId}/submissions`)
            }
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-medium">{assignment.title}</h1>
              {submission.status === 'submitted' ? (
                <Badge variant="teal">제출완료</Badge>
              ) : (
                <Badge variant="gray">임시저장</Badge>
              )}
              {submission.is_published && (
                <Badge variant="purple">공개됨</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {submission.team
                ? `${submission.team.name} - ${submission.submitter.name}`
                : submission.submitter.name}
              {submission.submitted_at &&
                ` | ${new Date(submission.submitted_at).toLocaleString('ko-KR')}`}
            </p>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          {submission.status === 'submitted' && !submission.is_published && (
            <Button variant="secondary" onClick={() => setShowPublishModal(true)}>
              <Share2 size={14} strokeWidth={1.5} />
              게시판 공개
            </Button>
          )}
          {submission.is_published && (
            <Button
              variant="secondary"
              onClick={handleUnpublish}
              loading={unpublishing}
              disabled={unpublishing}
            >
              <EyeOff size={14} strokeWidth={1.5} />
              비공개로 전환
            </Button>
          )}
        </div>
      </div>

      {/* 팀 정보 (팀 과제인 경우) */}
      {submission.team && (
        <Card className="bg-[#E1F5EE]/50 border-[#9FE1CB]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#9FE1CB] flex items-center justify-center">
              <Users size={16} strokeWidth={1.5} className="text-[#085041]" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-[#085041]">
                {submission.team.name}
              </p>
              <p className="text-[10px] text-[#0F6E56] mt-0.5">
                팀원: {submission.team.members.map((m) => m.name).join(', ')}
              </p>
            </div>
            <AvatarGroup
              names={submission.team.members.map((m) => m.name)}
              max={4}
              size="sm"
            />
          </div>
        </Card>
      )}

      {/* 질문 및 답변 */}
      <div className="space-y-4">
        <p className="text-[10px] font-medium text-gray-400 tracking-wider">
          답변 내용
        </p>
        {questions.map((question, index) => (
          <QuestionAnswerCard key={question.id} question={question} index={index} />
        ))}
      </div>

      {/* 피드백 영역 */}
      <Card className="border-[#AFA9EC]">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={16} strokeWidth={1.5} className="text-[#534AB7]" />
          <p className="text-sm font-medium text-[#3C3489]">피드백</p>
          {submission.feedback && !feedbackDirty && (
            <Badge variant="teal">저장됨</Badge>
          )}
          {feedbackDirty && <Badge variant="amber">수정됨</Badge>}
        </div>

        <Textarea
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value)
            setFeedbackDirty(e.target.value !== (submission.feedback || ''))
          }}
          placeholder="학생에게 전달할 피드백을 작성하세요..."
          rows={4}
          filled={!!feedback}
        />

        <div className="flex justify-end mt-3">
          <Button
            variant="primary"
            onClick={handleSaveFeedback}
            loading={savingFeedback}
            disabled={!feedbackDirty || savingFeedback}
          >
            <Check size={14} strokeWidth={1.5} />
            피드백 저장
          </Button>
        </div>
      </Card>

      {/* 공개 확인 모달 */}
      <Modal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        title="제출물 공개"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">
              {submission.team
                ? `${submission.team.name}의`
                : `${submission.submitter.name}의`}
            </span>{' '}
            제출물을 게시판에 공개하시겠습니까?
          </p>
          <div className="bg-[#EEEDFE] p-3 rounded-lg">
            <p className="text-xs text-[#3C3489]">
              공개된 제출물은 해당 반의 모든 학생이 볼 수 있습니다.
              {feedback && ' 작성하신 피드백도 함께 공개됩니다.'}
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowPublishModal(false)}
              disabled={publishing}
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handlePublish}
              loading={publishing}
              disabled={publishing}
            >
              <Share2 size={14} strokeWidth={1.5} />
              공개하기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// 질문 + 답변 카드
function QuestionAnswerCard({
  question,
  index,
}: {
  question: SubmissionDetailResponse['questions'][0]
  index: number
}) {
  const typeLabel: Record<QuestionType, string> = {
    essay: '서술형',
    short: '단답형',
    multiple_choice: '객관식',
    file: '파일 첨부',
  }

  const answerText = question.answer.text

  return (
    <Card>
      {/* 질문 헤더 */}
      <div className="flex items-start gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-[#534AB7] text-white text-[9px] font-medium flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-900">
            {question.body}
            {question.required && <span className="text-[#D85A30] ml-1">*</span>}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {typeLabel[question.question_type]}
          </p>
        </div>
      </div>

      {/* 답변 내용 */}
      <div className="ml-7">
        {question.question_type === 'file' ? (
          // 파일 첨부 타입
          <FileAnswerDisplay files={question.files} />
        ) : answerText ? (
          <div className="bg-[#F7F6F3] rounded-lg p-3">
            {question.question_type === 'multiple_choice' ? (
              <MultipleChoiceAnswer
                answer={answerText}
                options={question.options || []}
              />
            ) : (
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {answerText}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">(응답 없음)</p>
        )}

        {question.answer.updated_at && (
          <p className="text-[9px] text-gray-400 mt-1.5 text-right">
            최종 수정:{' '}
            {new Date(question.answer.updated_at).toLocaleString('ko-KR')}
          </p>
        )}
      </div>
    </Card>
  )
}

// 파일 첨부 답변 표시
function FileAnswerDisplay({ files }: { files: AttachedFile[] }) {
  if (!files || files.length === 0) {
    return <p className="text-xs text-gray-400 italic">(첨부파일 없음)</p>
  }

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return Image
    if (mimetype.startsWith('video/')) return Film
    if (mimetype === 'application/pdf') return FileText
    return File
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const FileIcon = getFileIcon(file.mimetype)
        return (
          <a
            key={file.id}
            href={file.url}
            download={file.original_name}
            className="flex items-center gap-3 bg-[#F7F6F3] hover:bg-[#EEEDFE] rounded-lg p-3 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-black/10 flex items-center justify-center flex-shrink-0">
              <FileIcon size={16} className="text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {file.original_name}
              </p>
              <p className="text-[10px] text-gray-500">
                {formatFileSize(file.size)}
              </p>
            </div>
            <Download
              size={16}
              className="text-gray-400 group-hover:text-[#534AB7] flex-shrink-0 transition-colors"
            />
          </a>
        )
      })}
    </div>
  )
}

// 객관식 답변 표시
function MultipleChoiceAnswer({
  answer,
  options,
}: {
  answer: string
  options: string[]
}) {
  // 복수 선택인 경우 JSON 배열로 저장됨
  let selectedOptions: string[] = []
  try {
    const parsed = JSON.parse(answer)
    if (Array.isArray(parsed)) {
      selectedOptions = parsed
    } else {
      selectedOptions = [answer]
    }
  } catch {
    selectedOptions = [answer]
  }

  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => {
        const isSelected = selectedOptions.includes(opt)
        return (
          <div
            key={i}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
              isSelected
                ? 'bg-[#EEEDFE] text-[#3C3489] font-medium'
                : 'text-gray-500'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full border ${
                isSelected
                  ? 'border-[#534AB7] bg-[#534AB7]'
                  : 'border-gray-300'
              }`}
            >
              {isSelected && (
                <span className="block w-1.5 h-1.5 bg-white rounded-full m-0.5" />
              )}
            </span>
            {opt}
          </div>
        )
      })}
    </div>
  )
}

export default SubmissionDetail
