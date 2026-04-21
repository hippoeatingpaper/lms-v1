# 게시판 UI 스펙 (Posts)

> 게시판(공지/자료/공개제출물), 댓글, 좋아요 화면의 프론트엔드 구현 스펙

## 권한 체계

### 권한 표
| 작업 | 교사 | 학생 |
|------|------|------|
| 게시글 작성 | O | X |
| 게시글 수정 | 모든 글 | 본인 글만 |
| 게시글 삭제 | 모든 글 | 본인 글만 |
| 댓글 작성 | O | O |
| 댓글 삭제 | 모든 댓글 | 본인 댓글만 |

### 권한 계산 유틸리티
```ts
// 게시글 수정/삭제 권한
function canModifyPost(user: User, post: Post): boolean {
  if (user.role === 'teacher') return true
  return post.author.id === user.id
}

// 댓글 삭제 권한
function canDeleteComment(user: User, comment: Comment): boolean {
  if (user.role === 'teacher') return true
  return comment.author.id === user.id
}
```

### UI 표시 규칙
- **게시글 수정/삭제 버튼**: `canModifyPost(user, post)`가 true일 때만 표시
- **댓글 삭제 버튼**: `canDeleteComment(user, comment)`가 true일 때만 표시
- **글쓰기 버튼**: `user.role === 'teacher'`일 때만 표시

---

## 페이지 구조

### 1. 게시판 (Board.tsx)
```
경로: /class/:classId/board
권한: 교사, 학생
```

**교사 뷰 (마스터-디테일)**:
```
┌─────────────────────┬───────────────────────────────────┐
│ 게시판              │ 게시물 상세                        │
├─────────────────────┤                                   │
│ [+ 글쓰기] 버튼      │ ┌─────────────────────────────┐  │
├─────────────────────┤ │ [공지] 4월 수업 안내          │  │
│ [전체][공지][자료]   │ │ 김선생 · 2026-04-15          │  │
│ [공개과제] ← 필터탭  │ │                              │  │
├─────────────────────┤ │ 다음 주 수업은...            │  │
│ ┌─────────────────┐ │ │                              │  │
│ │ [공지] 4월 수업  │ │ │ 📎 안내문.pdf (100KB)       │  │
│ │ 김선생 · 4/15   │ │ │                              │  │
│ │ 💬5  ❤️12       │ │ │ ❤️ 12  💬 5                  │  │
│ └─────────────────┘ │ └─────────────────────────────┘  │
│ ← 선택됨 bg-[#EEEDFE]│                                   │
│                     │ ┌─────────────────────────────┐  │
│ ┌─────────────────┐ │ │ 댓글 5개                     │  │
│ │ [자료] 참고문서  │ │ ├─────────────────────────────┤  │
│ │ 김선생 · 4/14   │ │ │ 김민준: 감사합니다!         │  │
│ │ 💬2  ❤️5        │ │ │ 이서연: 확인했습니다        │  │
│ └─────────────────┘ │ │ ...                          │  │
│                     │ ├─────────────────────────────┤  │
│                     │ │ [댓글 입력...]     [등록]    │  │
│                     │ └─────────────────────────────┘  │
└─────────────────────┴───────────────────────────────────┘
```

**학생 뷰 (모바일)**:
```
┌─────────────────────────────────────────────────┐
│ ← 게시판                                        │
├─────────────────────────────────────────────────┤
│ [전체][공지][자료][공개과제] ← 가로 스크롤 탭    │
├─────────────────────────────────────────────────┤
│ PostRow (반복)                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ [공지] 4월 수업 안내                         │ │
│ │ 김선생 · 4/15             💬5  ❤️12    →    │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [자료] 참고 문서                             │ │
│ │ 김선생 · 4/14             💬2  ❤️5     →    │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
│ BottomNav                                       │
└─────────────────────────────────────────────────┘
```

### 2. 게시물 상세 (모바일)
```
경로: /class/:classId/board/:postId (모바일)
      또는 마스터-디테일 패널 (데스크톱)
```

