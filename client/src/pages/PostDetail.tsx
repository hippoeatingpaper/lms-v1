import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, FileText, Download } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'
import { useToast, TopBar } from '../components/ui'
import {
  Button,
  Input,
  EmptyState,
  Skeleton,
  Avatar,
  PostTypeBadge,
} from '../components/ui'
import type {
  PostDetail as PostDetailType,
  Comment,
  CommentListResponse,
  CommentCreateResponse,
  LikeResponse,
} from '../types/post'

// 날짜 포맷
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) return '방금 전'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}분 전`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}시간 전`

  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day}`
}

// 파일 크기 포맷
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// 권한 체크 함수
function canModifyPost(
  user: { id: number; role: string } | null,
  post: { author: { id: number } }
): boolean {
  if (!user) return false
  if (user.role === 'teacher') return true
  return post.author.id === user.id
}

function canDeleteComment(
  user: { id: number; role: string } | null,
  comment: { author: { id: number } }
): boolean {
  if (!user) return false
  if (user.role === 'teacher') return true
  return comment.author.id === user.id
}

// 좋아요 버튼 컴포넌트
interface LikeButtonProps {
  liked: boolean
  count: number
  onClick: () => void
}

function LikeButton({ liked, count, onClick }: LikeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
        liked
          ? 'bg-[#FAECE7] text-[#993C1D]'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <Heart size={16} fill={liked ? '#993C1D' : 'none'} strokeWidth={1.5} />
      좋아요 {count}
    </button>
  )
}

// 댓글 아이템 컴포넌트
interface CommentItemProps {
  comment: Comment
  canDelete: boolean
  onDelete: () => void
}

function CommentItem({ comment, canDelete, onDelete }: CommentItemProps) {
  return (
    <div className="py-3 border-b border-black/5 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={comment.author.name} size="sm" />
          <span className="text-xs font-medium">{comment.author.name}</span>
          <span className="text-xs text-gray-400">
            {formatDate(comment.created_at)}
          </span>
        </div>
        {canDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            삭제
          </Button>
        )}
      </div>
      <p className="text-sm text-gray-700 mt-1.5 pl-7">{comment.body}</p>
    </div>
  )
}

// 댓글 입력 컴포넌트
interface CommentInputProps {
  onSubmit: (body: string) => void
  loading?: boolean
}

function CommentInput({ onSubmit, loading }: CommentInputProps) {
  const [body, setBody] = useState('')

  const handleSubmit = () => {
    if (!body.trim() || loading) return
    onSubmit(body.trim())
    setBody('')
  }

  return (
    <div className="flex gap-2 p-3 bg-white border-t border-black/10">
      <Input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="댓글을 입력하세요..."
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        className="flex-1"
        disabled={loading}
      />
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        disabled={!body.trim() || loading}
        loading={loading}
      >
        등록
      </Button>
    </div>
  )
}

// 첨부파일 표시 컴포넌트
interface FileAttachmentProps {
  files: { id: number; filename: string; original_name: string; size: number }[]
}

function FileAttachment({ files }: FileAttachmentProps) {
  if (files.length === 0) return null

  const handleDownload = (fileId: number) => {
    window.open(`/api/v1/files/${fileId}/download`, '_blank')
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-gray-500">첨부파일</p>
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
            onClick={() => handleDownload(file.id)}
          >
            <Download size={14} />
          </Button>
        </div>
      ))}
    </div>
  )
}

// 게시물 상세 페이지 (모바일)
export function PostDetail() {
  const { classId, postId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const toast = useToast()

  const [post, setPost] = useState<PostDetailType | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentLoading, setCommentLoading] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  // 게시물 상세 로드
  useEffect(() => {
    const loadPost = async () => {
      setLoading(true)
      try {
        const data = await api<{ post: PostDetailType }>(`/posts/${postId}`)
        setPost(data.post)
      } catch {
        toast.error('게시물을 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadPost()
  }, [postId, toast])

  // 댓글 로드
  useEffect(() => {
    const loadComments = async () => {
      setCommentLoading(true)
      try {
        const data = await api<CommentListResponse>(`/posts/${postId}/comments`)
        setComments(data.comments)
      } catch {
        // 에러 무시
      } finally {
        setCommentLoading(false)
      }
    }
    loadComments()
  }, [postId])

  // 좋아요 토글
  const handleLikeToggle = async () => {
    if (!post) return

    const newLiked = !post.liked_by_me
    const newCount = post.like_count + (newLiked ? 1 : -1)

    // 낙관적 업데이트
    setPost({ ...post, liked_by_me: newLiked, like_count: newCount })

    try {
      await api<LikeResponse>(`/posts/${postId}/like`, { method: 'POST' })
    } catch {
      // 실패 시 롤백
      setPost({ ...post, liked_by_me: !newLiked, like_count: post.like_count })
      toast.error('좋아요 처리에 실패했습니다.')
    }
  }

  // 댓글 작성
  const handleCommentSubmit = async (body: string) => {
    setSubmittingComment(true)
    try {
      const data = await api<CommentCreateResponse>(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      setComments([...comments, data.comment])
      if (post) {
        setPost({ ...post, comment_count: post.comment_count + 1 })
      }
      toast.success('댓글이 등록되었습니다.')
    } catch {
      toast.error('댓글 등록에 실패했습니다.')
    } finally {
      setSubmittingComment(false)
    }
  }

  // 댓글 삭제
  const handleCommentDelete = async (commentId: number) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return

    try {
      await api(`/comments/${commentId}`, { method: 'DELETE' })
      setComments(comments.filter((c) => c.id !== commentId))
      if (post) {
        setPost({ ...post, comment_count: Math.max(0, post.comment_count - 1) })
      }
      toast.success('댓글이 삭제되었습니다.')
    } catch {
      toast.error('댓글 삭제에 실패했습니다.')
    }
  }

  // 게시물 삭제
  const handlePostDelete = async () => {
    if (!confirm('게시물을 삭제하시겠습니까?')) return

    try {
      await api(`/posts/${postId}`, { method: 'DELETE' })
      toast.success('게시물이 삭제되었습니다.')
      navigate(`/class/${classId}/posts`)
    } catch {
      toast.error('게시물 삭제에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F3]">
        <TopBar
          title="게시물"
          showBack
          onBack={() => navigate(`/class/${classId}/posts`)}
        />
        <div className="p-4 space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#F7F6F3]">
        <TopBar
          title="게시물"
          showBack
          onBack={() => navigate(`/class/${classId}/posts`)}
        />
        <EmptyState icon={FileText} message="게시물을 찾을 수 없습니다." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3] flex flex-col">
      {/* 헤더 */}
      <TopBar
        title="게시물"
        showBack
        onBack={() => navigate(`/class/${classId}/posts`)}
        rightElement={
          canModifyPost(user, post) ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate(`/class/${classId}/posts/${post.id}/edit`)
                }
              >
                수정
              </Button>
              <Button variant="ghost" size="sm" onClick={handlePostDelete}>
                삭제
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-black/10">
          {/* 게시물 헤더 */}
          <div className="p-4 border-b border-black/5">
            <PostTypeBadge type={post.type} />
            <h1 className="text-lg font-medium text-gray-900 mt-2">
              {post.title}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {post.author.name} · {formatDate(post.created_at)}
            </p>
          </div>

          {/* 게시물 내용 */}
          <div className="p-4">
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {post.content}
            </div>

            <FileAttachment files={post.files} />

            <div className="mt-6">
              <LikeButton
                liked={post.liked_by_me}
                count={post.like_count}
                onClick={handleLikeToggle}
              />
            </div>
          </div>
        </div>

        {/* 댓글 섹션 */}
        <div className="bg-white mt-2">
          <div className="p-4 border-b border-black/5">
            <p className="text-xs font-medium text-gray-500">
              댓글 {post.comment_count}개
            </p>
          </div>

          <div className="px-4">
            {commentLoading ? (
              <div className="py-4 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div>
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    canDelete={canDeleteComment(user, comment)}
                    onDelete={() => handleCommentDelete(comment.id)}
                  />
                ))}
                {comments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">
                    첫 번째 댓글을 남겨보세요.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 댓글 입력 (하단 고정) */}
      <div className="sticky bottom-0">
        <CommentInput onSubmit={handleCommentSubmit} loading={submittingComment} />
      </div>
    </div>
  )
}

export default PostDetail
