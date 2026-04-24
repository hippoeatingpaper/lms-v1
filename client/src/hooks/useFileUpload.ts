/**
 * useFileUpload — XHR 기반 파일 업로드 훅
 *
 * 기능:
 * - 진행률 추적 (xhr.upload.onprogress)
 * - 업로드 취소 (xhr.abort())
 * - 에러 처리 + 상태 관리
 * - httpOnly 쿠키 자동 전송 (withCredentials)
 *
 * @example
 * const { progress, uploading, error, upload, cancel, reset } = useFileUpload()
 *
 * const handleUpload = async (file: File) => {
 *   try {
 *     const result = await upload(file, '/api/v1/files', { context: 'post' })
 *     console.log('업로드 완료:', result.file)
 *   } catch (err) {
 *     console.error('업로드 실패:', err)
 *   }
 * }
 */

import { useState, useRef, useCallback } from 'react'

export interface UploadState {
  progress: number      // 0-100 (%)
  uploading: boolean    // 업로드 중 여부
  error: string | null  // 에러 메시지
}

export interface UploadedFile {
  id: number
  filename: string
  original_name: string
  mimetype: string
  size: number
  url: string
}

export interface UploadResult {
  file: UploadedFile
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
            resolve({ file: {} as UploadedFile })
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
            } else if (xhr.status === 401) {
              errorMsg = '로그인이 필요합니다'
            } else if (xhr.status === 403) {
              errorMsg = '파일 업로드 권한이 없습니다'
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