```
┌─────────────────────────────────────────────────┐
│ ← 게시물                [수정][삭제]  [공지]    │
│                         ↑ canModifyPost 시 표시 │
├─────────────────────────────────────────────────┤
│ 4월 수업 안내                                   │
│ 김선생 · 2026-04-15 09:00                       │
├─────────────────────────────────────────────────┤
│ 다음 주 수업은 4월 20일(월)에 진행됩니다.        │
│                                                 │
│ 준비물:                                         │
│ - 필기도구                                      │
│ - 노트북                                        │
├─────────────────────────────────────────────────┤
│ 첨부파일                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📄 안내문.pdf (100KB)              [다운로드]│ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ [❤️ 좋아요 12]                                  │
│ ← 클릭 시 토글, 실시간 업데이트                  │
├─────────────────────────────────────────────────┤
│ 댓글 5개                                        │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ 👤 김민준                      4/15 10:30   │ │
│ │ 감사합니다!                          [삭제] │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ 👤 이서연                      4/15 11:00   │ │
│ │ 확인했습니다!                               │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ [댓글을 입력하세요...]               [등록]     │
└─────────────────────────────────────────────────┘
```

### 3. 글쓰기 (PostCreate.tsx)
```
경로: /class/:classId/board/new
권한: 교사만
```

```
┌─────────────────────────────────────────────────┐
│ ← 글쓰기                           [등록] 버튼  │
├─────────────────────────────────────────────────┤
│ 유형: ○ 공지  ● 자료                            │
├─────────────────────────────────────────────────┤
│ 제목                                            │
│ ┌─────────────────────────────────────────────┐ │
│ │ [제목을 입력하세요]                          │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ 내용                                            │
│ ┌─────────────────────────────────────────────┐ │
│ │                                             │ │
│ │ [내용을 입력하세요]                          │ │
│ │                                             │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ 첨부파일                                        │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ │  📎 파일을 드래그하거나 클릭하여 업로드       │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                                 │
│ 📄 안내문.pdf (100KB)                    [삭제] │
└─────────────────────────────────────────────────┘
```

---

## 컴포넌트 사용법

### PostTypeBadge (게시물 유형 뱃지)

```tsx
import { Badge } from '@/components/ui'

const postTypeBadge = {
  notice: <Badge variant="coral">공지</Badge>,
  material: <Badge variant="purple">자료</Badge>,
  published_submission: <Badge variant="teal">공개과제</Badge>,
}

// 사용
{postTypeBadge[post.type]}
```

### PostRow (게시물 목록 행)

```tsx
// 커스텀 컴포넌트 (ui.tsx에 추가 필요)
interface PostRowProps {
  id: number
  title: string
  type: 'notice' | 'material' | 'published_submission'
  author: { id: number; name: string }
  createdAt: string
  commentCount: number
  likeCount: number
  selected?: boolean
  onClick: () => void
}

function PostRow({
  title, type, author, createdAt, commentCount, likeCount, selected, onClick
}: PostRowProps) {
  return (
    <div
      className={cn(
        'p-3 border-b border-black/5 cursor-pointer hover:bg-[#F7F6F3] transition-colors',
        selected && 'bg-[#EEEDFE] border-l-2 border-l-[#534AB7]'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {postTypeBadge[type]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {author.name} · {formatDate(createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <MessageCircle size={12} /> {commentCount}
        </span>
        <span className="flex items-center gap-1">
          <Heart size={12} /> {likeCount}
        </span>
      </div>
    </div>
  )
}
```

### LikeButton (좋아요 버튼)

```tsx
interface LikeButtonProps {
  liked: boolean
  count: number
  onClick: () => void
}

function LikeButton({ liked, count, onClick }: LikeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors',
        liked
          ? 'bg-[#FAECE7] text-[#993C1D]'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      )}
    >
      <Heart
        size={16}
        fill={liked ? '#993C1D' : 'none'}
        strokeWidth={1.5}
      />
      좋아요 {count}
    </button>
  )
}
```

### CommentItem (댓글 아이템)

