// server/routes/posts.js
// 게시판 API (공지/자료/공개제출물, 댓글, 좋아요)

import { Router } from 'express'
import { db } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'

const router = Router()

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 게시물 접근 권한 확인
 */
function canAccessPost(user, post) {
  if (user.role === 'teacher') return true
  // 전체 반 공개 (class_id === NULL)
  if (post.class_id === null) return true
  // 본인 반 게시물
  return post.class_id === user.class_id
}

/**
 * 게시물 수정 권한 확인 (교사는 모든 글 수정 가능)
 */
function canModifyPost(user, post) {
  // 교사: 모든 게시글 수정 가능
  if (user.role === 'teacher') return true
  // 학생: 본인 글만
  return post.author_id === user.id
}

/**
 * 게시물 삭제 권한 확인 (교사는 모든 글 삭제 가능)
 */
function canDeletePost(user, post) {
  // 교사: 모든 게시글 삭제 가능
  if (user.role === 'teacher') return true
  // 학생: 본인 글만 (현재 학생 게시글 작성 기능은 없지만 확장성 고려)
  return post.author_id === user.id
}

/**
 * 댓글 삭제 권한 확인
 */
function canDeleteComment(user, comment) {
  // 교사: 모든 댓글 삭제 가능
  if (user.role === 'teacher') return true
  // 학생: 본인 댓글만
  return comment.author_id === user.id
}

// ============================================================
// 게시물 API
// ============================================================

/**
 * GET /api/v1/classes/:classId/posts
 * 게시물 목록 조회
 */
export function getPostsByClass(req, res) {
  const { classId } = req.params
  const { type, page = 1, limit = 20 } = req.query
  const user = req.user

  // 반 존재 확인
  const classRow = db.get('SELECT * FROM classes WHERE id = ?', [classId])
  if (!classRow) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '반을 찾을 수 없습니다.' }
    })
  }

  // 반 접근 권한 확인 (학생은 본인 반만)
  if (user.role === 'student' && user.class_id !== parseInt(classId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  // 페이지네이션 파라미터 정리
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
  const offset = (pageNum - 1) * limitNum

  // 쿼리 구성
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

  // 타입 필터
  if (type && ['notice', 'material', 'published_submission'].includes(type)) {
    sql += ' AND p.type = ?'
    params.push(type)
  }

  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
  params.push(limitNum, offset)

  const posts = db.all(sql, params)

  // 전체 개수 조회 (페이지네이션)
  let countSql = 'SELECT COUNT(*) as count FROM posts WHERE (class_id = ? OR class_id IS NULL)'
  const countParams = [classId]
  if (type && ['notice', 'material', 'published_submission'].includes(type)) {
    countSql += ' AND type = ?'
    countParams.push(type)
  }
  const total = db.get(countSql, countParams).count

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
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: Math.ceil(total / limitNum)
    }
  })
}

/**
 * POST /api/v1/classes/:classId/posts
 * 게시물 작성 (교사 전용)
 */
export function createPost(req, res) {
  const { classId } = req.params
  const { title, content, type, file_ids } = req.body
  const user = req.user

  // 반 존재 확인
  const classRow = db.get('SELECT * FROM classes WHERE id = ?', [classId])
  if (!classRow) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '반을 찾을 수 없습니다.' }
    })
  }

  // 제목 검증
  if (!title?.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '제목을 입력하세요.' }
    })
  }

  // 타입 검증 (notice, material만 허용)
  if (!type || !['notice', 'material'].includes(type)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '유효한 게시물 타입을 선택하세요.' }
    })
  }

  // 게시물 생성
  const { lastInsertRowid } = db.run(
    'INSERT INTO posts (title, content, type, author_id, class_id) VALUES (?, ?, ?, ?, ?)',
    [title.trim(), content || '', type, user.id, classId]
  )

  // 파일 연결 (file_ids가 있는 경우)
  if (Array.isArray(file_ids) && file_ids.length > 0) {
    for (const fileId of file_ids) {
      db.run(
        'UPDATE files SET post_id = ?, class_id = ? WHERE id = ? AND post_id IS NULL',
        [lastInsertRowid, classId, fileId]
      )
    }
  }

  // 생성된 게시물 조회
  const post = db.get(`
    SELECT p.*, u.name as author_name
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `, [lastInsertRowid])

  // 첨부 파일 조회
  const files = db.all(
    'SELECT id, filename, original_name, size FROM files WHERE post_id = ?',
    [lastInsertRowid]
  )

  res.status(201).json({
    post: {
      id: post.id,
      title: post.title,
      content: post.content,
      type: post.type,
      author: { id: post.author_id, name: post.author_name },
      class_id: post.class_id,
      created_at: post.created_at,
      files
    }
  })
}

