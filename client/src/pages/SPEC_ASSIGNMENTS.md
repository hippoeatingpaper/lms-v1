# 과제 UI 스펙 (Assignments)

> 과제 목록, 출제, 제출 화면의 프론트엔드 구현 스펙

## 라우팅 구조

과제 관련 페이지는 **교사와 학생이 동일한 경로를 공유**합니다. `RoleBasedLayout`을 사용하여 역할에 따라 적절한 레이아웃(TeacherLayout/StudentLayout)이 적용됩니다.

### 라우트 정의 (App.tsx)

```tsx
{/* 공통 과제 라우트 (교사/학생 모두 접근 가능) */}
<Route
  path="/class/:classId/assignments"
  element={
    <AuthGuard>
      <RoleBasedLayout />
    </AuthGuard>
  }
>
  <Route index element={<AssignmentList />} />
  <Route path=":assignmentId" element={<AssignmentDetail />} />
</Route>

{/* 교사 전용 라우트 */}
<Route path="/class/:classId/assignments/new" element={<AssignmentForm />} />
<Route path="/class/:classId/assignments/:assignmentId/edit" element={<AssignmentForm />} />
<Route path="/class/:classId/assignments/:assignmentId/submissions" element={<SubmissionList />} />
<Route path="/class/:classId/assignments/:assignmentId/submissions/:submissionId" element={<SubmissionDetail />} />
```

### 경로 매핑

| 경로 | 교사 | 학생 | 레이아웃 |
|------|------|------|----------|
| `/class/:classId/assignments` | 과제 목록 | 과제 목록 | RoleBasedLayout |
| `/class/:classId/assignments/:id` | 과제 상세 | 과제 제출 | RoleBasedLayout |
| `/class/:classId/assignments/new` | 과제 출제 | - | TeacherLayout |
| `/class/:classId/assignments/:id/edit` | 과제 수정 | - | TeacherLayout |
| `/class/:classId/assignments/:id/submissions` | 제출 현황 | - | TeacherLayout |
| `/class/:classId/assignments/:id/submissions/:subId` | 피드백 작성 | - | TeacherLayout |

> **주의**: 과제 목록/상세는 공통 라우트이므로 학생 라우트보다 **먼저 정의되면 안 됩니다**. 학생 전용 라우트(`/class/:classId`)가 먼저 정의되어 있어야 학생 홈/게시판/프로필이 정상 작동합니다.

## 페이지 구조

### 1. 과제 목록 (AssignmentList.tsx)
```
경로: /class/:classId/assignments
권한: 교사, 학생
```

**교사 뷰**:
```
┌─────────────────────────────────────────────────┐
│ 과제 목록                    [+ 과제 출제] 버튼  │
├─────────────────────────────────────────────────┤
│ [전체] [개인과제] [팀과제] ← 필터 탭             │
├─────────────────────────────────────────────────┤
│ AssignmentRow (반복)                            │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📄 1차 보고서           [팀] 마감: 4/20     │ │
│ │    제출 23/30  피드백 12/23                 │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**학생 뷰 (모바일)**:
```
┌─────────────────────────────────────────────────┐
│ ← 과제                                          │
├─────────────────────────────────────────────────┤
│ [개인과제] [팀과제] ← SubTab                     │
├─────────────────────────────────────────────────┤
│ AssignmentRow (반복)                            │
│ ┌─────────────────────────────────────────────┐ │
│ │ 1차 보고서              [미제출] 마감 D-3   │ │
│ │ 질문 3개                          →        │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 2. 과제 출제 (AssignmentCreate.tsx)
```
경로: /class/:classId/assignments/new
권한: 교사만
```