```tsx
interface CommentItemProps {
  id: number
  body: string
  author: { id: number; name: string }
  createdAt: string
  canDelete: boolean  // canDeleteComment(user, comment) 결과 전달
  onDelete: () => void
}

function CommentItem({ body, author, createdAt, canDelete, onDelete }: CommentItemProps) {
  return (
    <div className="py-3 border-b border-black/5 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={author.name} size="sm" />
          <span className="text-xs font-medium">{author.name}</span>
          <span className="text-xs text-gray-400">{formatDate(createdAt)}</span>
        </div>
        {canDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 size={14} />
          </Button>
        )}
      </div>
      <p className="text-sm text-gray-700 mt-1.5 pl-8">{body}</p>
    </div>
  )
}

// 사용 예시
{comments.map(comment => (
  <CommentItem
    key={comment.id}
    {...comment}
    canDelete={canDeleteComment(user, comment)}
    onDelete={() => handleDeleteComment(comment.id)}
  />
))}
```

### CommentInput (댓글 입력)

```tsx
function CommentInput({ onSubmit }: { onSubmit: (body: string) => void }) {
  const [body, setBody] = useState('')

  const handleSubmit = () => {
    if (!body.trim()) return
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
      />
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        disabled={!body.trim()}
      >
        등록
      </Button>
    </div>
  )
}
```

### FileAttachment (첨부파일 표시)

```tsx
interface FileAttachmentProps {
  files: Array<{ id: number; filename: string; size: number }>
  onDownload: (fileId: number) => void
}

function FileAttachment({ files, onDownload }: FileAttachmentProps) {
  if (files.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-gray-500">첨부파일</p>
      {files.map(file => (
        <div
          key={file.id}
          className="flex items-center justify-between p-2 bg-[#F7F6F3] rounded-lg"
        >
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-gray-400" />
            <span className="text-sm">{file.filename}</span>
            <span className="text-xs text-gray-400">
              ({formatFileSize(file.size)})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDownload(file.id)}
          >
            <Download size={14} />
          </Button>
        </div>
      ))}
    </div>
  )
}
```

---

## 상태 관리

### 로컬 상태 (Board.tsx)

```ts
// 게시물 목록 + 선택된 게시물
const [posts, setPosts] = useState<Post[]>([])
const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
const [filter, setFilter] = useState<PostType | 'all'>('all')
const [page, setPage] = useState(1)

// 선택된 게시물 상세 정보
const selectedPost = useMemo(
  () => posts.find(p => p.id === selectedPostId),
  [posts, selectedPostId]
)
```

### 댓글 상태

```ts
const [comments, setComments] = useState<Comment[]>([])
const [loadingComments, setLoadingComments] = useState(false)

// 댓글 로드
useEffect(() => {
  if (!selectedPostId) return
  setLoadingComments(true)
  api<{ comments: Comment[] }>(`/posts/${selectedPostId}/comments`)
    .then(data => setComments(data.comments))
    .finally(() => setLoadingComments(false))
}, [selectedPostId])
```

### 좋아요 상태

```ts
// 낙관적 업데이트 (Optimistic Update)
const handleLikeToggle = async () => {
  const newLiked = !selectedPost.liked_by_me
  const newCount = selectedPost.like_count + (newLiked ? 1 : -1)

  // 즉시 UI 업데이트
  setPosts(posts.map(p =>
    p.id === selectedPostId
      ? { ...p, liked_by_me: newLiked, like_count: newCount }
      : p
  ))

  try {
    await api(`/posts/${selectedPostId}/like`, { method: 'POST' })
  } catch {
    // 실패 시 롤백
    setPosts(posts.map(p =>
      p.id === selectedPostId
        ? { ...p, liked_by_me: !newLiked, like_count: selectedPost.like_count }
        : p
    ))
    toast.error('좋아요 처리에 실패했습니다.')
  }
}
```

---

## 게시글 상세 액션 버튼

