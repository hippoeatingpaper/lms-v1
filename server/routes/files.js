// server/routes/files.js
// 파일 업로드/다운로드/삭제 API

import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { db, saveImmediate } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'
import { upload, uploadVideo, validateFileType, validateFilePath, UPLOAD_DIR } from '../middleware/upload.js'
import { uploadLimiter } from '../middleware/rateLimit.js'

const router = Router()

// ============================================================
// 파일 업로드
// POST /api/v1/files
// ============================================================

router.post('/',
  uploadLimiter,
  upload.single('file'),
  validateFileType,
  (req, res) => {
    const { post_id, submission_id, question_id } = req.body
    // context 기본값: post_id가 있으면 'post', submission_id가 있으면 'submission', 그 외 'general'
    const context = req.body.context || (post_id ? 'post' : submission_id ? 'submission' : 'general')
    const file = req.file
    const user = req.user

    // context 검증
    if (!['post', 'submission', 'general'].includes(context)) {
      // 파일 삭제
      fsPromises.unlink(file.path).catch(() => {})
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'context는 post, submission, general 중 하나여야 합니다.' }
      })
    }

    // context별 검증
    if (context === 'post' && !post_id) {
      fsPromises.unlink(file.path).catch(() => {})
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'post_id가 필요합니다.' }
      })
    }

    if (context === 'submission' && !submission_id) {
      fsPromises.unlink(file.path).catch(() => {})
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'submission_id가 필요합니다.' }
      })
    }

    // 게시물 권한 검증
    if (post_id) {
      const post = db.get('SELECT * FROM posts WHERE id = ?', [post_id])
      if (!post) {
        fsPromises.unlink(file.path).catch(() => {})
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
        })
      }
      // 교사만 게시물에 파일 첨부 가능
      if (user.role !== 'teacher') {
        fsPromises.unlink(file.path).catch(() => {})
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: '게시물 파일 첨부는 교사만 가능합니다.' }
        })
      }
    }

    // 제출물 권한 검증
    if (submission_id) {
      const submission = db.get('SELECT * FROM submissions WHERE id = ?', [submission_id])
      if (!submission) {
        fsPromises.unlink(file.path).catch(() => {})
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: '제출물을 찾을 수 없습니다.' }
        })
      }
      // 제출자 본인 또는 팀원만 파일 첨부 가능
      const isSubmitter = submission.submitter_id === user.id
      const isTeamMember = submission.team_id && submission.team_id === user.team_id
      if (!isSubmitter && !isTeamMember && user.role !== 'teacher') {
        fsPromises.unlink(file.path).catch(() => {})
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: '파일 업로드 권한이 없습니다.' }
        })
      }
    }

    // 상대 경로로 저장 (UPLOAD_DIR 기준)
    const relativePath = path.relative(path.resolve(UPLOAD_DIR), file.path)

    // class_id 결정
    let classId = user.class_id
    if (post_id) {
      const post = db.get('SELECT class_id FROM posts WHERE id = ?', [post_id])
      classId = post?.class_id
    } else if (submission_id) {
      const submission = db.get(`
        SELECT a.class_id FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.id = ?
      `, [submission_id])
      classId = submission?.class_id
    }

    // 디코딩된 원본 파일명 사용 (한글 파일명 지원)
    const originalName = file.decodedOriginalname || file.originalname

    // DB에 파일 정보 저장
    const { lastInsertRowid } = db.run(
      `INSERT INTO files (
        filename, original_name, filepath, mimetype, size,
        class_id, post_id, submission_id, question_id, uploader_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        file.filename,
        originalName,
        relativePath,
        file.detectedMime,
        file.size,
        classId,
        post_id || null,
        submission_id || null,
        question_id || null,
        user.id,
      ]
    )

    // 파일-DB 불일치 방지: 즉시 저장
    saveImmediate('file_upload')

    res.json({
      file: {
        id: lastInsertRowid,
        filename: file.filename,
        original_name: originalName,
        mimetype: file.detectedMime,
        size: file.size,
        url: `/api/v1/files/${lastInsertRowid}/download`,
      }
    })
  }
)

// ============================================================
// 파일 다운로드
// GET /api/v1/files/:fileId/download
// ============================================================

router.get('/:fileId/download', (req, res) => {
  const { fileId } = req.params
  const user = req.user

  const file = db.get('SELECT * FROM files WHERE id = ?', [fileId])
  if (!file) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '파일을 찾을 수 없습니다.' }
    })
  }

  // 권한 검증: 교사는 모든 파일, 학생은 자신의 반 파일만
  const isTeacher = user.role === 'teacher'
  const isSameClass = file.class_id === null || file.class_id === user.class_id

  if (!isTeacher && !isSameClass) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '해당 파일에 접근 권한이 없습니다.' }
    })
  }

  // 경로 탈출 방지
  const absolutePath = path.resolve(UPLOAD_DIR, file.filepath)
  if (!validateFilePath(absolutePath)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '잘못된 파일 경로입니다.' }
    })
  }

  // 파일 존재 확인
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '파일이 존재하지 않습니다.' }
    })
  }

  // 파일 다운로드 (한글 파일명 인코딩 처리)
  const encodedFilename = encodeURIComponent(file.original_name).replace(/'/g, "%27")
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
  res.setHeader('Content-Type', file.mimetype || 'application/octet-stream')
  res.sendFile(absolutePath, (err) => {
    if (err && !res.headersSent) {
      console.error('[FILE_DOWNLOAD] Error sending file:', err.message, { absolutePath, fileId })
      res.status(500).json({
        error: { code: 'DOWNLOAD_ERROR', message: '파일 다운로드 중 오류가 발생했습니다.' }
      })
    }
  })
})

// ============================================================
// 파일 정보 조회
// GET /api/v1/files/:fileId
// ============================================================

router.get('/:fileId', (req, res) => {
  const { fileId } = req.params
  const user = req.user

  const file = db.get(`
    SELECT f.*, u.name as uploader_name
    FROM files f
    JOIN users u ON f.uploader_id = u.id
    WHERE f.id = ?
  `, [fileId])

  if (!file) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '파일을 찾을 수 없습니다.' }
    })
  }

  // 권한 검증
  const isTeacher = user.role === 'teacher'
  const isSameClass = file.class_id === null || file.class_id === user.class_id

  if (!isTeacher && !isSameClass) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '해당 파일에 접근 권한이 없습니다.' }
    })
  }

  res.json({
    file: {
      id: file.id,
      filename: file.filename,
      original_name: file.original_name,
      mimetype: file.mimetype,
      size: file.size,
      url: `/api/v1/files/${file.id}/download`,
      uploader: { id: file.uploader_id, name: file.uploader_name },
      created_at: file.created_at,
    }
  })
})

// ============================================================
// 파일 삭제
// DELETE /api/v1/files/:fileId
// ============================================================

router.delete('/:fileId', async (req, res) => {
  const { fileId } = req.params
  const user = req.user

  const file = db.get('SELECT * FROM files WHERE id = ?', [fileId])
  if (!file) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '파일을 찾을 수 없습니다.' }
    })
  }

  // 권한 검증: 업로더 본인 또는 교사
  const isTeacher = user.role === 'teacher'
  const isUploader = file.uploader_id === user.id

  if (!isTeacher && !isUploader) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '삭제 권한이 없습니다.' }
    })
  }

  // 실제 파일 삭제
  const absolutePath = path.resolve(UPLOAD_DIR, file.filepath)
  if (validateFilePath(absolutePath)) {
    await fsPromises.unlink(absolutePath).catch(() => {})
  }

  // DB에서 삭제
  db.run('DELETE FROM files WHERE id = ?', [fileId])
  saveImmediate('file_delete')

  res.json({ ok: true })
})

// ============================================================
// 게시물 첨부파일 목록
// GET /api/v1/posts/:postId/files
// ============================================================

export function getFilesByPost(req, res) {
  const { postId } = req.params
  const user = req.user

  // 게시물 확인
  const post = db.get('SELECT * FROM posts WHERE id = ?', [postId])
  if (!post) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다.' }
    })
  }

  // 반 권한 검증
  const isTeacher = user.role === 'teacher'
  const isSameClass = post.class_id === null || post.class_id === user.class_id

  if (!isTeacher && !isSameClass) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  const files = db.all(`
    SELECT f.*, u.name as uploader_name
    FROM files f
    JOIN users u ON f.uploader_id = u.id
    WHERE f.post_id = ?
    ORDER BY f.created_at ASC
  `, [postId])

  res.json({
    files: files.map(f => ({
      id: f.id,
      filename: f.filename,
      original_name: f.original_name,
      mimetype: f.mimetype,
      size: f.size,
      url: `/api/v1/files/${f.id}/download`,
      uploader: { id: f.uploader_id, name: f.uploader_name },
      created_at: f.created_at,
    }))
  })
}

// ============================================================
// 제출물 첨부파일 목록
// GET /api/v1/submissions/:submissionId/files
// ============================================================

export function getFilesBySubmission(req, res) {
  const { submissionId } = req.params
  const user = req.user

  // 제출물 확인
  const submission = db.get('SELECT * FROM submissions WHERE id = ?', [submissionId])
  if (!submission) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '제출물을 찾을 수 없습니다.' }
    })
  }

  // 권한 검증: 교사, 제출자 본인, 팀원
  const isTeacher = user.role === 'teacher'
  const isSubmitter = submission.submitter_id === user.id
  const isTeamMember = submission.team_id && submission.team_id === user.team_id

  if (!isTeacher && !isSubmitter && !isTeamMember) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  const files = db.all(`
    SELECT f.*, u.name as uploader_name, aq.body as question_body, aq.order_num
    FROM files f
    JOIN users u ON f.uploader_id = u.id
    LEFT JOIN assignment_questions aq ON f.question_id = aq.id
    WHERE f.submission_id = ?
    ORDER BY aq.order_num ASC, f.created_at ASC
  `, [submissionId])

  res.json({
    files: files.map(f => ({
      id: f.id,
      filename: f.filename,
      original_name: f.original_name,
      mimetype: f.mimetype,
      size: f.size,
      url: `/api/v1/files/${f.id}/download`,
      question: f.question_id ? {
        id: f.question_id,
        order_num: f.order_num,
        body: f.question_body,
      } : null,
      uploader: { id: f.uploader_id, name: f.uploader_name },
      created_at: f.created_at,
    }))
  })
}

export default router