/**
 * GET /api/v1/posts/:postId
 * 게시물 상세 조회
 */
router.get('/:postId', authenticate, (req, res) => {
  const { postId } = req.params
  const user = req.user

  // 게시물 조회
  const post = db.get(`
    SELECT p.*, u.name as author_name
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `, [postId])

  if (!post) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
    })
  }

  // 접근 권한 확인
  if (!canAccessPost(user, post)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  // 좋아요 정보
  const likeCount = db.get(
    'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
    [postId]
  ).count

  const likedByMe = !!db.get(
    'SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?',
    [postId, user.id]
  )

  // 첨부 파일
  const files = db.all(
    'SELECT id, filename, original_name, size FROM files WHERE post_id = ?',
    [postId]
  )

  res.json({
    post: {
      id: post.id,
      title: post.title,
      content: post.content,
      type: post.type,
      author: { id: post.author_id, name: post.author_name },
      class_id: post.class_id,
      created_at: post.created_at,
      like_count: likeCount,
      liked_by_me: likedByMe,
      files
    }
  })
})

/**
 * PATCH /api/v1/posts/:postId
 * 게시물 수정 (교사는 모든 글 수정 가능)
 */
router.patch('/:postId', authenticate, (req, res) => {
  const { postId } = req.params
  const { title, content, file_ids } = req.body
  const user = req.user

  // 게시물 조회
  const post = db.get('SELECT * FROM posts WHERE id = ?', [postId])
  if (!post) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
    })
  }

  // 수정 권한 확인 (교사는 모든 글 수정 가능)
  if (!canModifyPost(user, post)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '게시글을 수정할 권한이 없습니다.' }
    })
  }

  // 업데이트할 필드 구성
  const updates = []
  const params = []

  if (title !== undefined) {
    if (!title.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: '제목을 입력하세요.' }
      })
    }
    updates.push('title = ?')
    params.push(title.trim())
  }

  if (content !== undefined) {
    updates.push('content = ?')
    params.push(content)
  }

  if (updates.length > 0) {
    params.push(postId)
    db.run(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`, params)
  }

  // 파일 연결 업데이트
  if (Array.isArray(file_ids)) {
    // 기존 파일 연결 해제
    db.run('UPDATE files SET post_id = NULL WHERE post_id = ?', [postId])
    // 새 파일 연결
    for (const fileId of file_ids) {
      db.run(
        'UPDATE files SET post_id = ?, class_id = ? WHERE id = ?',
        [postId, post.class_id, fileId]
      )
    }
  }

  // 업데이트된 게시물 조회
  const updatedPost = db.get(`
    SELECT p.*, u.name as author_name
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `, [postId])

  const files = db.all(
    'SELECT id, filename, original_name, size FROM files WHERE post_id = ?',
    [postId]
  )

  res.json({
    post: {
      id: updatedPost.id,
      title: updatedPost.title,
      content: updatedPost.content,
      type: updatedPost.type,
      author: { id: updatedPost.author_id, name: updatedPost.author_name },
      class_id: updatedPost.class_id,
      created_at: updatedPost.created_at,
      files
    }
  })
})

/**
 * DELETE /api/v1/posts/:postId
 * 게시물 삭제 (교사는 모든 글 삭제 가능)
 */
router.delete('/:postId', authenticate, (req, res) => {
  const { postId } = req.params
  const user = req.user

  // 게시물 조회
  const post = db.get('SELECT * FROM posts WHERE id = ?', [postId])
  if (!post) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
    })
  }

  // 삭제 권한 확인 (교사는 모든 글 삭제 가능)
  if (!canDeletePost(user, post)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '게시글을 삭제할 권한이 없습니다.' }
    })
  }

  // 파일 연결 해제 (파일 자체는 유지)
  db.run('UPDATE files SET post_id = NULL WHERE post_id = ?', [postId])

  // 게시물 삭제 (comments, likes는 CASCADE로 자동 삭제)
  db.run('DELETE FROM posts WHERE id = ?', [postId])

  res.json({ ok: true })
})

// ============================================================
// 댓글 API
// ============================================================

/**
 * GET /api/v1/posts/:postId/comments
 * 댓글 목록 조회
 */
router.get('/:postId/comments', authenticate, (req, res) => {
  const { postId } = req.params
  const { page = 1, limit = 50 } = req.query
  const user = req.user

  // 게시물 존재 및 접근 권한 확인
  const post = db.get('SELECT * FROM posts WHERE id = ?', [postId])
  if (!post) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
    })
  }

  if (!canAccessPost(user, post)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  // 페이지네이션
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50))
  const offset = (pageNum - 1) * limitNum

  // 댓글 조회
  const comments = db.all(`
    SELECT c.*, u.name as author_name
    FROM comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
    LIMIT ? OFFSET ?
  `, [postId, limitNum, offset])

  // 전체 개수
  const total = db.get(
    'SELECT COUNT(*) as count FROM comments WHERE post_id = ?',
    [postId]
  ).count

  res.json({
    comments: comments.map(c => ({
      id: c.id,
      body: c.body,
      author: { id: c.author_id, name: c.author_name },
      created_at: c.created_at
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: Math.ceil(total / limitNum)
    }
  })
})

/**
 * POST /api/v1/posts/:postId/comments
 * 댓글 작성
 */
router.post('/:postId/comments', authenticate, (req, res) => {
  const { postId } = req.params
  const { body } = req.body
  const user = req.user

  // 게시물 존재 및 접근 권한 확인
  const post = db.get('SELECT * FROM posts WHERE id = ?', [postId])
  if (!post) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
    })
  }

  if (!canAccessPost(user, post)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  // 댓글 내용 검증
  if (!body?.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '댓글 내용을 입력하세요.' }
    })
  }

  if (body.length > 1000) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '댓글은 1000자 이내로 작성하세요.' }
    })
  }

  // 댓글 생성
  const { lastInsertRowid } = db.run(
    'INSERT INTO comments (body, post_id, author_id) VALUES (?, ?, ?)',
    [body.trim(), postId, user.id]
  )

  const comment = db.get(`
    SELECT c.*, u.name as author_name
    FROM comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.id = ?
  `, [lastInsertRowid])

  // Socket.IO 브로드캐스트 (Phase 4에서 구현 예정)
  // const io = getIO()
  // io.to(`class:${post.class_id || 'all'}`).emit('comment:created', {
  //   post_id: parseInt(postId),
  //   comment: {
  //     id: comment.id,
  //     body: comment.body,
  //     author: { id: comment.author_id, name: comment.author_name },
  //     created_at: comment.created_at
  //   }
  // })

  res.status(201).json({
    comment: {
      id: comment.id,
      body: comment.body,
      author: { id: comment.author_id, name: comment.author_name },
      created_at: comment.created_at
    }
  })
})

// ============================================================
// 좋아요 API
// ============================================================

/**
 * POST /api/v1/posts/:postId/like
 * 좋아요 토글
 */
router.post('/:postId/like', authenticate, (req, res) => {
  const { postId } = req.params
  const user = req.user

  // 게시물 존재 및 접근 권한 확인
  const post = db.get('SELECT * FROM posts WHERE id = ?', [postId])
  if (!post) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
    })
  }

  if (!canAccessPost(user, post)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  // 기존 좋아요 확인
  const existingLike = db.get(
    'SELECT id FROM likes WHERE post_id = ? AND user_id = ?',
    [postId, user.id]
  )

  let liked
  if (existingLike) {
    // 좋아요 취소
    db.run('DELETE FROM likes WHERE id = ?', [existingLike.id])
    liked = false
  } else {
    // 좋아요 추가
    db.run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, user.id])
    liked = true
  }

  // 현재 좋아요 수 조회
  const likeCount = db.get(
    'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
    [postId]
  ).count

  // Socket.IO 브로드캐스트 (Phase 4에서 구현 예정)
  // const io = getIO()
  // io.to(`class:${post.class_id || 'all'}`).emit('like:updated', {
  //   post_id: parseInt(postId),
  //   like_count: likeCount,
  //   user_id: user.id,
  //   liked
  // })

  res.json({ liked, like_count: likeCount })
})

// ============================================================
// 댓글 삭제 (별도 경로)
// ============================================================

/**
 * DELETE /api/v1/comments/:commentId
 * 댓글 삭제
 */
export function deleteComment(req, res) {
  const { commentId } = req.params
  const user = req.user

  // 댓글 조회
  const comment = db.get(`
    SELECT c.*, p.class_id as post_class_id
    FROM comments c
    JOIN posts p ON c.post_id = p.id
    WHERE c.id = ?
  `, [commentId])

  if (!comment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '댓글을 찾을 수 없습니다.' }
    })
  }

  // 삭제 권한 확인
  if (!canDeleteComment(user, comment)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '본인이 작성한 댓글만 삭제할 수 있습니다.' }
    })
  }

  const postId = comment.post_id

  // 댓글 삭제
  db.run('DELETE FROM comments WHERE id = ?', [commentId])

  // Socket.IO 브로드캐스트 (Phase 4에서 구현 예정)
  // const io = getIO()
  // io.to(`class:${comment.post_class_id || 'all'}`).emit('comment:deleted', {
  //   post_id: postId,
  //   comment_id: parseInt(commentId)
  // })

  res.json({ ok: true })
}

export default router