```tsx
// PostDetail.tsx 또는 PostDetailHeader.tsx
function PostActions({ post }: { post: PostDetail }) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  // 수정/삭제 권한 확인
  const canModify = canModifyPost(user, post)

  if (!canModify) return null

  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/class/${post.class_id}/board/${post.id}/edit`)}
      >
        <Edit size={14} /> 수정
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleDelete(post.id)}
      >
        <Trash2 size={14} /> 삭제
      </Button>
    </div>
  )
}
```

---

## API 호출

```ts
// 게시물 목록
const { posts, pagination } = await api<PostListResponse>(
  `/classes/${classId}/posts?type=${filter}&page=${page}`
)

// 게시물 상세
const { post } = await api<{ post: PostDetail }>(
  `/posts/${postId}`
)

// 게시물 작성 (교사 전용)
await api(`/classes/${classId}/posts`, {
  method: 'POST',
  body: JSON.stringify({ title, content, type, file_ids: uploadedFileIds })
})

// 게시물 수정 (canModifyPost 권한 필요)
await api(`/posts/${postId}`, {
  method: 'PATCH',
  body: JSON.stringify({ title, content, file_ids })
})

// 게시물 삭제 (canModifyPost 권한 필요)
await api(`/posts/${postId}`, { method: 'DELETE' })

// 댓글 목록
const { comments } = await api<{ comments: Comment[] }>(
  `/posts/${postId}/comments`
)

// 댓글 작성
const { comment } = await api(`/posts/${postId}/comments`, {
  method: 'POST',
  body: JSON.stringify({ body })
})

// 댓글 삭제
await api(`/comments/${commentId}`, { method: 'DELETE' })

// 좋아요 토글
const { liked, like_count } = await api(`/posts/${postId}/like`, {
  method: 'POST'
})

// 파일 다운로드
window.open(`/api/v1/files/${fileId}/download`, '_blank')
```

---

## Socket.IO 이벤트

### 실시간 댓글

```ts
// lib/socket.ts 또는 Board.tsx
useEffect(() => {
  // 댓글 추가
  socket.on('comment:created', ({ post_id, comment }) => {
    if (post_id === selectedPostId) {
      setComments(prev => [...prev, comment])
    }
    // 목록의 댓글 수 업데이트
    setPosts(prev => prev.map(p =>
      p.id === post_id
        ? { ...p, comment_count: p.comment_count + 1 }
        : p
    ))
  })

  // 댓글 삭제
  socket.on('comment:deleted', ({ post_id, comment_id }) => {
    if (post_id === selectedPostId) {
      setComments(prev => prev.filter(c => c.id !== comment_id))
    }
    setPosts(prev => prev.map(p =>
      p.id === post_id
        ? { ...p, comment_count: Math.max(0, p.comment_count - 1) }
        : p
    ))
  })

  return () => {
    socket.off('comment:created')
    socket.off('comment:deleted')
  }
}, [selectedPostId])
```

### 실시간 좋아요

```ts
useEffect(() => {
  socket.on('like:updated', ({ post_id, like_count, user_id, liked }) => {
    setPosts(prev => prev.map(p =>
      p.id === post_id
        ? {
            ...p,
            like_count,
            // 내가 토글한 경우만 liked_by_me 업데이트
            liked_by_me: user_id === user.id ? liked : p.liked_by_me
          }
        : p
    ))
  })

  return () => socket.off('like:updated')
}, [user.id])
```

---

## 레이아웃 패턴

### 데스크톱 (마스터-디테일)

```tsx
function Board() {
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)

  return (
    <div className="grid grid-cols-[350px_1fr] h-full">
      {/* 마스터: 게시물 목록 */}
      <aside className="border-r border-black/10 overflow-y-auto">
        <div className="p-3 border-b border-black/10 flex justify-between items-center">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabItem value="all">전체</TabItem>
            <TabItem value="notice">공지</TabItem>
            <TabItem value="material">자료</TabItem>
            <TabItem value="published_submission">공개과제</TabItem>
          </Tabs>
          {user.role === 'teacher' && (
            <Button variant="primary" size="sm" onClick={goToCreate}>
              <Plus size={14} /> 글쓰기
            </Button>
          )}
        </div>
        <div className="divide-y divide-black/5">
          {posts.map(post => (
            <PostRow
              key={post.id}
              {...post}
              selected={post.id === selectedPostId}
              onClick={() => setSelectedPostId(post.id)}
            />
          ))}
        </div>
      </aside>

      {/* 디테일: 게시물 상세 + 댓글 */}
      <main className="overflow-y-auto">
        {selectedPostId ? (
          <PostDetail postId={selectedPostId} />
        ) : (
          <EmptyState icon={FileText} title="게시물을 선택하세요" />
        )}
      </main>
    </div>
  )
}
```

### 모바일 (목록 → 상세 네비게이션)

```tsx
// 모바일에서는 별도 페이지로 이동
function MobileBoard() {
  const navigate = useNavigate()

  return (
    <div className="max-w-[430px] mx-auto">
      <TopBar title="게시판" />

      <Tabs value={filter} onValueChange={setFilter} className="px-3 py-2 overflow-x-auto">
        <TabItem value="all">전체</TabItem>
        <TabItem value="notice">공지</TabItem>
        <TabItem value="material">자료</TabItem>
        <TabItem value="published_submission">공개과제</TabItem>
      </Tabs>

      <div className="pb-20">
        {posts.map(post => (
          <PostRow
            key={post.id}
            {...post}
            onClick={() => navigate(`/class/${classId}/board/${post.id}`)}
          />
        ))}
      </div>

      <BottomNav active="board" />
    </div>
  )
}
```

---

## 필터 탭 스타일

```tsx
// 게시물 유형 필터
const filterTabs = [
  { value: 'all', label: '전체' },
  { value: 'notice', label: '공지' },
  { value: 'material', label: '자료' },
  { value: 'published_submission', label: '공개과제' },
]

