import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, FileText, Upload } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'
import { useToast, TopBar } from '../components/ui'
import {
  Button,
  Input,
  Textarea,
  Skeleton,
  ProgressBar,
} from '../components/ui'
import type { PostDetail as PostDetailType } from '../types/post'

// 파일 크기 포맷
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface UploadedFile {
  id: number
  filename: string
  original_name: string
  size: number
}

// 파일 업로드 Zone
interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}

function FileUploadZone({ onFileSelect, disabled }: FileUploadZoneProps) {
  const ACCEPT =
    '.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.jpg,.jpeg,.png,.zip,.mp4'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onFileSelect(e.target.files[0])
      e.target.value = '' // 같은 파일 재선택 허용
    }
  }

  return (
    <div className="border border-dashed border-black/20 rounded-xl p-4 text-center">
      <Upload size={18} strokeWidth={1.3} className="mx-auto mb-1.5 text-gray-400" />
      <p className="text-xs text-gray-400 mb-2.5">
        파일을 선택하거나 드래그하여 업로드
      </p>
      <label
        className={`inline-block px-3 py-1.5 border border-black/15 rounded-lg text-xs text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        파일 선택
        <input
          type="file"
          className="hidden"
          onChange={handleChange}
          accept={ACCEPT}
          disabled={disabled}
        />
      </label>
    </div>
  )
}

// 게시물 작성/수정 페이지
export function PostForm() {
  const { classId, postId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const toast = useToast()

  const isEdit = !!postId

  // 상태
  const [type, setType] = useState<'notice' | 'material'>('notice')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // 교사만 접근 가능
  useEffect(() => {
    if (user?.role !== 'teacher') {
      toast.error('권한이 없습니다.')
      navigate(`/class/${classId}/posts`)
    }
  }, [user, classId, navigate, toast])

  // 수정 모드: 기존 게시물 로드
  useEffect(() => {
    if (!isEdit) return

    const loadPost = async () => {
      setLoading(true)
      try {
        const data = await api<{ post: PostDetailType }>(`/posts/${postId}`)
        const post = data.post
        setType(post.type as 'notice' | 'material')
        setTitle(post.title)
        setContent(post.content)
        setFiles(post.files)
      } catch {
        toast.error('게시물을 불러오지 못했습니다.')
        navigate(`/class/${classId}/board`)
      } finally {
        setLoading(false)
      }
    }
    loadPost()
  }, [isEdit, postId, classId, navigate, toast])

  // 파일 업로드
  const handleFileSelect = async (file: File) => {
    // 파일 크기 제한 (일반 20MB, mp4 100MB)
    const maxSize = file.type === 'video/mp4' ? 100 * 1024 * 1024 : 20 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(`파일 크기가 너무 큽니다. (최대 ${file.type === 'video/mp4' ? '100MB' : '20MB'})`)
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      const result = await new Promise<{ file: UploadedFile }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error('업로드 실패'))
          }
        }
        xhr.onerror = () => reject(new Error('업로드 실패'))
        xhr.open('POST', '/api/v1/files')
        xhr.withCredentials = true
        xhr.send(formData)
      })

      setFiles([...files, result.file])
      toast.success('파일이 업로드되었습니다.')
    } catch {
      toast.error('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  // 파일 제거
  const handleFileRemove = (fileId: number) => {
    setFiles(files.filter((f) => f.id !== fileId))
  }

  // 게시물 제출
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력하세요.')
      return
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await api(`/posts/${postId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            file_ids: files.map((f) => f.id),
          }),
        })
        toast.success('게시물이 수정되었습니다.')
      } else {
        await api(`/classes/${classId}/posts`, {
          method: 'POST',
          body: JSON.stringify({
            type,
            title: title.trim(),
            content: content.trim(),
            file_ids: files.map((f) => f.id),
          }),
        })
        toast.success('게시물이 등록되었습니다.')
      }
      navigate(`/class/${classId}/board`)
    } catch {
      toast.error(isEdit ? '수정에 실패했습니다.' : '등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // 뒤로가기
  const handleBack = () => {
    if (title.trim() || content.trim() || files.length > 0) {
      if (!confirm('작성 중인 내용이 사라집니다. 나가시겠습니까?')) return
    }
    navigate(`/class/${classId}/board`)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <TopBar
          title={isEdit ? '게시물 수정' : '글쓰기'}
          showBack
          onBack={handleBack}
        />
        <div className="p-5 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg font-medium">
          {isEdit ? '게시물 수정' : '글쓰기'}
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleBack}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            loading={submitting}
          >
            {isEdit ? '수정' : '등록'}
          </Button>
        </div>
      </div>

      {/* 유형 선택 (작성 시에만) */}
      {!isEdit && (
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-2 block">
            유형
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={type === 'notice'}
                onChange={() => setType('notice')}
                className="accent-[#534AB7]"
              />
              <span className="text-sm">공지</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={type === 'material'}
                onChange={() => setType('material')}
                className="accent-[#534AB7]"
              />
              <span className="text-sm">자료</span>
            </label>
          </div>
        </div>
      )}

      {/* 제목 */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-2 block">
          제목
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          filled={!!title.trim()}
        />
      </div>

      {/* 내용 */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-2 block">
          내용
        </label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          rows={10}
          filled={!!content.trim()}
        />
      </div>

      {/* 첨부파일 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">
          첨부파일
        </label>
        <FileUploadZone onFileSelect={handleFileSelect} disabled={uploading} />

        {/* 업로드 진행률 */}
        {uploading && (
          <div className="mt-2">
            <ProgressBar value={uploadProgress} />
            <p className="text-xs text-gray-500 mt-1 text-center">
              업로드 중... {uploadProgress}%
            </p>
          </div>
        )}

        {/* 첨부된 파일 목록 */}
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-[#F7F6F3] rounded-lg"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm truncate">{file.original_name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    ({formatFileSize(file.size)})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFileRemove(file.id)}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PostForm