```
┌──────────────────────────┬────────────────┐
│ 과제 출제                │ 과제 요약      │
├──────────────────────────┤                │
│ 제목: [____________]     │ 질문 3개       │
│ 설명: [____________]     │ 필수 2개       │
│                          │                │
│ 대상: ○ 개인과제         │ ────────────── │
│       ● 팀과제           │ 체크리스트:    │
│                          │ ☑ 제목 입력    │
│ 반: [1반 ▼] 마감: [날짜] │ ☑ 질문 1개+   │
│                          │ ☐ 마감일 설정  │
├──────────────────────────┤                │
│ 질문 목록 (드래그 정렬)   │                │
│                          │                │
│ ┌──────────────────────┐ │                │
│ │ Q1. 서술형 [필수]    │ │                │
│ │ 환경 문제의 원인을...│ │                │
│ │           [↑][↓][🗑] │ │                │
│ └──────────────────────┘ │                │
│                          │                │
│ ┌──────────────────────┐ │                │
│ │ Q2. 객관식 [필수]    │ │                │
│ │ 가장 심각한 문제는?  │ │                │
│ │ ① 대기오염 [+선택지] │ │                │
│ └──────────────────────┘ │                │
│                          │                │
│ [+서술형][+단답형]       │                │
│ [+객관식][+파일업로드]   │                │
│                          │                │
│        [출제하기] 버튼    │                │
└──────────────────────────┴────────────────┘
```

### 3. 과제 상세/제출 (AssignmentDetail.tsx)
```
경로: /class/:classId/assignments/:id
권한: 교사 (제출물 확인), 학생 (제출)
```

**학생 제출 뷰 (모바일)**:
```
┌─────────────────────────────────────────────────┐
│ ← 1차 보고서                      [미제출]      │
├─────────────────────────────────────────────────┤
│ 마감: 2026-04-20 23:59                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ 주제: 환경 문제에 대해 조사하고 보고서를    │ │
│ │ 작성하세요.                                 │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ (팀과제인 경우)                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 👥 2모둠: 김민준, 이서연, 박지호             │ │
│ │ 팀원 누구나 수정 가능                       │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Q1. 환경 문제의 원인을 서술하시오. [필수]       │
│ ┌─────────────────────────────────────────────┐ │
│ │ (Textarea - 입력 또는 filled 상태)          │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Q2. 가장 심각한 문제는? [필수]                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ ○ ① 대기오염                               │ │
│ │ ● ② 수질오염  ← 선택됨 (보라색 배경)        │ │
│ │ ○ ③ 토양오염                               │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ Q3. 관련 자료를 첨부하시오. [선택]              │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ │  📎 파일을 드래그하거나 클릭하여 업로드     │ │
│ │     또는 [📷 촬영]                          │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
├─────────────────────────────────────────────────┤
│ (피드백이 있는 경우)                            │
│ ┌─────────────────────────────────────────────┐ │
│ │ 💬 선생님 피드백                            │ │
│ │ 잘 작성했습니다. 다만 2번 문항은...         │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ SubmitBar (하단 고정)                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ 필수 2/2 완료        [임시저장] [제출하기]  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 4. 제출 현황 (SubmissionList.tsx) - 교사 전용
```
경로: /class/:classId/assignments/:assignmentId/submissions
권한: 교사만
```

```
┌─────────────────────────────────────────────────────────┐
│ ← 1차 보고서                                            │
│   팀 과제 제출 현황                                      │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│ │ 전체     │ │ 제출완료 │ │ 임시저장 │ │ 미제출   │    │
│ │    30    │ │    23    │ │     4    │ │     3    │    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────────────────┤
│ [전체(27)] [제출완료(23)] [임시저장(4)] [미제출(3)]     │
├─────────────────────────────────────────────────────────┤
│ 팀       │ 제출자   │ 상태     │ 제출일     │ 피드백  │ │
│──────────┼──────────┼──────────┼────────────┼─────────│ │
│ 1모둠    │ 김민준   │ 제출완료 │ 4/18 14:32 │ 작성됨  │ │
│ 2모둠    │ 이서연   │ 제출완료 │ 4/19 09:15 │ -       │ │
│ 3모둠    │ 박지호   │ 임시저장 │ -          │ -       │ │
└─────────────────────────────────────────────────────────┘
```

**구현 파일**: `client/src/pages/SubmissionList.tsx`

### 5. 제출물 상세/피드백 (SubmissionDetail.tsx) - 교사 전용
```
경로: /class/:classId/assignments/:assignmentId/submissions/:submissionId
권한: 교사만
```

```
┌─────────────────────────────────────────────────────────┐
│ ← 1차 보고서                    [제출완료] [공개됨]     │
│   1모둠 - 김민준 | 2026-04-18 14:32                     │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👥 1모둠                                            │ │
│ │ 팀원: 김민준, 이서연, 박지호             [아바타들] │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ 답변 내용                                               │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ① 환경 문제의 원인을 서술하시오. *                  │ │
│ │   서술형                                            │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ 환경 문제의 주요 원인으로는 산업화, 도시화...    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ │                         최종 수정: 2026-04-18 14:30 │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ 💬 피드백                                    [저장됨]   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 학생에게 전달할 피드백을 작성하세요...              │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                    [✓ 피드백 저장] 버튼 │
├─────────────────────────────────────────────────────────┤
│                                    [게시판 공개] 버튼   │
└─────────────────────────────────────────────────────────┘
```

**구현 파일**: `client/src/pages/SubmissionDetail.tsx`

**기능**:
- 질문별 답변 확인
- 피드백 작성/수정/저장
- 제출물 게시판 공개 (우수작 공유)

## 컴포넌트 사용법

### QuestionCard (질문 카드)

```tsx
import { QuestionCard } from '@/components/ui'

