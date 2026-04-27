// 과제 관련 타입 정의

export type QuestionType = 'essay' | 'short' | 'multiple_choice' | 'file'
export type SubmissionStatus = 'draft' | 'submitted' | null
export type AssignmentScope = 'individual' | 'team'

export interface Author {
  id: number
  name: string
}

// 과제 목록 아이템
export interface Assignment {
  id: number
  title: string
  scope: AssignmentScope
  due_at: string | null
  question_count: number
  author: Author
  created_at: string
  submission_status?: SubmissionStatus // 학생인 경우만
}

// 과제 질문
export interface Question {
  id: number
  order_num: number
  question_type: QuestionType
  body: string
  options: string[] | null
  required: boolean
  allow_multiple: boolean
}

// 제출물 정보
export interface Submission {
  id: number
  status: 'draft' | 'submitted'
  version: number
  feedback: string | null
  submitted_at: string | null
  submitter: Author
}

// 답변 정보
export interface Answer {
  question_id: number
  answer_text: string
}

// 과제 상세 응답
export interface AssignmentDetailResponse {
  assignment: {
    id: number
    title: string
    description: string
    scope: AssignmentScope
    class_id: number | null
    due_at: string | null
    author: Author
    created_at: string
  }
  questions: Question[]
  submission?: Submission | null // 학생인 경우
  answers?: Answer[] | null // 학생인 경우
}

// 과제 목록 응답
export interface AssignmentListResponse {
  assignments: Assignment[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

// 과제 생성/수정 요청
export interface AssignmentCreateRequest {
  title: string
  description: string
  scope: AssignmentScope
  class_id: number | null
  due_at: string | null
  questions: {
    question_type: QuestionType
    body: string
    options?: string[]
    required: boolean
    allow_multiple?: boolean
    order_num?: number
  }[]
}

// 과제 생성 응답
export interface AssignmentCreateResponse {
  assignment: {
    id: number
    title: string
    description: string
    scope: AssignmentScope
    class_id: number | null
    due_at: string | null
    author: Author
    created_at: string
  }
  questions: Question[]
}

// 임시저장/제출 요청
export interface SubmitRequest {
  answers: Answer[]
}

// 임시저장/제출 응답
export interface SubmitResponse {
  submission: {
    id: number
    status: 'draft' | 'submitted'
    version: number
    submitted_at?: string
  }
}

// 제출 현황 응답 (교사용)
export interface SubmissionsResponse {
  submissions: {
    id: number
    submitter: Author
    team: { id: number; name: string } | null
    status: 'draft' | 'submitted'
    version: number
    submitted_at: string | null
    has_feedback: boolean
    is_published: boolean
    last_modified_by: Author | null
  }[]
  not_started_list: {
    id: number
    name: string
    type: 'student' | 'team'
  }[]
  stats: {
    total: number
    submitted: number
    draft: number
    not_started: number
  }
}

// 첨부파일 정보
export interface AttachedFile {
  id: number
  filename: string
  original_name: string
  mimetype: string
  size: number
  url: string
  uploader: Author
  created_at: string
}

// 제출물 상세 응답 (교사용)
export interface SubmissionDetailResponse {
  submission: {
    id: number
    status: 'draft' | 'submitted'
    version: number
    feedback: string | null
    is_published: boolean
    submitted_at: string | null
    submitter: Author
    team: {
      id: number
      name: string
      members: Author[]
    } | null
  }
  assignment: {
    id: number
    title: string
    description: string
    scope: AssignmentScope
  }
  questions: {
    id: number
    order_num: number
    question_type: QuestionType
    body: string
    options: string[] | null
    required: boolean
    allow_multiple: boolean
    answer: {
      text: string | null
      updated_at: string | null
    }
    files: AttachedFile[]
  }[]
}