<Tabs value={filter} onValueChange={setFilter}>
  {filterTabs.map(tab => (
    <TabItem key={tab.value} value={tab.value}>
      {tab.label}
    </TabItem>
  ))}
</Tabs>
```

---

## 글쓰기 페이지 (PostCreate.tsx)

```tsx
function PostCreate() {
  const [type, setType] = useState<'notice' | 'material'>('notice')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const { upload, uploading, progress } = useFileUpload()

  const handleFileSelect = async (file: File) => {
    const result = await upload(file, '/api/v1/files')
    setFiles(prev => [...prev, result.file])
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력하세요.')
      return
    }

    await api(`/classes/${classId}/posts`, {
      method: 'POST',
      body: JSON.stringify({
        type,
        title: title.trim(),
        content: content.trim(),
        file_ids: files.map(f => f.id)
      })
    })

    toast.success('게시물이 등록되었습니다.')
    navigate(`/class/${classId}/board`)
  }

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg font-medium">글쓰기</h1>
        <Button variant="primary" onClick={handleSubmit} disabled={!title.trim()}>
          등록
        </Button>
      </div>

      {/* 유형 선택 */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-2 block">유형</label>
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

      {/* 제목 */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-2 block">제목</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
        />
      </div>

      {/* 내용 */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-500 mb-2 block">내용</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          rows={10}
        />
      </div>

      {/* 첨부파일 */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">첨부파일</label>
        <FileUploadZone
          onFileSelect={handleFileSelect}
          accept=".pdf,.docx,.pptx,.xlsx,.jpg,.png,.mp4"
        />
        {uploading && <ProgressBar value={progress} className="mt-2" />}
        {files.map(file => (
          <div key={file.id} className="flex items-center justify-between mt-2 p-2 bg-[#F7F6F3] rounded-lg">
            <span className="text-sm">{file.filename}</span>
            <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 유틸리티 함수

```ts
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
```

---

## 타입 정의

```ts
interface Post {
  id: number
  title: string
  type: 'notice' | 'material' | 'published_submission'
  author: { id: number; name: string }
  created_at: string
  comment_count: number
  like_count: number
  liked_by_me: boolean
}

interface PostDetail extends Post {
  content: string
  class_id: number
  files: Array<{ id: number; filename: string; size: number }>
}

interface Comment {
  id: number
  body: string
  author: { id: number; name: string }
  created_at: string
}

interface PostListResponse {
  posts: Post[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}
```
