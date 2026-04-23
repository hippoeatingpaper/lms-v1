/**
 * ui.tsx — 수업 관리 시스템 공통 UI 컴포넌트
 *
 * 배치 위치: client/src/components/ui.tsx
 *
 * ⚠️ 참조 문서 우선순위:
 *    1. SECURITY_GUIDE.md (최우선 - 보안 관련 사항)
 *    2. DESIGN_GUIDE.md (UI/UX 규칙)
 *    3. FRONTEND_GUIDE.html (시각적 레퍼런스)
 *
 * 모든 컴포넌트는 DESIGN_GUIDE.md 기준을 따릅니다.
 *
 * 목차 (구현 완료)
 *  1. Badge / SubmissionBadge / PostTypeBadge
 *  2. Card / MetricCard
 *  3. Button
 *  4. Input / Textarea
 *  5. Toggle
 *  6. RadioOption (단일/복수 선택)
 *  7. Avatar / AvatarGroup
 *  8. ProgressBar
 *  9. SectionLabel
 * 10. NotificationBell
 * 11. ClassPill
 * 12. FileUploadZone (빈/filled 상태 통합)
 * 13. QuestionCard (교사 생성 + 학생 응답 모드)
 * 14. TeamBanner
 * 15. BlockedState
 * 16. SubmitBar (모바일 하단 고정)
 * 17. BottomNav (모바일 하단 네비게이션)
 * 18. EmptyState
 * 19. Skeleton / CardSkeleton
 * 20. SaveStatusPill (문서 에디터 저장 상태)
 *
 * 21. TopBar — 상단 바 (페이지 제목 + 반 pill + 알림 + 아바타)
 * 22. Sidebar / SidebarItem — 사이드바 (반 선택 + 메뉴 아이템)
 * 23. Modal — 모달 다이얼로그
 * 24. Toast / ToastProvider / useToast — 토스트 알림 메시지
 * 25. Table / TableHeader / TableRow — 테이블 (헤더, 행, 호버 액션)
 * 26. AssignmentRow — 과제 목록 행
 * 27. ErrorState — 에러 상태 표시 (API 실패, 네트워크 오류)
 * 28. Tabs / Tab — 탭 컨테이너 (AdminClasses 등에서 사용)
 */

import {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from 'react'
import {
  Bell, Home, FileText, BookOpen, Edit3,
  ChevronUp, ChevronDown, Trash2, Lock,
  Upload, X, Check, ChevronRight,
  AlertCircle, RefreshCw, Calendar, Clock,
} from 'lucide-react'

// ─────────────────────────────────────────────
// 1. Badge
// ─────────────────────────────────────────────

export type BadgeVariant = 'teal' | 'amber' | 'coral' | 'purple' | 'gray'

const badgeStyles: Record<BadgeVariant, string> = {
  teal:   'bg-[#E1F5EE] text-[#085041]',
  amber:  'bg-[#FAEEDA] text-[#633806]',
  coral:  'bg-[#FAECE7] text-[#993C1D]',
  purple: 'bg-[#EEEDFE] text-[#3C3489]',
  gray:   'bg-[#F1EFE8] text-[#5F5E5A]',
}

export function Badge({
  variant = 'gray',
  children,
}: {
  variant?: BadgeVariant
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium ${badgeStyles[variant]}`}
    >
      {children}
    </span>
  )
}

/** 제출 상태 뱃지 — status: 'submitted' | 'draft' | 'not_started' */
export function SubmissionBadge({
  status,
}: {
  status: 'submitted' | 'draft' | 'not_started'
}) {
  if (status === 'submitted') return <Badge variant="teal">제출완료</Badge>
  if (status === 'draft')     return <Badge variant="gray">임시저장됨</Badge>
  return <Badge variant="amber">미제출</Badge>
}

/** 게시물 타입 뱃지 */
export function PostTypeBadge({
  type,
}: {
  type: 'notice' | 'material' | 'published_submission'
}) {
  const map = {
    notice:               { variant: 'coral'  as BadgeVariant, label: '공지' },
    material:             { variant: 'purple' as BadgeVariant, label: '자료' },
    published_submission: { variant: 'teal'   as BadgeVariant, label: '공개' },
  }
  const { variant, label } = map[type]
  return <Badge variant={variant}>{label}</Badge>
}

// ─────────────────────────────────────────────
// 2. Card / MetricCard
// ─────────────────────────────────────────────

export function Card({
  children,
  className = '',
  selected = false,
}: {
  children: ReactNode
  className?: string
  selected?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-xl p-4 transition-colors duration-150
        ${selected
          ? 'border-2 border-[#AFA9EC] bg-[#EEEDFE]/30'
          : 'border border-black/10'
        } ${className}`}
    >
      {children}
    </div>
  )
}

