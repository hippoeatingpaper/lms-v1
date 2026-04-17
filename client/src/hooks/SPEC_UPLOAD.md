# 파일 업로드 프론트엔드 스펙 (File Upload)

> 파일 업로드 훅, 진행률 표시, 취소 기능의 프론트엔드 구현 스펙
> **참조**: `server/middleware/SPEC_UPLOAD.md` (백엔드 스펙)

## 업로드 흐름 개요

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 파일 선택   │────▶│ XHR 업로드  │────▶│ 완료/에러   │
│ (input)     │     │ (진행률)    │     │ 처리        │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 파일 검증   │     │ ProgressBar │     │ 콜백 실행   │
│ (크기/타입) │     │ + 취소 버튼 │     │ (onSuccess) │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 핵심 개념

| 항목 | 설명 |
|------|------|
| 업로드 방식 | XHR (진행률 지원) |
| 진행률 | `xhr.upload.onprogress` |
| 취소 | `xhr.abort()` |
| 인증 | `withCredentials: true` (쿠키 자동 전송) |

## 파일 제한

| 파일 종류 | 최대 크기 | 허용 확장자 |
|----------|----------|------------|
| 일반 파일 | 20MB | pdf, docx, pptx, xlsx, jpg, png, zip |
| 동영상 | 100MB | mp4 |

```ts
// 클라이언트 측 사전 검증용
const MAX_FILE_SIZE = 20 * 1024 * 1024      // 20MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024    // 100MB

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx',
  '.ppt', '.pptx',
  '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png',
  '.zip', '.mp4',
]
```

## 상태 관리

### UploadState 인터페이스

```ts
interface UploadState {
  progress: number      // 0-100 (%)
  uploading: boolean    // 업로드 중 여부
  error: string | null  // 에러 메시지
}
```

## 훅 구현

### useFileUpload

```ts
// hooks/useFileUpload.ts
import { useState, useRef, useCallback } from 'react'

interface UploadState {
  progress: number
  uploading: boolean
  error: string | null
}

interface UploadResult {
  file: {
    id: number
    filename: string
    original_name: string
    mimetype: string
    size: number
    url: string
  }
}

export function useFileUpload() {
  const [state, setState] = useState<UploadState>({
    progress: 0,
    uploading: false,
    error: null,
  })
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const upload = useCallback(async (
    file: File,
    url: string,
    extraData?: Record<string, string>
  ): Promise<UploadResult> => {
    setState({ progress: 0, uploading: true, error: null })

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr

      const formData = new FormData()
      formData.append('file', file)

      // 추가 데이터 (context, post_id, question_id 등)
      if (extraData) {
        Object.entries(extraData).forEach(([key, value]) => {
          formData.append(key, value)
        })
      }

      // 진행률 업데이트
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setState((prev) => ({ ...prev, progress }))
        }
      }

      // 완료 처리
      xhr.onload = () => {
        xhrRef.current = null

        if (xhr.status >= 200 && xhr.status < 300) {
          setState({ progress: 100, uploading: false, error: null })
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            resolve({ file: {} } as UploadResult)
          }
        } else {
          let errorMsg = '업로드 실패'
          try {
            const errorData = JSON.parse(xhr.responseText)
            errorMsg = errorData.error?.message || errorMsg
          } catch {
            if (xhr.status === 413) {
              errorMsg = '파일 크기가 너무 큽니다'
            } else if (xhr.status === 400) {
              errorMsg = '허용되지 않은 파일 형식입니다'
            }
          }
          setState({ progress: 0, uploading: false, error: errorMsg })
          reject(new Error(errorMsg))
        }
      }

      // 네트워크 에러
      xhr.onerror = () => {
        xhrRef.current = null
        const errorMsg = '네트워크 오류가 발생했습니다'
        setState({ progress: 0, uploading: false, error: errorMsg })
        reject(new Error(errorMsg))
      }

      // 취소
      xhr.onabort = () => {
        xhrRef.current = null
        setState({ progress: 0, uploading: false, error: null })
        reject(new Error('업로드가 취소되었습니다'))
      }

      // 요청 전송
      xhr.open('POST', url)
      xhr.withCredentials = true  // 쿠키 포함 (httpOnly 토큰)
      xhr.send(formData)
    })
  }, [])

  const cancel = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort()
    }
  }, [])

  const reset = useCallback(() => {
    setState({ progress: 0, uploading: false, error: null })
  }, [])

  return {
    ...state,
    upload,
    cancel,
    reset,
  }
}
```

### useFileValidation (사전 검증)

