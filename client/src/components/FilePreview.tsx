/**
 * FilePreview — 업로드된 파일 미리보기 컴포넌트
 *
 * 기능:
 * - 파일 정보 표시 (이름, 크기)
 * - 파일 타입에 따른 아이콘
 * - 다운로드 버튼
 * - 삭제 버튼
 *
 * @example
 * <FilePreview
 *   file={{ id: 1, original_name: '보고서.pdf', mimetype: 'application/pdf', size: 1024000, url: '/api/v1/files/1/download' }}
 *   onDelete={() => handleDeleteFile(1)}
 * />
 */

import { File, Download, Trash2, Image, FileText, Video, Archive } from 'lucide-react'
import { Button } from './ui'
import { formatFileSize, getFileCategory } from '../hooks/useFileValidation'

export interface FileInfo {
  id: number
  original_name: string
  mimetype: string
  size: number
  url: string
}

interface FilePreviewProps {
  /** 파일 정보 */
  file: FileInfo
  /** 삭제 핸들러 */
  onDelete?: () => void
  /** 삭제 버튼 표시 여부 */
  canDelete?: boolean
  /** 로딩 상태 (삭제 중) */
  isDeleting?: boolean
}

/**
 * MIME 타입에 따른 아이콘 반환
 */
function getFileIcon(mimetype: string) {
  const category = getFileCategory(mimetype)
  switch (category) {
    case 'image':
      return Image
    case 'video':
      return Video
    case 'archive':
      return Archive
    default:
      return FileText
  }
}

/**
 * MIME 타입에 따른 아이콘 색상 반환
 */
function getIconColor(mimetype: string) {
  const category = getFileCategory(mimetype)
  switch (category) {
    case 'image':
      return 'text-[#0F6E56]'
    case 'video':
      return 'text-[#993C1D]'
    case 'archive':
      return 'text-[#633806]'
    default:
      return 'text-[#534AB7]'
  }
}

export function FilePreview({
  file,
  onDelete,
  canDelete = true,
  isDeleting = false,
}: FilePreviewProps) {
  const Icon = getFileIcon(file.mimetype)
  const iconColor = getIconColor(file.mimetype)

  const handleDownload = () => {
    window.open(file.url, '_blank')
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-[#F8F7F4] rounded-lg">
      {/* 아이콘 */}
      <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg flex-shrink-0">
        <Icon size={20} className={iconColor} />
      </div>

      {/* 파일 정보 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {file.original_name}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.size)}
        </p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={handleDownload} title="다운로드">
          <Download size={16} />
        </Button>
        {canDelete && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            title="삭제"
          >
            <Trash2 size={16} className="text-[#993C1D]" />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * FilePreviewList — 여러 파일 미리보기
 */
interface FilePreviewListProps {
  files: FileInfo[]
  onDelete?: (fileId: number) => void
  canDelete?: boolean
  deletingId?: number | null
}

export function FilePreviewList({
  files,
  onDelete,
  canDelete = true,
  deletingId = null,
}: FilePreviewListProps) {
  if (files.length === 0) return null

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FilePreview
          key={file.id}
          file={file}
          onDelete={onDelete ? () => onDelete(file.id) : undefined}
          canDelete={canDelete}
          isDeleting={deletingId === file.id}
        />
      ))}
    </div>
  )
}