export function MetricCard({
  value,
  label,
  highlight,
}: {
  value: string | number
  label: string
  highlight?: 'danger' | 'success'
}) {
  const valueColor =
    highlight === 'danger'  ? 'text-[#993C1D]' :
    highlight === 'success' ? 'text-[#0F6E56]' :
    'text-gray-900'
  return (
    <div className="bg-[#F7F6F3] rounded-lg p-3">
      <p className={`text-xl font-medium ${valueColor}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

// ─────────────────────────────────────────────
// 3. Button
// ─────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const buttonStyles: Record<ButtonVariant, string> = {
  primary:   'bg-[#534AB7] text-white border-transparent hover:bg-[#3C3489]',
  secondary: 'bg-transparent text-gray-700 border-black/15 hover:bg-gray-50',
  danger:    'bg-transparent text-[#993C1D] border-[#F0997B] hover:bg-[#FAECE7]',
  ghost:     'bg-transparent text-gray-500 border-transparent hover:bg-gray-100',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-lg border
        transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${sizes[size]} ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────
// 4. Input / Textarea
// ─────────────────────────────────────────────

const inputBase =
  'w-full border rounded-lg px-3 py-2 text-sm bg-white font-[inherit] ' +
  'placeholder:text-gray-400 outline-none transition-colors duration-150 ' +
  'focus:ring-2 focus:ring-[#534AB7]/15 focus:border-[#AFA9EC] ' +
  'border-black/15'

/** filled: 값이 입력된 상태에 브랜드 색 강조 적용 */
export function Input({
  className = '',
  filled = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { filled?: boolean }) {
  return (
    <input
      className={`${inputBase}
        ${filled ? 'border-[#AFA9EC] bg-[#EEEDFE]' : ''}
        ${className}`}
      {...props}
    />
  )
}

export function Textarea({
  className = '',
  filled = false,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { filled?: boolean }) {
  return (
    <textarea
      className={`${inputBase} resize-none leading-relaxed
        ${filled ? 'border-[#AFA9EC] bg-[#EEEDFE]' : ''}
        ${className}`}
      {...props}
    />
  )
}

// ─────────────────────────────────────────────
// 5. Toggle
// ─────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-7 h-4 rounded-full transition-colors duration-150 flex-shrink-0
          ${checked ? 'bg-[#534AB7]' : 'bg-gray-200'}`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-150
            ${checked ? 'right-0.5' : 'left-0.5'}`}
        />
      </button>
      {label && <span className="text-xs text-gray-600">{label}</span>}
    </label>
  )
}

// ─────────────────────────────────────────────
// 6. RadioOption (단일/복수 선택)
// ─────────────────────────────────────────────

export function RadioOption({
  options,
  value,
  onChange,
  multiple = false,
}: {
  options: string[]
  value: string | string[]
  onChange: (v: string | string[]) => void
  multiple?: boolean
}) {
  const isSelected = (opt: string) =>
    multiple ? (value as string[]).includes(opt) : value === opt

  const handleClick = (opt: string) => {
    if (multiple) {
      const arr = value as string[]
      onChange(arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt])
    } else {
      onChange(opt)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => handleClick(opt)}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-xs text-left
            transition-all duration-150
            ${isSelected(opt)
              ? 'border-[#AFA9EC] bg-[#EEEDFE] text-[#3C3489] font-medium'
              : 'border-black/10 bg-white text-gray-800 hover:bg-gray-50'
            }`}
        >
          {/* 라디오 또는 체크박스 도트 */}
          <span
            className={`flex-shrink-0 flex items-center justify-center
              ${multiple ? 'w-3.5 h-3.5 rounded-sm border' : 'w-3.5 h-3.5 rounded-full border-[1.5px]'}
              ${isSelected(opt) ? 'border-[#534AB7] bg-[#534AB7]' : 'border-gray-300'}`}
          >
            {isSelected(opt) && (
              <span className={`bg-white ${multiple ? 'w-1.5 h-1 block' : 'w-1.5 h-1.5 rounded-full'}`} />
            )}
          </span>
          {opt}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// 7. Avatar / AvatarGroup
// ─────────────────────────────────────────────

export const AVATAR_COLORS = [
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#E1F5EE', text: '#085041' },
  { bg: '#FAECE7', text: '#712B13' },
  { bg: '#FAEEDA', text: '#633806' },
  { bg: '#E6F1FB', text: '#0C447C' },
]

export function Avatar({
  name,
  index = 0,
  size = 'md',
}: {
  name: string
  index?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const { bg, text } = AVATAR_COLORS[index % AVATAR_COLORS.length]
  const sizeClass = {
    xs: 'w-4 h-4 text-[7px]',
    sm: 'w-5 h-5 text-[8px]',
    md: 'w-7 h-7 text-[10px]',
    lg: 'w-9 h-9 text-xs',
  }[size]
  return (
    <div
      className={`rounded-full flex items-center justify-center font-medium flex-shrink-0 ${sizeClass}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {name.slice(0, 1)}
    </div>
  )
}

export function AvatarGroup({
  names,
  max = 3,
  size = 'xs',
}: {
  names: string[]
  max?: number
  size?: 'xs' | 'sm'
}) {
  const visible = names.slice(0, max)
  const rest = names.length - max
  const dim = size === 'xs' ? 'w-4 h-4 text-[7px]' : 'w-5 h-5 text-[8px]'
  return (
    <div className="flex items-center">
      {visible.map((_, i) => (
        <div
          key={i}
          className={`${dim} rounded-full border-[1.5px] border-white flex items-center justify-center font-medium ${i > 0 ? '-ml-1' : ''}`}
          style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length].bg }}
        />
      ))}
      {rest > 0 && (
        <div className={`${dim} rounded-full border-[1.5px] border-white -ml-1 bg-gray-200 flex items-center justify-center text-gray-500`}>
          +{rest}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 8. ProgressBar
// ─────────────────────────────────────────────

export function ProgressBar({
  value,
  max = 100,
  className = '',
}: {
  value: number
  max?: number
  className?: string
}) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className={`h-1 bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-[#534AB7] rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// 9. SectionLabel
// ─────────────────────────────────────────────

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-medium text-gray-400 tracking-[0.06em] py-1">
      {children}
    </p>
  )
}

// ─────────────────────────────────────────────
// 10. NotificationBell
// ─────────────────────────────────────────────

export function NotificationBell({ unread = 0 }: { unread?: number }) {
  return (
    <div className="relative">
      <Bell size={16} strokeWidth={1.5} className="text-gray-500" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#D85A30]" />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 11. ClassPill
// ─────────────────────────────────────────────

export const CLASS_COLORS = [
  '#534AB7', '#0F6E56', '#993C1D', '#185FA5', '#BA7517', '#993556',
]

export function ClassPill({
  name,
  index,
  selected,
  onClick,
}: {
  name: string
  index: number
  selected?: boolean
  onClick?: () => void
}) {
  const color = CLASS_COLORS[index % CLASS_COLORS.length]
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]
        border transition-colors duration-150
        ${selected
          ? 'bg-[#EEEDFE] text-[#3C3489] border-[#AFA9EC] font-medium'
          : 'bg-white text-gray-500 border-black/10 hover:bg-gray-50'
        }`}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {name}
    </button>
  )
}

// ─────────────────────────────────────────────
// 12. FileUploadZone
// ─────────────────────────────────────────────

interface SelectedFile {
  name: string
  size: string       // 예: '2.4 MB'
  uploadedAt?: string // 예: '어제 22:41'
}

export function FileUploadZone({
  onFileSelect,
  allowCamera = true,
  selectedFile,
  onReplace,
}: {
  onFileSelect: (file: File) => void
  allowCamera?: boolean
  selectedFile?: SelectedFile
  onReplace?: () => void
}) {
  // 허용 확장자: .bmp 제외, .mp4는 100MB 별도 제한 (일반 20MB)
  const ACCEPT =
    '.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.jpg,.jpeg,.png,.zip,.mp4'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onFileSelect(e.target.files[0])
  }

  if (selectedFile) {
    return (
      <div className="border border-[#AFA9EC] bg-[#EEEDFE] rounded-xl p-3 text-center">
        <FileText size={16} strokeWidth={1.5} className="mx-auto mb-1.5 text-[#534AB7]" />
        <p className="text-xs font-medium text-[#3C3489] mb-0.5">{selectedFile.name}</p>
        <p className="text-[10px] text-[#534AB7]">
          {selectedFile.size}
          {selectedFile.uploadedAt && ` · ${selectedFile.uploadedAt} 제출`}
        </p>
        <div className="flex gap-1.5 justify-center mt-2.5">
          <Button variant="danger" size="sm" onClick={onReplace}>
            파일 교체
          </Button>
          <Button variant="secondary" size="sm">
            다운로드
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-dashed border-black/20 rounded-xl p-4 text-center">
      <Upload size={18} strokeWidth={1.3} className="mx-auto mb-1.5 text-gray-400" />
      <p className="text-xs text-gray-400 mb-2.5">파일을 선택하거나 카메라로 촬영</p>
      <div className="flex gap-1.5 justify-center">
        <label className="px-3 py-1.5 border border-black/15 rounded-lg text-xs
          text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors">
          파일 선택
          <input type="file" className="hidden" onChange={handleChange} accept={ACCEPT} />
        </label>
        {allowCamera && (
          <label className="px-3 py-1.5 bg-[#EEEDFE] border border-[#AFA9EC] rounded-lg
            text-xs text-[#3C3489] cursor-pointer hover:bg-[#AFA9EC]/20 transition-colors">
            카메라
            <input
              type="file"
              className="hidden"
              onChange={handleChange}
              accept="image/*"
              capture="environment"
            />
          </label>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 13. QuestionCard
// ─────────────────────────────────────────────

export type QuestionType = 'essay' | 'short' | 'multiple_choice' | 'file'

const Q_TYPE_LABELS: Record<QuestionType, string> = {
  essay:           '서술형',
  short:           '단답형',
  multiple_choice: '객관식',
  file:            '파일 첨부',
}

// ── 13-A. 교사 편집 모드 ──
export function QuestionCardEdit({
  index,
  type,
  body,
  required,
  options = [],
  multipleSelect = false,
  cameraAllowed = false,
  focused = false,
  onTypeChange,
  onBodyChange,
  onRequiredChange,
  onOptionsChange,
  onMultipleSelectChange,
  onCameraAllowedChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  index: number
  type: QuestionType
  body: string
  required: boolean
  options?: string[]
  multipleSelect?: boolean
  cameraAllowed?: boolean
  focused?: boolean
  onTypeChange: (t: QuestionType) => void
  onBodyChange: (v: string) => void
  onRequiredChange: (v: boolean) => void
  onOptionsChange?: (opts: string[]) => void
  onMultipleSelectChange?: (v: boolean) => void
  onCameraAllowedChange?: (v: boolean) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDelete?: () => void
}) {
  return (
    <div className={`rounded-[10px] border overflow-hidden transition-colors ${focused ? 'border-[#AFA9EC]' : 'border-black/10'}`}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#F7F6F3] border-b border-black/8">
        <span className="w-5 h-5 rounded-full bg-[#534AB7] text-white text-[9px] font-medium
          flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <select
          value={type}
          onChange={e => onTypeChange(e.target.value as QuestionType)}
          className="border border-black/10 rounded-md px-2 py-1 text-[11px] text-gray-600
            bg-white outline-none font-[inherit] cursor-pointer"
        >
          {Object.entries(Q_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {type === 'multiple_choice' && (
          <button
            onClick={() => onMultipleSelectChange?.(!multipleSelect)}
            className="text-[10px] text-[#534AB7] hover:underline ml-1"
          >
            {multipleSelect ? '복수 선택' : '단일 선택'} ↔ 전환
          </button>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={onMoveUp}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-200">
            <ChevronUp size={12} strokeWidth={1.5} />
          </button>
          <button onClick={onMoveDown}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-gray-200">
            <ChevronDown size={12} strokeWidth={1.5} />
          </button>
          <button onClick={onDelete}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-400
              hover:bg-[#FAECE7] hover:text-[#993C1D]">
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="p-3">
        <Input
          value={body}
          onChange={e => onBodyChange(e.target.value)}
          placeholder="질문 내용을 입력하세요"
          className="mb-2"
        />
        {type === 'essay' && (
          <Textarea rows={2} placeholder="추가 설명 (선택사항)" className="text-xs" />
        )}
        {type === 'multiple_choice' && (
          <div className="flex flex-col gap-1.5 mt-1">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className={`w-3.5 h-3.5 flex-shrink-0 border border-gray-300
                  ${multipleSelect ? 'rounded-sm' : 'rounded-full'}`} />
                <input
                  value={opt}
                  onChange={e => {
                    const next = [...options]
                    next[i] = e.target.value
                    onOptionsChange?.(next)
                  }}
                  className="flex-1 border border-black/10 rounded-md px-2 py-1 text-xs
                    outline-none focus:border-[#AFA9EC] font-[inherit] bg-white"
                />
                <button
                  onClick={() => onOptionsChange?.(options.filter((_, j) => j !== i))}
                  className="w-5 h-5 rounded flex items-center justify-center text-gray-400
                    hover:bg-[#FAECE7] hover:text-[#993C1D]">
                  <X size={10} strokeWidth={1.5} />
                </button>
              </div>
            ))}
            <button
              onClick={() => onOptionsChange?.([...options, `① 보기${options.length + 1}`])}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#534AB7] pl-5 pt-1"
            >
              + 선택지 추가
            </button>
          </div>
        )}
        {type === 'file' && (
          <div className="border border-dashed border-black/15 rounded-lg p-3 text-center mt-1 bg-[#F7F6F3]">
            <p className="text-[10px] text-gray-400">학생이 파일을 업로드하는 영역입니다</p>
            <p className="text-[9px] text-gray-300 mt-0.5">최대 20MB · pdf docx pptx jpg png zip bmp mp4</p>
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center gap-4 px-3 py-2 bg-[#F7F6F3] border-t border-black/8">
        <Toggle checked={required} onChange={onRequiredChange} label="필수 응답" />
        {type === 'file' && (
          <Toggle checked={cameraAllowed} onChange={v => onCameraAllowedChange?.(v)} label="카메라 촬영 허용" />
        )}
      </div>
    </div>
  )
}

// ── 13-B. 학생 응답 모드 ──
export function QuestionCardAnswer({
  index,
  type,
  body,
  hint,
  required,
  options = [],
  multipleSelect = false,
  allowCamera = false,
  answerText,
  answerOptions,
  selectedFile,
  onTextChange,
  onOptionsChange,
  onFileSelect,
  onFileReplace,
}: {
  index: number
  type: QuestionType
  body: string
  hint?: string
  required: boolean
  options?: string[]
  multipleSelect?: boolean
  allowCamera?: boolean
  answerText?: string
  answerOptions?: string[]
  selectedFile?: SelectedFile
  onTextChange?: (v: string) => void
  onOptionsChange?: (v: string[]) => void
  onFileSelect?: (f: File) => void
  onFileReplace?: () => void
}) {
  const isFilled =
    type === 'file'            ? !!selectedFile :
    type === 'multiple_choice' ? (answerOptions ?? []).length > 0 :
    (answerText ?? '').trim().length > 0

  return (
    <div className="mb-4">
      {/* 질문 라벨 */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <span className="w-5 h-5 mt-0.5 rounded-full bg-[#534AB7] text-white text-[9px] font-medium
          flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1">
          <span className="text-xs font-medium text-gray-900 leading-snug">{body}</span>
          {required && <span className="text-[#D85A30] text-[10px] ml-1">*</span>}
        </div>
      </div>
      {hint && <p className="text-[10px] text-gray-400 pl-[26px] mb-1.5">{hint}</p>}

      {/* 응답 영역 */}
      <div className="pl-[26px]">
        {type === 'essay' && (
          <>
            <Textarea
              rows={5}
              value={answerText ?? ''}
              onChange={e => onTextChange?.(e.target.value)}
              placeholder="내용을 입력하세요..."
              filled={isFilled}
            />
            <p className="text-right text-[10px] text-gray-400 mt-1">
              {(answerText ?? '').length}자
            </p>
          </>
        )}
        {type === 'short' && (
          <Input
            value={answerText ?? ''}
            onChange={e => onTextChange?.(e.target.value)}
            placeholder="답을 입력하세요..."
            filled={isFilled}
          />
        )}
        {type === 'multiple_choice' && (
          <RadioOption
            options={options}
            value={multipleSelect ? (answerOptions ?? []) : (answerOptions?.[0] ?? '')}
            onChange={v => onOptionsChange?.(Array.isArray(v) ? v : [v])}
            multiple={multipleSelect}
          />
        )}
        {type === 'file' && (
          <FileUploadZone
            onFileSelect={onFileSelect ?? (() => {})}
            allowCamera={allowCamera}
            selectedFile={selectedFile}
            onReplace={onFileReplace}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 14. TeamBanner
// ─────────────────────────────────────────────

export function TeamBanner({
  teamName,
  members,
  note,
}: {
  teamName: string
  members: string[]
  note?: string
}) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 bg-[#E1F5EE] rounded-lg mb-3">
      <div className="w-7 h-7 rounded-lg bg-[#9FE1CB] flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          stroke="#085041" strokeWidth="1.5">
          <circle cx="4.5" cy="4" r="2" />
          <circle cx="9.5" cy="4" r="2" />
          <path d="M0.5 12c0-2.2 1.8-4 4-4" />
          <path d="M5.5 12c0-2.2 1.8-4 4-4s4 1.8 4 4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#085041]">{teamName} 팀 과제</p>
        {note && <p className="text-[10px] text-[#0F6E56] mt-0.5">{note}</p>}
      </div>
      <AvatarGroup names={members} max={3} size="xs" />
    </div>
  )
}

// ─────────────────────────────────────────────
// 15. BlockedState
// ─────────────────────────────────────────────

export function BlockedState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#FAECE7] flex items-center justify-center">
        <Lock size={22} strokeWidth={1.4} className="text-[#993C1D]" />
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 px-4 py-2 rounded-lg bg-[#FAECE7] border border-[#F0997B]
            text-xs text-[#993C1D] cursor-pointer hover:bg-[#F5C4B3] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 16. SubmitBar — 모바일 과제 제출 하단 고정
// ─────────────────────────────────────────────

export function SubmitBar({
  progress,
  onSaveDraft,
  onSubmit,
  canSubmit,
  isResubmit = false,
}: {
  progress?: { completed: number; total: number; label?: string }
  onSaveDraft?: () => void
  onSubmit: () => void
  canSubmit: boolean
  isResubmit?: boolean
}) {
  const note = progress
    ? `필수 항목 ${progress.total}개 중 ${progress.completed}개 완료${progress.label ? ` · ${progress.label}` : ''}`
    : null

  return (
    <div className="border-t border-black/8 px-3 pt-2.5 pb-2 bg-white">
      {note && <p className="text-[10px] text-center text-gray-400 mb-2">{note}</p>}
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`w-full py-2.5 rounded-[10px] text-sm font-medium transition-colors
          ${canSubmit
            ? 'bg-[#534AB7] text-white hover:bg-[#3C3489]'
            : 'bg-[#F7F6F3] text-gray-400 cursor-not-allowed'
          }`}
      >
        {isResubmit ? '수정 제출하기' : '제출하기'}
      </button>
      {onSaveDraft && (
        <button
          onClick={onSaveDraft}
          className="w-full mt-1.5 py-2 rounded-lg border border-black/10 text-xs
            text-gray-500 hover:bg-gray-50 transition-colors"
        >
          임시저장
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 17. BottomNav — 학생 모바일 하단 네비게이션
// ─────────────────────────────────────────────

type BottomNavTab = 'home' | 'assignments' | 'board' | 'docs'

const NAV_ITEMS: { id: BottomNavTab; label: string; Icon: React.ElementType }[] = [
  { id: 'home',        label: '홈',    Icon: Home },
  { id: 'assignments', label: '과제',  Icon: FileText },
  { id: 'board',       label: '게시판', Icon: BookOpen },
  { id: 'docs',        label: '문서',  Icon: Edit3 },
]

export function BottomNav({
  active,
  onChange,
}: {
  active: BottomNavTab
  onChange?: (tab: BottomNavTab) => void
}) {
  return (
    <nav className="flex border-t border-black/8 pt-2 pb-1 bg-white">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange?.(id)}
          className={`flex-1 flex flex-col items-center gap-0.5 transition-colors
            ${active === id ? 'text-[#534AB7]' : 'text-gray-400'}`}
        >
          <Icon size={18} strokeWidth={1.5} />
          <span className={`text-[9px] font-medium`}>{label}</span>
        </button>
      ))}
    </nav>
  )
}

// ─────────────────────────────────────────────
// 18. EmptyState
// ─────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: React.ElementType
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
      <Icon size={28} strokeWidth={1} />
      <p className="text-sm">{message}</p>
      {action}
    </div>
  )
}

// ─────────────────────────────────────────────
// 19. Skeleton / CardSkeleton
// ─────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />
}

export function CardSkeleton() {
  return (
    <Card>
      <Skeleton className="h-3 w-1/3 mb-2" />
      <Skeleton className="h-4 w-2/3 mb-1" />
      <Skeleton className="h-3 w-1/2" />
    </Card>
  )
}

// ─────────────────────────────────────────────
// 20. SaveStatusPill — 문서 에디터 저장 상태
// ─────────────────────────────────────────────

export function SaveStatusPill({
  status,
}: {
  status: 'saved' | 'saving' | 'error'
}) {
  const styles = {
    saved:  'bg-[#E1F5EE] text-[#085041]',
    saving: 'bg-[#FAEEDA] text-[#633806]',
    error:  'bg-[#FAECE7] text-[#993C1D]',
  }
  const labels = { saved: '저장됨', saving: '저장 중...', error: '저장 실패' }
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

// ─────────────────────────────────────────────
// 21. TopBar — 상단 바 (페이지 제목 + 반 pill + 알림 + 아바타)
// ─────────────────────────────────────────────

/**
 * TopBar — 페이지 상단 바
 *
 * @example
 * // 교사용 (데스크톱)
 * <TopBar
 *   title="과제 목록"
 *   classInfo={{ name: "1반", index: 0 }}
 *   user={{ name: "김선생", unreadCount: 3 }}
 *   onNotificationClick={() => {}}
 *   onAvatarClick={() => {}}
 * />
 *
 * // 학생용 (모바일) - 뒤로가기 포함
 * <TopBar
 *   title="과제 제출"
 *   showBack
 *   onBack={() => navigate(-1)}
 *   rightElement={<SubmissionBadge status="draft" />}
 * />
 */
export function TopBar({
  title,
  classInfo,
  user,
  showBack = false,
  onBack,
  onNotificationClick,
  onAvatarClick,
  rightElement,
}: {
  title: string
  classInfo?: { name: string; index: number }
  user?: { name: string; unreadCount?: number }
  showBack?: boolean
  onBack?: () => void
  onNotificationClick?: () => void
  onAvatarClick?: () => void
  rightElement?: ReactNode
}) {
  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-black/8 bg-white">
      {/* 왼쪽: 뒤로가기 또는 제목 */}
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={onBack}
            className="w-7 h-7 -ml-1 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
          </button>
        )}
        <h1 className="text-[15px] font-medium text-gray-900">{title}</h1>
        {classInfo && (
          <ClassPill name={classInfo.name} index={classInfo.index} selected />
        )}
      </div>

      {/* 오른쪽: 알림 + 아바타 또는 커스텀 요소 */}
      <div className="flex items-center gap-2">
        {rightElement}
        {user && (
          <>
            <button
              onClick={onNotificationClick}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            >
              <NotificationBell unread={user.unreadCount ?? 0} />
            </button>
            <button
              onClick={onAvatarClick}
              className="hover:ring-2 hover:ring-[#534AB7]/20 rounded-full transition-all"
            >
              <Avatar name={user.name} size="sm" />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────
// 22. Sidebar / SidebarItem — 사이드바
// ─────────────────────────────────────────────

/**
 * SidebarItem — 사이드바 메뉴 아이템
 *
 * @example
 * <SidebarItem icon={Home} label="홈" active />
 * <SidebarItem icon={FileText} label="과제" onClick={() => navigate('/assignments')} />
 */
export function SidebarItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-2 text-xs transition-colors
        ${active
          ? 'text-[#3C3489] bg-[#EEEDFE] border-r-2 border-[#534AB7] font-medium'
          : 'text-gray-500 hover:bg-gray-50'
        }`}
    >
      <Icon size={16} strokeWidth={1.5} />
      {label}
    </button>
  )
}

/**
 * Sidebar — 사이드바 컨테이너
 *
 * @example
 * <Sidebar
 *   classes={[{ id: '1', name: '1반' }, { id: '2', name: '2반' }]}
 *   selectedClassId="1"
 *   onClassSelect={(id) => setSelectedClass(id)}
 *   menuItems={[
 *     { icon: Home, label: '대시보드', path: '/', active: true },
 *     { icon: FileText, label: '과제', path: '/assignments' },
 *     { icon: BookOpen, label: '게시판', path: '/board' },
 *     { icon: Edit3, label: '문서', path: '/docs' },
 *   ]}
 *   onMenuClick={(path) => navigate(path)}
 * />
 */
export function Sidebar({
  classes,
  selectedClassId,
  onClassSelect,
  menuItems,
  onMenuClick,
}: {
  classes: { id: string; name: string }[]
  selectedClassId?: string
  onClassSelect?: (id: string) => void
  menuItems: { icon: React.ElementType; label: string; path: string; active?: boolean }[]
  onMenuClick?: (path: string) => void
}) {
  return (
    <aside className="w-[200px] h-full border-r border-black/8 bg-white flex flex-col">
      {/* 반 선택 영역 */}
      <div className="p-3 border-b border-black/8">
        <p className="text-[10px] text-gray-400 font-medium tracking-[0.06em] mb-2">
          반 선택
        </p>
        <div className="flex flex-wrap gap-1.5">
          {classes.map((cls, i) => (
            <ClassPill
              key={cls.id}
              name={cls.name}
              index={i}
              selected={cls.id === selectedClassId}
              onClick={() => onClassSelect?.(cls.id)}
            />
          ))}
        </div>
      </div>

      {/* 메뉴 아이템 */}
      <nav className="flex-1 py-2">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            active={item.active}
            onClick={() => onMenuClick?.(item.path)}
          />
        ))}
      </nav>
    </aside>
  )
}

// ─────────────────────────────────────────────
// 23. Modal — 모달 다이얼로그
// ─────────────────────────────────────────────

/**
 * Modal — 모달 다이얼로그
 *
 * @example
 * // 기본 사용
 * <Modal open={isOpen} onClose={() => setIsOpen(false)} title="삭제 확인">
 *   <p>정말 삭제하시겠습니까?</p>
 *   <div className="flex gap-2 mt-4">
 *     <Button variant="secondary" onClick={() => setIsOpen(false)}>취소</Button>
 *     <Button variant="danger" onClick={handleDelete}>삭제</Button>
 *   </div>
 * </Modal>
 *
 * // 크기 지정
 * <Modal open={isOpen} onClose={onClose} title="설정" size="lg">
 *   {content}
 * </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  showCloseButton?: boolean
}) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  // 스크롤 방지
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div
        className={`relative bg-white rounded-xl border border-black/10 w-full ${sizeClasses[size]}
          transform transition-all duration-200 animate-modalIn`}
        style={{
          animation: 'modalIn 0.2s ease-out',
        }}
      >
        {/* 헤더 */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
            {title && <h2 className="text-sm font-medium text-gray-900">{title}</h2>}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-gray-400
                  hover:bg-gray-100 rounded-lg transition-colors ml-auto"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        {/* 본문 */}
        <div className="p-4">{children}</div>
      </div>

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────
// 24. Toast / ToastProvider / useToast — 토스트 알림
// ─────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  toasts: ToastItem[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

/**
 * useToast — 토스트 알림 훅
 *
 * @example
 * const toast = useToast()
 * toast.success('저장되었습니다.')
 * toast.error('오류가 발생했습니다.')
 * toast.warning('주의가 필요합니다.')
 * toast.info('새로운 알림이 있습니다.')
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return {
    success: (message: string) => context.addToast('success', message),
    error: (message: string) => context.addToast('error', message),
    warning: (message: string) => context.addToast('warning', message),
    info: (message: string) => context.addToast('info', message),
  }
}

/**
 * ToastProvider — 토스트 컨텍스트 프로바이더
 *
 * @example
 * // App.tsx 최상위에 배치
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, type, message }])

    // 3초 후 자동 제거
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

/** Toast 단일 아이템 */
function Toast({
  type,
  message,
  onRemove,
}: {
  type: ToastType
  message: string
  onRemove: () => void
}) {
  const styles: Record<ToastType, { bg: string; text: string; icon: React.ElementType }> = {
    success: { bg: 'bg-[#E1F5EE]', text: 'text-[#085041]', icon: Check },
    error:   { bg: 'bg-[#FAECE7]', text: 'text-[#993C1D]', icon: AlertCircle },
    warning: { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]', icon: AlertCircle },
    info:    { bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]', icon: Bell },
  }

  const { bg, text, icon: Icon } = styles[type]

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl border border-black/10 shadow-sm
        ${bg} ${text} animate-toastIn`}
      style={{ animation: 'toastIn 0.2s ease-out' }}
    >
      <Icon size={16} strokeWidth={1.5} />
      <span className="text-xs font-medium flex-1">{message}</span>
      <button
        onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center hover:bg-black/5 rounded transition-colors"
      >
        <X size={12} strokeWidth={1.5} />
      </button>
    </div>
  )
}

/** Toast 컨테이너 */
function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[]
  onRemove: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          onRemove={() => onRemove(toast.id)}
        />
      ))}

      <style>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────
// 25. Table / TableHeader / TableRow — 테이블
// ─────────────────────────────────────────────

/**
 * Table — 테이블 컨테이너
 *
 * @example
 * <Table>
 *   <TableHeader columns={['이름', '제출 상태', '제출일', '']} />
 *   <tbody>
 *     <TableRow
 *       cells={['김민준', <Badge variant="teal">제출완료</Badge>, '2024-01-15', null]}
 *       actions={[
 *         { label: '보기', onClick: () => {} },
 *         { label: '삭제', onClick: () => {}, variant: 'danger' },
 *       ]}
 *     />
 *   </tbody>
 * </Table>
 */
export function Table({ children }: { children: ReactNode }) {
  return (
    <table className="w-full text-xs border-collapse">
      {children}
    </table>
  )
}

/** TableHeader — 테이블 헤더 */
export function TableHeader({
  columns,
  widths,
}: {
  columns: string[]
  widths?: string[]
}) {
  return (
    <thead>
      <tr>
        {columns.map((col, i) => (
          <th
            key={i}
            className="text-left text-[10px] text-gray-400 font-medium tracking-wider
              pb-2 border-b border-black/8 px-2"
            style={widths?.[i] ? { width: widths[i] } : undefined}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  )
}

/** TableRow — 테이블 행 */
export function TableRow({
  cells,
  actions,
  onClick,
  selected = false,
}: {
  cells: ReactNode[]
  actions?: { label: string; onClick: () => void; variant?: 'default' | 'danger' }[]
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-black/5 last:border-0 group transition-colors
        ${onClick ? 'cursor-pointer' : ''}
        ${selected ? 'bg-[#EEEDFE]' : 'hover:bg-[#F7F6F3]'}`}
    >
      {cells.map((cell, i) => (
        <td key={i} className="py-2.5 px-2">
          {cell}
        </td>
      ))}
      {actions && actions.length > 0 && (
        <td className="py-2.5 px-2 text-right">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 justify-end">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation()
                  action.onClick()
                }}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors
                  ${action.variant === 'danger'
                    ? 'text-[#993C1D] hover:bg-[#FAECE7]'
                    : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </td>
      )}
    </tr>
  )
}