```ts
// hooks/useFileValidation.ts

const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_VIDEO_SIZE = 100 * 1024 * 1024

const ALLOWED_TYPES: Record<string, string[]> = {
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  image: ['image/jpeg', 'image/png'],
  video: ['video/mp4'],
  archive: ['application/zip', 'application/x-zip-compressed'],
}

const ALL_ALLOWED_TYPES = Object.values(ALLOWED_TYPES).flat()

interface ValidationResult {
  valid: boolean
  error: string | null
}

export function validateFile(file: File): ValidationResult {
  // 파일 타입 검증
  if (!ALL_ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: '허용되지 않은 파일 형식입니다. (pdf, docx, pptx, xlsx, jpg, png, mp4, zip)',
    }
  }

  // 파일 크기 검증
  const isVideo = file.type === 'video/mp4'
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE
  const maxSizeMB = maxSize / 1024 / 1024

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `파일 크기가 ${maxSizeMB}MB를 초과합니다.`,
    }
  }

  return { valid: true, error: null }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
```

## 컴포넌트 구현

### FileUploader (범용 파일 업로드)

```tsx
// components/FileUploader.tsx
import { useRef, useState } from 'react'
import { Upload, X, File, AlertCircle } from 'lucide-react'
import { Button, ProgressBar } from './ui'
import { useFileUpload } from '../hooks/useFileUpload'
import { validateFile, formatFileSize } from '../hooks/useFileValidation'

interface FileUploaderProps {
  url: string
  extraData?: Record<string, string>
  onSuccess?: (result: any) => void
  onError?: (error: string) => void
  accept?: string
  maxSize?: number
  label?: string
  disabled?: boolean
}

export function FileUploader({
  url,
  extraData,
  onSuccess,
  onError,
  accept = '.pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.zip,.mp4',
  label = '파일 선택',
  disabled = false,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { progress, uploading, error, upload, cancel, reset } = useFileUpload()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 사전 검증
    const validation = validateFile(file)
    if (!validation.valid) {
      onError?.(validation.error!)
      return
    }

    setSelectedFile(file)

    try {
      const result = await upload(file, url, extraData)
      onSuccess?.(result)
      setSelectedFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      onError?.(err instanceof Error ? err.message : '업로드 실패')
    }
  }

  const handleCancel = () => {
    cancel()
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      {/* 파일 선택 버튼 */}
      {!uploading && (
        <label className="cursor-pointer">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            className="hidden"
          />
          <div className={`
            flex items-center justify-center gap-2 px-4 py-3
            border border-dashed border-gray-300 rounded-lg
            hover:border-[#534AB7] hover:bg-[#EEEDFE]/30
            transition-colors
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}>
            <Upload size={18} className="text-gray-400" />
            <span className="text-sm text-gray-600">{label}</span>
          </div>
        </label>
      )}

      {/* 업로드 진행 상태 */}
      {uploading && selectedFile && (
        <div className="bg-[#F8F7F4] rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <File size={20} className="text-[#534AB7]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>

          <ProgressBar value={progress} />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {progress}% 업로드 중...
            </span>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X size={14} />
              취소
            </Button>
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#FAECE7] rounded-lg">
          <AlertCircle size={16} className="text-[#993C1D]" />
          <span className="text-sm text-[#993C1D]">{error}</span>
        </div>
      )}
    </div>
  )
}
```

### ProgressBar (진행률 바)

```tsx
// components/ui.tsx 에 추가

