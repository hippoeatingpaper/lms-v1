# 게시판 API 스펙 (Posts)

> 게시판(공지/자료/공개제출물), 댓글, 좋아요의 백엔드 구현 스펙

## DB Schema

### posts — 게시물 (공지 / 수업자료 / 공개된 제출물 통합)
```sql
CREATE TABLE posts (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT,
  type       TEXT NOT NULL,  -- 'notice' | 'material' | 'published_submission'
  author_id  INTEGER REFERENCES users(id),
  class_id   INTEGER REFERENCES classes(id),  -- NULL이면 전체 반 공개
  team_id    INTEGER REFERENCES teams(id),    -- NULL이면 반 전체 공개
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### comments — 댓글
```sql
CREATE TABLE comments (
  id         INTEGER PRIMARY KEY,
  body       TEXT NOT NULL,
  post_id    INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### likes — 좋아요
```sql
CREATE TABLE likes (
  id      INTEGER PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  UNIQUE(post_id, user_id)  -- 중복 좋아요 방지
);
```

### files — 첨부 파일 (posts와 연결)
```sql
-- 게시물 첨부파일은 files 테이블의 post_id로 연결
SELECT * FROM files WHERE post_id = ?;
```

## API Endpoints

### 게시물 목록 조회

```
GET /api/v1/classes/:classId/posts
Authorization: teacher or student of class

Query:
  ?type=notice|material|published_submission (optional)
  ?page=1 (optional, default: 1)
  ?limit=20 (optional, default: 20)

Response: {
  "posts": [
    {
      "id": 1,
      "title": "4월 수업 안내",
      "type": "notice",
      "author": { "id": 1, "name": "김선생" },
      "created_at": "2026-04-15T09:00:00",
      "comment_count": 5,
      "like_count": 12,
      "liked_by_me": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

### 게시물 상세 조회

```
GET /api/v1/posts/:id
Authorization: teacher or student of class

Response: {
  "post": {
    "id": 1,
    "title": "4월 수업 안내",
    "content": "다음 주 수업은...",
    "type": "notice",
    "author": { "id": 1, "name": "김선생" },
    "class_id": 1,
    "created_at": "2026-04-15T09:00:00",
    "like_count": 12,
    "liked_by_me": true,
    "files": [
      { "id": 1, "filename": "안내문.pdf", "size": 102400 }
    ]
  }
}
```

### 게시물 작성 (교사)

```
POST /api/v1/classes/:classId/posts
Authorization: teacher only

Body: {
  "title": "4월 수업 안내",
  "content": "다음 주 수업은...",
  "type": "notice",  // 'notice' | 'material'
  "file_ids": [1, 2]  // optional, 첨부파일 ID
}

Response: { "post": {...} }
```

**로직**:
1. title 필수, content 선택
2. type은 'notice' 또는 'material'만 허용 (published_submission은 과제 공개 API에서 생성)
3. `debouncedSave()` 사용
4. file_ids가 있으면 files 테이블의 post_id 업데이트

### 게시물 수정 (교사)

```
PATCH /api/v1/posts/:id
Authorization: teacher (모든 게시글 수정 가능)

Body: {
  "title": "수정된 제목",
  "content": "수정된 내용",
  "file_ids": [1, 3]  // 첨부파일 교체
}

Response: { "post": {...} }
```

**로직**:
1. 교사: 모든 게시글 수정 가능 (본인 글이 아니어도 수정 가능)
2. 학생: 본인 글만 수정 가능
3. 기존 파일 연결 해제 후 새 파일 연결

### 게시물 삭제 (교사)

```
DELETE /api/v1/posts/:id
Authorization: teacher (모든 게시글 삭제 가능)

Response: { "ok": true }
```

**로직**:
1. 교사: 모든 게시글 삭제 가능 (본인 글이 아니어도 삭제 가능)
2. 학생: 본인 글만 삭제 가능
3. 연결된 comments, likes는 CASCADE로 자동 삭제
4. 연결된 files의 post_id를 NULL로 설정 (파일 자체는 유지)

---

## 댓글 API

### 댓글 목록 조회

```
GET /api/v1/posts/:postId/comments
Authorization: teacher or student of class

Query:
  ?page=1 (optional)
  ?limit=50 (optional, default: 50)

Response: {
  "comments": [
    {
      "id": 1,
      "body": "감사합니다!",
      "author": { "id": 5, "name": "김민준" },
      "created_at": "2026-04-15T10:30:00"
    }
  ],
  "pagination": {...}
}
```

### 댓글 작성

```
POST /api/v1/posts/:postId/comments
Authorization: teacher or student

Body: { "body": "감사합니다!" }

Response: { "comment": {...} }
```

**로직**:
1. body 필수 (1~1000자)
2. `debouncedSave()` 사용
3. Socket.IO로 해당 반 room에 `comment:created` 이벤트 브로드캐스트

### 댓글 삭제

```
DELETE /api/v1/comments/:id
Authorization: teacher (any) or student (author only)

Response: { "ok": true }
```

**로직**:
1. 교사: 모든 댓글 삭제 가능
2. 학생: 본인 댓글만 삭제 가능
3. Socket.IO로 `comment:deleted` 이벤트 브로드캐스트

---

## 좋아요 API

### 좋아요 토글

```
POST /api/v1/posts/:postId/like
Authorization: teacher or student

Response: {
  "liked": true,      // 토글 후 상태
  "like_count": 13    // 현재 총 좋아요 수
}
```

**로직**:
```sql
-- 토글 로직 (INSERT OR DELETE)
SELECT id FROM likes WHERE post_id = ? AND user_id = ?

-- 존재하면 DELETE
DELETE FROM likes WHERE id = ?

-- 없으면 INSERT
INSERT INTO likes (post_id, user_id) VALUES (?, ?)
```

1. `debouncedSave()` 사용
2. Socket.IO로 `like:updated` 이벤트 브로드캐스트 (실시간 반영)

---

## 권한 검증

### 게시물 접근 권한
```js
// 학생: 본인 반의 게시물 또는 전체 반 공개 게시물만 조회 가능
function canAccessPost(user, post) {
  if (user.role === 'teacher') return true

  // 전체 반 공개 (class_id === NULL)
  if (post.class_id === null) return true

  // 본인 반 게시물
  return post.class_id === user.class_id
}
```

### 게시물 수정 권한
```js
// 교사: 모든 게시글 수정 가능
function canModifyPost(user, post) {
  if (user.role === 'teacher') return true
  // 학생: 본인 글만
  return post.author_id === user.id
}
```

### 게시물 삭제 권한
```js
// 교사: 모든 게시글 삭제 가능
function canDeletePost(user, post) {
  if (user.role === 'teacher') return true
  // 학생: 본인 글만
  return post.author_id === user.id
}
```

### 댓글 삭제 권한
```js
function canDeleteComment(user, comment) {
  // 교사: 모든 댓글 삭제 가능
  if (user.role === 'teacher') return true

  // 학생: 본인 댓글만
  return comment.author_id === user.id
}
```

---

## 파일 첨부 처리

### 게시물 작성 시 파일 첨부

```js
// 1. 먼저 파일 업로드 (별도 API)
POST /api/v1/files
→ { "file": { "id": 1, "filename": "..." } }

// 2. 게시물 작성 시 file_ids 포함
POST /api/v1/classes/:classId/posts
Body: { "title": "...", "file_ids": [1, 2] }

// 3. files 테이블 업데이트
UPDATE files SET post_id = ?, class_id = ? WHERE id IN (?, ?)
```

### 파일 다운로드 권한
```sql
-- class_id로 반 격리 검증
SELECT * FROM files
WHERE id = :fileId
  AND (class_id IS NULL OR class_id = :userClassId)
```

---

## Socket.IO 이벤트

### 댓글 실시간 알림
```js
// 댓글 작성 시
io.to(`class:${post.class_id}`).emit('comment:created', {
  post_id: postId,
  comment: { id, body, author: { id, name }, created_at }
})

// 댓글 삭제 시
io.to(`class:${post.class_id}`).emit('comment:deleted', {
  post_id: postId,
  comment_id: commentId
})
```

### 좋아요 실시간 반영
```js
io.to(`class:${post.class_id}`).emit('like:updated', {
  post_id: postId,
  like_count: newCount,
  user_id: userId,    // 누가 토글했는지
  liked: isLiked      // 토글 후 상태
})
```

---

## 핵심 로직 예시

### 게시물 목록 조회
```js
// routes/posts.js
router.get('/classes/:classId/posts', authenticate, async (req, res) => {
  const { classId } = req.params
  const { type, page = 1, limit = 20 } = req.query
  const user = req.user

  // 반 접근 권한 확인
  if (user.role === 'student' && user.class_id !== parseInt(classId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  let sql = `
    SELECT
      p.*,
      u.name as author_name,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) as liked_by_me
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE (p.class_id = ? OR p.class_id IS NULL)
  `
  const params = [user.id, classId]

  if (type) {
    sql += ` AND p.type = ?`
    params.push(type)
  }

  sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit))

  const posts = db.all(sql, params)

  // 전체 개수 조회 (페이지네이션)
  const totalSql = `SELECT COUNT(*) as count FROM posts WHERE (class_id = ? OR class_id IS NULL)${type ? ' AND type = ?' : ''}`
  const total = db.get(totalSql, type ? [classId, type] : [classId]).count

  res.json({
    posts: posts.map(p => ({
      id: p.id,
      title: p.title,
      type: p.type,
      author: { id: p.author_id, name: p.author_name },
      created_at: p.created_at,
      comment_count: p.comment_count,
      like_count: p.like_count,
      liked_by_me: !!p.liked_by_me
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      total_pages: Math.ceil(total / parseInt(limit))
    }
  })
})
```

### 좋아요 토글
```js
router.post('/posts/:postId/like', authenticate, async (req, res) => {
  const { postId } = req.params
  const userId = req.user.id

  // 게시물 존재 및 접근 권한 확인
  const post = db.get('SELECT * FROM posts WHERE id = ?', [postId])
  if (!post) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
    })
  }

  // 기존 좋아요 확인
  const existingLike = db.get(
    'SELECT id FROM likes WHERE post_id = ? AND user_id = ?',
    [postId, userId]
  )

  let liked
  if (existingLike) {
    // 좋아요 취소
    db.run('DELETE FROM likes WHERE id = ?', [existingLike.id])
    liked = false
  } else {
    // 좋아요 추가
    db.run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId])
    liked = true
  }

  // 현재 좋아요 수 조회
  const likeCount = db.get(
    'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
    [postId]
  ).count

  // Socket.IO 브로드캐스트
  io.to(`class:${post.class_id || 'all'}`).emit('like:updated', {
    post_id: parseInt(postId),
    like_count: likeCount,
    user_id: userId,
    liked
  })

  res.json({ liked, like_count: likeCount })
})
```

---

## 타입별 게시물 용도

| type | 용도 | 생성 방법 |
|------|------|----------|
| `notice` | 공지사항 | 교사가 직접 작성 |
| `material` | 수업 자료 | 교사가 직접 작성 |
| `published_submission` | 공개된 제출물 | 과제 제출물 공개 시 자동 생성 |

### 공개 제출물 생성 (과제 API 연동)
```js
// submissions.js의 publish API에서 호출
async function publishSubmission(submission, assignment) {
  const { lastInsertRowid: postId } = db.run(`
    INSERT INTO posts (title, content, type, author_id, class_id)
    VALUES (?, ?, 'published_submission', ?, ?)
  `, [
    `[${assignment.title}] ${submission.submitter_name}의 제출물`,
    '과제 제출물이 공개되었습니다.',
    submission.submitter_id,
    assignment.class_id
  ])

  db.run(
    'UPDATE submissions SET is_published = 1, published_post_id = ? WHERE id = ?',
    [postId, submission.id]
  )

  return postId
}
```