// ─────────────────────────────────────────────
// 26. AssignmentRow — 과제 목록 행
// ─────────────────────────────────────────────

/**
 * AssignmentRow — 과제 목록 행 (학생 홈, 과제 목록에서 사용)
 *
 * @example
 * <AssignmentRow
 *   title="1단원 복습 과제"
 *   dueDate="2024-01-20"
 *   dueTime="23:59"
 *   status="not_started"
 *   questionCount={3}
 *   isTeam={false}
 *   onClick={() => navigate(`/assignments/${id}`)}
 * />
 */
export function AssignmentRow({
  title,
  dueDate,
  dueTime,
  status,
  questionCount,
  isTeam = false,
  onClick,
}: {
  title: string
  dueDate: string
  dueTime?: string
  status: 'submitted' | 'draft' | 'not_started'
  questionCount?: number
  isTeam?: boolean
  onClick?: () => void
}) {
  // 마감 임박 여부 (24시간 이내)
  const isUrgent = (() => {
    const due = new Date(`${dueDate}T${dueTime || '23:59'}`)
    const now = new Date()
    const diff = due.getTime() - now.getTime()
    return diff > 0 && diff < 24 * 60 * 60 * 1000
  })()

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-black/10
        bg-white hover:bg-[#F7F6F3] transition-colors text-left group"
    >
      {/* 아이콘 */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
        ${isTeam ? 'bg-[#E1F5EE]' : 'bg-[#EEEDFE]'}`}
      >
        <FileText
          size={16}
          strokeWidth={1.5}
          className={isTeam ? 'text-[#0F6E56]' : 'text-[#534AB7]'}
        />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-900 truncate">{title}</p>
          {isTeam && (
            <span className="text-[9px] text-[#0F6E56] bg-[#E1F5EE] px-1.5 py-0.5 rounded-full">
              팀
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] flex items-center gap-0.5
            ${isUrgent ? 'text-[#993C1D] font-medium' : 'text-gray-400'}`}
          >
            <Calendar size={10} strokeWidth={1.5} />
            {dueDate}
            {dueTime && (
              <>
                <Clock size={10} strokeWidth={1.5} className="ml-1" />
                {dueTime}
              </>
            )}
          </span>
          {questionCount && (
            <span className="text-[10px] text-gray-400">
              · {questionCount}문항
            </span>
          )}
        </div>
      </div>

      {/* 상태 뱃지 */}
      <SubmissionBadge status={status} />

      {/* 화살표 */}
      <ChevronRight
        size={16}
        strokeWidth={1.5}
        className="text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0"
      />
    </button>
  )
}

