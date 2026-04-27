import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageCircle, Heart, Plus, FileText } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../lib/api'
import { useToast } from '../components/ui'
import {
  Button,
  Input,
  Tabs,
  Tab,
  EmptyState,
  Skeleton,
  Avatar,
  PostTypeBadge,
} from '../components/ui'
import type {
  Post,
  PostDetail as PostDetailType,
  PostType,
  PostListResponse,
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

// 게시물 목록 행 컴포넌트
interface PostRowProps {
  post: Post
  selected?: boolean
  onClick: () => void
}

function PostRow({ post, selected, onClick }: PostRowProps) {
  return (
    <div
      className={`p-3 border-b border-black/5 cursor-pointer hover:bg-[#F7F6F3] transition-colors ${
        selected ? 'bg-[#EEEDFE] border-l-2 border-l-[#534AB7]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <PostTypeBadge type={post.type} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{post.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {post.author.name} · {formatDate(post.created_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <MessageCircle size={12} /> {post.comment_count}
        </span>
        <span className="flex items-center gap-1">
          <Heart size={12} /> {post.like_count}
        </span>
      </div>
    </div>
  )
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
    <div className="flex gap-2 p-3 border-t border-black/10 bg-white">
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
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
            <span className="text-sm">{file.original_name}</span>
            <span className="text-xs text-gray-400">
              ({formatFileSize(file.size)})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownload(file.id)}
          >
            다운로드
          </Button>
        </div>
      ))}
    </div>
  )
}

// 게시물 상세 패널 컴포넌트
interface PostDetailPanelProps {
  postId: number
  onPostDeleted: () => void
}

function PostDetailPanel({ postId, onPostDeleted }: PostDetailPanelProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()
  const { classId } = useParams()

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
      } catch (err) {
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
      onPostDeleted()
    } catch {
      toast.error('게시물 삭제에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!post) {
    return (
      <EmptyState
        icon={FileText}
        message="게시물을 찾을 수 없습니다."
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="p-4 border-b border-black/10">
        <div className="flex items-start justify-between mb-2">
          <PostTypeBadge type={post.type} />
          {canModifyPost(user, post) && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate(`/class/${classId}/board/${post.id}/edit`)
                }
              >
                수정
              </Button>
              <Button variant="ghost" size="sm" onClick={handlePostDelete}>
                삭제
              </Button>
            </div>
          )}
        </div>
        <h2 className="text-lg font-medium text-gray-900">{post.title}</h2>
        <p className="text-xs text-gray-500 mt-1">
          {post.author.name} · {formatDate(post.created_at)}
        </p>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-4">
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

        {/* 댓글 섹션 */}
        <div className="mt-6">
          <p className="text-xs font-medium text-gray-500 mb-3">
            댓글 {post.comment_count}개
          </p>
          {commentLoading ? (
            <div className="space-y-3">
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
                <p className="text-sm text-gray-400 text-center py-4">
                  첫 번째 댓글을 남겨보세요.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 댓글 입력 */}
      <CommentInput onSubmit={handleCommentSubmit} loading={submittingComment} />
    </div>
  )
}

// 필터 탭 정의
const filterTabs: { value: PostType | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'notice', label: '공지' },
  { value: 'material', label: '자료' },
  { value: 'published_submission', label: '공개과제' },
]

// 메인 Board 컴포넌트
export function Board() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const toast = useToast()

  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
  const [filter, setFilter] = useState<PostType | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)

  const isTeacher = user?.role === 'teacher'

  // 게시물 목록 로드
  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true)
      try {
        const typeParam = filter !== 'all' ? `&type=${filter}` : ''
        const data = await api<PostListResponse>(
          `/classes/${classId}/posts?page=${page}${typeParam}`
        )
        setPosts(data.posts)
        setTotalPages(data.pagination.total_pages)
        setTotalPosts(data.pagination.total)

        // 첫 게시물 자동 선택 (교사 뷰에서만)
        if (isTeacher && data.posts.length > 0 && !selectedPostId) {
          setSelectedPostId(data.posts[0].id)
        }
      } catch {
        toast.error('게시물을 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadPosts()
  }, [classId, filter, page, toast, isTeacher])

  // 필터 변경 시 선택 초기화
  useEffect(() => {
    setSelectedPostId(null)
    setPage(1)
  }, [filter])

  // 게시물 삭제 후 처리
  const handlePostDeleted = () => {
    setPosts(posts.filter((p) => p.id !== selectedPostId))
    setSelectedPostId(null)
  }

  // 게시물 클릭 (모바일: 별도 페이지, 데스크톱: 패널)
  const handlePostClick = (postId: number) => {
    if (isTeacher) {
      setSelectedPostId(postId)
    } else {
      navigate(`/class/${classId}/posts/${postId}`)
    }
  }

  // 교사 뷰: 마스터-디테일 레이아웃
  if (isTeacher) {
    return (
      <div className="bg-white rounded-xl border border-black/10 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
        <div className="grid grid-cols-[350px_1fr] flex-1 min-h-0">
          {/* 마스터: 게시물 목록 */}
          <aside className="border-r border-black/10 flex flex-col min-h-0">
            {/* 헤더 - 필터 + 글쓰기 */}
            <div className="p-3 border-b border-black/10 flex-shrink-0">
              <div className="flex justify-between items-center gap-2">
                <div className="overflow-x-auto">
                  <Tabs value={filter} onChange={(v) => setFilter(v as PostType | 'all')}>
                    {filterTabs.map((tab) => (
                      <Tab key={tab.value} value={tab.value} label={tab.label} />
                    ))}
                  </Tabs>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/class/${classId}/board/new`)}
                  className="flex-shrink-0"
                >
                  <Plus size={14} /> 글쓰기
                </Button>
              </div>
            </div>

            {/* 게시물 목록 - 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <EmptyState icon={FileText} message="게시물이 없습니다." />
              ) : (
                <div className="divide-y divide-black/5">
                  {posts.map((post) => (
                    <PostRow
                      key={post.id}
                      post={post}
                      selected={post.id === selectedPostId}
                      onClick={() => handlePostClick(post.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 페이지네이션 - 항상 표시 */}
            <div className="p-3 border-t border-black/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  총 {totalPosts}개
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    이전
                  </Button>
                  <span className="text-xs text-gray-500 min-w-[60px] text-center">
                    {page} / {Math.max(1, totalPages)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </div>
          </aside>

          {/* 디테일: 게시물 상세 */}
          <main className="overflow-hidden min-h-0">
            {selectedPostId ? (
              <PostDetailPanel
                postId={selectedPostId}
                onPostDeleted={handlePostDeleted}
              />
            ) : (
              <EmptyState icon={FileText} message="게시물을 선택하세요" />
            )}
          </main>
        </div>
      </div>
    )
  }

  // 학생 뷰: 모바일 목록
  return (
    <div className="space-y-4">
      {/* 필터 탭 */}
      <div className="overflow-x-auto -mx-3 px-3">
        <Tabs value={filter} onChange={(v) => setFilter(v as PostType | 'all')}>
          {filterTabs.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>
      </div>

      {/* 게시물 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon={FileText} message="게시물이 없습니다." />
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => handlePostClick(post.id)}
              className="p-3 bg-white rounded-xl border border-black/10 cursor-pointer hover:bg-[#F7F6F3] transition-colors"
            >
              <div className="flex items-start gap-2">
                <PostTypeBadge type={post.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {post.author.name} · {formatDate(post.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <MessageCircle size={12} /> {post.comment_count}
                </span>
                <span className="flex items-center gap-1">
                  <Heart size={12} /> {post.like_count}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            이전
          </Button>
          <span className="text-xs text-gray-500 py-1.5">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  )
}

export default Board