// 교사 - 편집 모드
<QuestionCard
  index={0}
  type="multiple_choice"
  body="가장 심각한 문제는?"
  required={true}
  editable
  options={['①대기오염', '②수질오염', '③토양오염']}
  allowMultiple={false}
  onTypeChange={(type) => updateQuestion(0, { type })}
  onBodyChange={(body) => updateQuestion(0, { body })}
  onOptionsChange={(options) => updateQuestion(0, { options })}
  onRequiredChange={(required) => updateQuestion(0, { required })}
  onDelete={() => deleteQuestion(0)}
  onMoveUp={() => moveQuestion(0, -1)}
  onMoveDown={() => moveQuestion(0, 1)}
/>

// 학생 - 응답 모드
<QuestionCard
  index={0}
  type="essay"
  body="환경 문제의 원인을 서술하시오."
  required={true}
>
  <Textarea
    value={answers[questionId]}
    onChange={(e) => setAnswer(questionId, e.target.value)}
    className={answers[questionId] ? 'border-brand-mid bg-brand-light' : ''}
  />
</QuestionCard>
```

### RadioOption (객관식)

```tsx
import { RadioOption } from '@/components/ui'

// 단일 선택
<RadioOption
  options={['①대기오염', '②수질오염', '③토양오염']}
  value={selected}
  onChange={setSelected}
/>

// 복수 선택
<RadioOption
  multiple
  options={['①대기오염', '②수질오염', '③토양오염']}
  value={selectedArray}  // string[]
  onChange={setSelectedArray}
