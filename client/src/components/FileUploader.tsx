/**
 * FileUploader — 범용 파일 업로드 컴포넌트
 *
 * 기능:
 * - 파일 선택 (드래그 앤 드롭 영역)
 * - 업로드 진행률 표시
 * - 업로드 취소
 * - 에러 표시
 * - 사전 검증 (파일 크기/타입)
 *
 * @example
 * <FileUploader
 *   url="/api/v1/files"
 *   extraData={{ context: 'post', post_id: '123' }}
 *   onSuccess={(result) => console.log(result.file)}
 *   onError={(error) => toast.error(error)}
 *   label="파일을 선택하세요"
 * />
 */

import { useRef, useState } from 'react'
import { Upload, X, File, AlertCircle } from 'lucide-react'
import { Button, ProgressBar } from './ui'
import { useFileUpload, UploadResult } from '../hooks/useFileUpload'
import { validateFile, formatFileSize, ALLOWED_EXTENSIONS } from '../hooks/useFileValidation'

interface FileUploaderProps {
  /** 업로드 API URL */
  url: string
  /** 추가 데이터 (context, post_id, question_id 등) */
  extraData?: Record<string, string>
  /** 업로드 성공 시 콜백 */
  onSuccess?: (result: UploadResult) => void
  /** 업로드 실패 시 콜백 */
  onError?: (error: string) => void
  /** 파일 accept 속성 */
  accept?: string
  /** 업로드 영역 라벨 */
  label?: string
  /** 비활성화 여부 */
  disabled?: boolean
  /** 카메라 촬영 버튼 표시 여부 (모바일) */
  showCamera?: boolean
}

export function FileUploader({
  url,
  extraData,
  onSuccess,
  onError,
  accept = ALLOWED_EXTENSIONS,
  label = '파일 선택',
  disabled = false,
  showCamera = false,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
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
      if (cameraRef.current) cameraRef.current.value = ''
    } catch (err) {
      onError?.(err instanceof Error ? err.message : '업로드 실패')
    }
  }

  const handleCancel = () => {
    cancel()
    setSelectedFile(null)
    if (inputRef.current) inputRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const handleReset = () => {
    reset()
  }

  return (
    <div className="space-y-3">
      {/* 파일 선택 버튼 */}
      {!uploading && (
        <div className="border border-dashed border-black/20 rounded-xl p-4 text-center">
          <Upload size={18} strokeWidth={1.3} className="mx-auto mb-1.5 text-gray-400" />
          <p className="text-xs text-gray-400 mb-2.5">{label}</p>
          <div className="flex gap-1.5 justify-center">
            <label className={`
              px-3 py-1.5 border border-black/15 rounded-lg text-xs
              text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}>
              파일 선택
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                disabled={disabled}
                className="hidden"
              />
            </label>
            {showCamera && (
              <label className={`
                px-3 py-1.5 bg-[#EEEDFE] border border-[#AFA9EC] rounded-lg
                text-xs text-[#3C3489] cursor-pointer hover:bg-[#AFA9EC]/20 transition-colors
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}>
                카메라
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  disabled={disabled}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="text-[9px] text-gray-300 mt-2">
            pdf, docx, pptx, xlsx, jpg, png, mp4, zip · 최대 20MB (동영상 100MB)
          </p>
        </div>
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
          <AlertCircle size={16} className="text-[#993C1D] flex-shrink-0" />
          <span className="text-sm text-[#993C1D] flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            닫기
          </Button>
        </div>
      )}
    </div>
  )
}