// ─────────────────────────────────────────────
// 27. ErrorState — 에러 상태 표시
// ─────────────────────────────────────────────

/**
 * ErrorState — 에러 상태 표시 (API 실패, 네트워크 오류)
 *
 * @example
 * // 기본 사용
 * <ErrorState
 *   title="데이터를 불러올 수 없습니다"
 *   description="네트워크 연결을 확인하고 다시 시도해주세요."
 *   onRetry={() => refetch()}
 * />
 *
 * // 커스텀 아이콘
 * <ErrorState
 *   icon={WifiOff}
 *   title="오프라인 상태입니다"
 *   description="인터넷 연결 후 다시 시도해주세요."
 * />
 */
export function ErrorState({
  icon: Icon = AlertCircle,
  title,
  description,
  onRetry,
  retryLabel = '다시 시도',
}: {
  icon?: React.ElementType
  title: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#FAECE7] flex items-center justify-center">
        <Icon size={22} strokeWidth={1.4} className="text-[#993C1D]" />
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && (
        <p className="text-xs text-gray-500 leading-relaxed max-w-xs">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 px-4 py-2 rounded-lg bg-white border border-black/15
            text-xs text-gray-600 hover:bg-gray-50 transition-colors
            flex items-center gap-1.5"
        >
          <RefreshCw size={12} strokeWidth={1.5} />
          {retryLabel}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 28. Tabs / Tab — 탭 컨테이너
// ─────────────────────────────────────────────

/**
 * Tabs — 탭 컨테이너 (AdminClasses 등에서 사용)
 *
 * @example
 * const [activeTab, setActiveTab] = useState('classes')
 *
 * <Tabs value={activeTab} onChange={setActiveTab}>
 *   <Tab value="classes" label="반 목록" />
 *   <Tab value="students" label="학생 계정" />
 *   <Tab value="teams" label="팀 구성" />
 * </Tabs>
 *
 * {activeTab === 'classes' && <ClassList />}
 * {activeTab === 'students' && <StudentList />}
 * {activeTab === 'teams' && <TeamList />}
 */

interface TabsContextType {
  value: string
  onChange: (value: string) => void
}

const TabsContext = createContext<TabsContextType | null>(null)

export function Tabs({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={`inline-flex bg-[#F7F6F3] p-0.5 rounded-lg gap-0.5 ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function Tab({
  value,
  label,
  disabled = false,
}: {
  value: string
  label: string
  disabled?: boolean
}) {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tab must be used within Tabs')
  }

  const isActive = context.value === value

  return (
    <button
      onClick={() => !disabled && context.onChange(value)}
      disabled={disabled}
      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors
        ${isActive
          ? 'bg-white border border-black/10 text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  )
}