interface ProgressBarProps {
  value: number  // 0-100
  className?: string
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  return (
    <div className={`w-full h-2 bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-[#534AB7] transition-all duration-200 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
```

### FilePreview (업로드된 파일 표시)

```tsx
// components/FilePreview.tsx
import { File, Download, Trash2, Image, FileText, Video } from 'lucide-react'
import { Button } from './ui'
import { formatFileSize } from '../hooks/useFileValidation'

interface FileInfo {
  id: number
  original_name: string
  mimetype: string
  size: number
  url: string
}

interface FilePreviewProps {
  file: FileInfo
  onDelete?: () => void
  canDelete?: boolean
}

function getFileIcon(mimetype: string) {
  if (mimetype.startsWith('image/')) return Image
  if (mimetype.startsWith('video/')) return Video
  return FileText
}

export function FilePreview({ file, onDelete, canDelete = true }: FilePreviewProps) {
  const Icon = getFileIcon(file.mimetype)

  const handleDownload = () => {
    window.open(file.url, '_blank')
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-[#F8F7F4] rounded-lg">
      <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg">
        <Icon size={20} className="text-[#534AB7]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {file.original_name}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.size)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download size={16} />
        </Button>
        {canDelete && onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 size={16} className="text-[#993C1D]" />
          </Button>
        )}
      </div>
    </div>
  )
}
```

## 사용 예시

### 과제 제출 화면

```tsx
// pages/AssignmentDetail.tsx
import { FileUploader } from '../components/FileUploader'
import { FilePreview } from '../components/FilePreview'
import { toast } from '../components/ui'

function AssignmentSubmission({ submissionId, questionId }: Props) {
  const [uploadedFile, setUploadedFile] = useState<FileInfo | null>(null)

  const handleUploadSuccess = (result: any) => {
    setUploadedFile(result.file)
    toast.success('파일이 업로드되었습니다.')
  }

  const handleUploadError = (error: string) => {
    toast.error(error)
  }

  const handleDelete = async () => {
    if (!uploadedFile) return

    try {
      await api(`/files/${uploadedFile.id}`, { method: 'DELETE' })
      setUploadedFile(null)
      toast.success('파일이 삭제되었습니다.')
    } catch (err) {
      toast.error('파일 삭제에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">파일 첨부</h3>

      {uploadedFile ? (
        <FilePreview
          file={uploadedFile}
          onDelete={handleDelete}
        />
      ) : (
        <FileUploader
          url={`/api/v1/submissions/${submissionId}/files`}
          extraData={{ question_id: String(questionId) }}
          onSuccess={handleUploadSuccess}
          onError={handleUploadError}
          label="파일을 선택하거나 드래그하세요"
        />
      )}
    </div>
  )
}
```

### 게시물 첨부 파일

```tsx
// pages/PostCreate.tsx
function PostCreate({ classId }: Props) {
  const [attachments, setAttachments] = useState<FileInfo[]>([])

  const handleUploadSuccess = (result: any) => {
    setAttachments((prev) => [...prev, result.file])
  }

  const handleDeleteFile = async (fileId: number) => {
    await api(`/files/${fileId}`, { method: 'DELETE' })
    setAttachments((prev) => prev.filter((f) => f.id !== fileId))
  }

  return (
    <div className="space-y-4">
      {/* 첨부된 파일 목록 */}
      {attachments.map((file) => (
        <FilePreview
          key={file.id}
          file={file}
          onDelete={() => handleDeleteFile(file.id)}
        />
      ))}

      {/* 파일 추가 */}
      <FileUploader
        url="/api/v1/files"
        extraData={{ context: 'post', post_id: String(postId) }}
        onSuccess={handleUploadSuccess}
        onError={(error) => toast.error(error)}
      />
    </div>
  )
}
```

### 카메라 직접 촬영 (모바일)

```tsx
// 모바일에서 카메라로 바로 촬영
<FileUploader
  url={`/api/v1/submissions/${submissionId}/files`}
  accept="image/*"
  extraData={{ question_id: String(questionId) }}
  onSuccess={handleUploadSuccess}
/>

// input에 capture 속성 추가
<input
  type="file"
  accept="image/*"
  capture="environment"  // 후면 카메라
  onChange={handleFileSelect}
/>
```

## 레이아웃

### 파일 업로드 영역

```
┌─────────────────────────────────────────────────┐
│                                                 │
│     ┌────────────────────────────────────┐      │
│     │   ⬆  파일을 선택하거나 드래그하세요  │      │
│     │      pdf, docx, pptx, jpg, png      │      │
│     │           최대 20MB                │      │
│     └────────────────────────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 업로드 진행 상태

```
┌─────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────┐ │
│ │ 📄 보고서.pdf                               │ │
│ │    2.5 MB                                   │ │
│ │                                             │ │
│ │ ████████████░░░░░░░░░░░░░░░░░░░░  45%       │ │
│ │                                             │ │
│ │ 45% 업로드 중...              [취소]        │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 업로드 완료

```
┌─────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────┐ │
│ │ 📄 보고서.pdf              [⬇] [🗑]         │ │
│ │    2.5 MB                                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌────────────────────────────────────┐          │
│ │   ⬆  파일 추가                      │          │
│ └────────────────────────────────────┘          │
└─────────────────────────────────────────────────┘
```

## 에러 처리

### 에러 코드별 메시지

| 에러 | 메시지 | UI 처리 |
|------|--------|---------|
| 파일 크기 초과 | 파일 크기가 20MB를 초과합니다 | 빨간 배너 표시 |
| 잘못된 파일 형식 | 허용되지 않은 파일 형식입니다 | 빨간 배너 표시 |
| 네트워크 오류 | 네트워크 오류가 발생했습니다 | 재시도 버튼 표시 |
| 업로드 취소 | (메시지 없음) | 상태 초기화 |
| 권한 없음 | 파일 업로드 권한이 없습니다 | Toast 에러 |

### 에러 표시 컴포넌트

```tsx
{error && (
  <div className="flex items-center gap-2 px-3 py-2 bg-[#FAECE7] rounded-lg">
    <AlertCircle size={16} className="text-[#993C1D]" />
    <span className="text-sm text-[#993C1D]">{error}</span>
    <Button variant="ghost" size="sm" onClick={reset}>
      닫기
    </Button>
  </div>
)}
```

## 보안 체크리스트

- [ ] 클라이언트 측 파일 크기/타입 사전 검증
- [ ] `withCredentials: true`로 쿠키 전송
- [ ] 업로드 취소 시 XHR abort 처리
- [ ] 에러 발생 시 적절한 메시지 표시
- [ ] 민감한 파일 정보 노출 방지
- [ ] 진행률 표시로 사용자 경험 개선
