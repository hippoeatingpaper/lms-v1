/**
 * useFileValidation — 파일 검증 유틸리티
 *
 * 기능:
 * - 파일 크기 검증 (일반 20MB, 동영상 100MB)
 * - 파일 타입(MIME) 검증
 * - 파일 크기 포맷팅
 *
 * @example
 * import { validateFile, formatFileSize } from '../hooks/useFileValidation'
 *
 * const validation = validateFile(file)
 * if (!validation.valid) {
 *   toast.error(validation.error)
 *   return
 * }
 *
 * console.log(formatFileSize(file.size)) // "2.5 MB"
 */

// 파일 크기 제한
export const MAX_FILE_SIZE = 20 * 1024 * 1024      // 20MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024   // 100MB

// 허용 MIME 타입
export const ALLOWED_TYPES: Record<string, string[]> = {
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

export const ALL_ALLOWED_TYPES = Object.values(ALLOWED_TYPES).flat()

// 허용 확장자 (accept 속성용)
export const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.mp4'

export interface ValidationResult {
  valid: boolean
  error: string | null
}

/**
 * 파일 유효성 검사
 * @param file 검증할 파일
 * @returns 검증 결과 (valid: boolean, error: string | null)
 */
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

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 * @param bytes 바이트 수
 * @returns 포맷된 문자열 (예: "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 파일 타입에 따른 카테고리 반환
 * @param mimetype MIME 타입
 * @returns 카테고리 (document, image, video, archive, unknown)
 */
export function getFileCategory(mimetype: string): 'document' | 'image' | 'video' | 'archive' | 'unknown' {
  for (const [category, types] of Object.entries(ALLOWED_TYPES)) {
    if (types.includes(mimetype)) {
      return category as 'document' | 'image' | 'video' | 'archive'
    }
  }
  return 'unknown'
}