/>
```

**스타일**:
- 미선택: `border-black/10 bg-white`
- 선택됨: `border-[#AFA9EC] bg-[#EEEDFE] text-[#3C3489]`

### FileUploadZone (파일 업로드)

```tsx
import { FileUploadZone } from '@/components/ui'
import { useFileUpload } from '@/hooks/useFileUpload'

const { progress, uploading, upload, cancel } = useFileUpload()

// 빈 상태
<FileUploadZone
  onFileSelect={async (file) => {
    await upload(file, `/api/v1/assignments/${id}/questions/${qId}/file`)
  }}
  allowCamera={true}
  accept=".pdf,.docx,.jpg,.png,.mp4"
/>

// 파일 있음 (filled)
<FileUploadZone
  selectedFile={{
    name: '보고서.pdf',
    size: '2.4 MB',
    uploadedAt: '어제 22:41'
  }}
  onReplace={handleReplace}
/>

// 업로드 중
{uploading && (
  <div>
    <ProgressBar value={progress} />
    <Button variant="ghost" onClick={cancel}>취소</Button>
  </div>
)}
```

**스타일**:
- 빈 상태: `border-dashed border-black/18`
- filled: `border-solid border-[#AFA9EC] bg-[#EEEDFE]`

### TeamBanner (팀 과제용)

```tsx
import { TeamBanner } from '@/components/ui'

<TeamBanner
  teamName="2모둠"
  members={['김민준', '이서연', '박지호']}
  note="팀원 누구나 수정 가능"
/>
```

### SubmitBar (하단 고정)

```tsx
import { SubmitBar } from '@/components/ui'

<SubmitBar
  progress={{
    completed: 2,
    total: 3,
    label: '파일 미첨부'  // 미완료 항목 설명
  }}
  onSaveDraft={handleDraft}
  onSubmit={handleSubmit}
  canSubmit={allRequiredFilled}
  isResubmit={submission?.status === 'submitted'}
/>
```

### BlockedState (팀 미배정)

```tsx
import { BlockedState } from '@/components/ui'
import { Lock } from 'lucide-react'

// 팀 과제인데 팀 미배정인 경우
{!user.team_id && assignment.scope === 'team' && (
  <BlockedState
    icon={Lock}
    title="팀 배정이 필요합니다"
    description="팀 과제에 참여하려면 먼저 팀에 배정되어야 합니다."
    action={{
      label: '선생님에게 알림 보내기',
      onClick: handleNotifyTeacher
    }}
  />
)}
```

### AssignmentRow (목록 행)

```tsx
import { AssignmentRow } from '@/components/ui'

<AssignmentRow
  title="1차 보고서"
  scope="team"
  dueAt="2026-04-20T23:59:00"
  questionCount={3}
  status="draft"  // 'draft' | 'submitted' | null
  onClick={() => navigate(`/assignments/${id}`)}
/>
```

## 상태 관리

### 제출 상태 타입
```ts
type SubmissionStatus = 'not_started' | 'draft' | 'submitted'
```

### 로컬 상태 (페이지 내)
```ts
// AssignmentDetail.tsx
const [answers, setAnswers] = useState<Record<number, string>>({})
const [files, setFiles] = useState<Record<number, File | null>>({})
const [isDirty, setIsDirty] = useState(false)

// 자동 임시저장 (디바운스)
useEffect(() => {
  if (!isDirty) return
  const timer = setTimeout(() => {
    saveDraft(answers)
  }, 2000)
  return () => clearTimeout(timer)
}, [answers, isDirty])
```

### 필수 질문 검증
```ts
const allRequiredFilled = useMemo(() => {
  return questions
    .filter(q => q.required)
    .every(q => {
      if (q.question_type === 'file') {
        return !!files[q.id]
      }
      return (answers[q.id] ?? '').trim().length > 0
    })
}, [questions, answers, files])
```

### 타입 정의 (types/assignment.ts)

```ts
// 제출 현황 응답 (교사용)
interface SubmissionsResponse {
  submissions: {
    id: number
    submitter: { id: number; name: string }
    team: { id: number; name: string } | null
    status: 'draft' | 'submitted'
    version: number
    submitted_at: string | null
    has_feedback: boolean
    is_published: boolean
    last_modified_by: { id: number; name: string } | null
  }[]
  stats: {
    total: number
    submitted: number
    draft: number
    not_started: number
  }
}

// 제출물 상세 응답 (교사용)
interface SubmissionDetailResponse {
  submission: {
    id: number
    status: 'draft' | 'submitted'
    version: number
    feedback: string | null
    is_published: boolean
    submitted_at: string | null
    submitter: { id: number; name: string }
    team: {
      id: number
      name: string
      members: { id: number; name: string }[]
    } | null
  }
  assignment: {
    id: number
    title: string
    description: string
    scope: 'individual' | 'team'
  }
  questions: {
    id: number
    order_num: number
    question_type: 'essay' | 'short' | 'multiple_choice' | 'file'
    body: string
    options: string[] | null
    required: boolean
    answer: {
      text: string | null
      updated_at: string | null
    }
  }[]
}
```

## API 호출

```ts
// 과제 목록
const { data } = await api<{ assignments: Assignment[] }>(
  `/classes/${classId}/assignments`
)

// 과제 상세 + 내 응답
const { assignment, questions, submission, answers } = await api<AssignmentDetail>(
  `/assignments/${id}`
)

// 임시저장
await api(`/assignments/${id}/draft`, {
  method: 'POST',
  body: JSON.stringify({ answers: Object.entries(answersMap).map(...) })
})

// 최종 제출
await api(`/assignments/${id}/submit`, {
  method: 'POST',
  body: JSON.stringify({ answers: ... })
})

// 제출 현황 조회 (교사)
const { submissions, stats } = await api<SubmissionsResponse>(
  `/assignments/${id}/submissions`
)

// 제출물 상세 조회 (교사)
const { submission, assignment, questions } = await api<SubmissionDetailResponse>(
  `/submissions/${submissionId}`
)

// 피드백 저장 (교사)
await apiPatch(`/submissions/${submissionId}/feedback`, { feedback: '...' })

// 제출물 공개 (교사)
await apiPost(`/submissions/${submissionId}/publish`)
```

## 질문 타입별 렌더링

```tsx
function QuestionInput({ question, value, onChange, file, onFileChange }) {
  switch (question.question_type) {
    case 'essay':
      return <Textarea rows={6} value={value} onChange={onChange} />

    case 'short':
      return <Input value={value} onChange={onChange} />

    case 'multiple_choice':
      return (
        <RadioOption
          multiple={question.allow_multiple}
          options={JSON.parse(question.options)}
          value={question.allow_multiple ? JSON.parse(value || '[]') : value}
          onChange={onChange}
        />
      )

    case 'file':
      return (
        <FileUploadZone
          selectedFile={file}
          onFileSelect={onFileChange}
          allowCamera={true}
        />
      )
  }
}
```

## 상태 뱃지

```tsx
const statusBadge = {
  not_started: <Badge variant="amber">미제출</Badge>,
  draft:       <Badge variant="gray">임시저장</Badge>,
  submitted:   <Badge variant="teal">제출완료</Badge>,
}

// 마감 임박 (D-3 이내)
const daysLeft = Math.ceil((dueAt - now) / (1000 * 60 * 60 * 24))
{daysLeft <= 3 && daysLeft > 0 && (
  <Badge variant="amber">D-{daysLeft}</Badge>
)}
```

## Socket.IO 이벤트

```ts
// 팀 배정 시 즉시 접근 해제
socket.on('team:assigned', ({ teamId, teamName }) => {
  useAuthStore.getState().setTeamId(teamId)
  toast.success(`${teamName} 팀에 배정되었습니다!`)
  // BlockedState 자동 해제됨
})
```

## 파일 크기 제한

| 파일 종류 | 최대 크기 |
|----------|----------|
| 일반 파일 | 20MB |
| 동영상 (.mp4) | 100MB |

```tsx
const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_VIDEO_SIZE = 100 * 1024 * 1024

function validateFile(file: File) {
  const isVideo = file.type === 'video/mp4'
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE

  if (file.size > maxSize) {
    toast.error(`파일 크기는 ${isVideo ? '100MB' : '20MB'}를 초과할 수 없습니다.`)
    return false
  }
  return true
}
```
