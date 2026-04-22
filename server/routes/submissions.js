// server/routes/submissions.js
// 과제 제출 API (임시저장, 최종제출, 피드백, 공개, 파일 업로드)

import { Router } from 'express'
import path from 'path'
import fsPromises from 'fs/promises'
import { db, criticalTransaction, debouncedSave, saveImmediate } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'
import { uploadVideo, validateFileType, validateFilePath, UPLOAD_DIR } from '../middleware/upload.js'
import { uploadLimiter } from '../middleware/rateLimit.js'

const router = Router()

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 과제 접근 권한 확인
 */
function canAccessAssignment(user, assignment) {
  if (user.role === 'teacher') return true
  if (assignment.class_id === null) return true
  return assignment.class_id === user.class_id
}

/**
 * 제출물 조회 (개인/팀 구분)
 */
function getSubmission(assignmentId, user, assignment) {
  if (assignment.scope === 'team' && user.team_id) {
    return db.get(
      'SELECT * FROM submissions WHERE assignment_id = ? AND team_id = ?',
      [assignmentId, user.team_id]
    )
  }
  return db.get(
    'SELECT * FROM submissions WHERE assignment_id = ? AND submitter_id = ? AND team_id IS NULL',
    [assignmentId, user.id]
  )
}

/**
 * 답변 텍스트 검증 (질문 타입별)
 */
function validateAnswer(question, answerText) {
  if (!answerText && question.required) {
    return { valid: false, error: `질문 ${question.order_num}번은 필수입니다.` }
  }

  if (!answerText) return { valid: true }

  switch (question.question_type) {
    case 'essay':
      if (answerText.length > 10000) {
        return { valid: false, error: `질문 ${question.order_num}번: 10000자를 초과할 수 없습니다.` }
      }
      break
    case 'short':
      if (answerText.length > 500) {
        return { valid: false, error: `질문 ${question.order_num}번: 500자를 초과할 수 없습니다.` }
      }
      break
    case 'multiple_choice':
      if (question.options) {
        const options = JSON.parse(question.options)
        // 복수 선택인 경우 JSON 배열로 올 수 있음
        if (question.allow_multiple) {
          try {
            const selected = JSON.parse(answerText)
            if (Array.isArray(selected)) {
              for (const sel of selected) {
                if (!options.includes(sel)) {
                  return { valid: false, error: `질문 ${question.order_num}번: 유효하지 않은 선택지입니다.` }
                }
              }
            }
          } catch {
            // 단일 선택으로 처리
            if (!options.includes(answerText)) {
              return { valid: false, error: `질문 ${question.order_num}번: 유효하지 않은 선택지입니다.` }
            }
          }
        } else {
          if (!options.includes(answerText)) {
            return { valid: false, error: `질문 ${question.order_num}번: 유효하지 않은 선택지입니다.` }
          }
        }
      }
      break
    case 'file':
      // 파일은 별도 API로 처리
      break
  }

  return { valid: true }
}

// ============================================================
// 제출 현황 조회 (교사)
// GET /api/v1/assignments/:id/submissions
// ============================================================

export function getSubmissionsByAssignment(req, res) {
  const { id } = req.params
  const user = req.user

  // 과제 조회
  const assignment = db.get('SELECT * FROM assignments WHERE id = ?', [id])
  if (!assignment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' }
    })
  }

  // 제출물 목록 조회
  const submissions = db.all(`
    SELECT
      s.*,
      u.name as submitter_name,
      t.name as team_name,
      (SELECT u2.name FROM users u2 WHERE u2.id = s.last_modified_by) as last_modified_by_name
    FROM submissions s
    JOIN users u ON s.submitter_id = u.id
    LEFT JOIN teams t ON s.team_id = t.id
    WHERE s.assignment_id = ?
    ORDER BY s.submitted_at DESC
  `, [id])

  // 통계 계산
  let totalExpected = 0
  let submitted = 0
  let draft = 0

  if (assignment.scope === 'team') {
    // 팀 과제: 해당 반의 팀 수
    if (assignment.class_id) {
      totalExpected = db.get(
        'SELECT COUNT(*) as count FROM teams WHERE class_id = ?',
        [assignment.class_id]
      ).count
    } else {
      // 전체 반 과제: 모든 팀 수
      totalExpected = db.get('SELECT COUNT(*) as count FROM teams').count
    }
  } else {
    // 개인 과제: 해당 반의 학생 수
    if (assignment.class_id) {
      totalExpected = db.get(
        "SELECT COUNT(*) as count FROM users WHERE role = 'student' AND class_id = ?",
        [assignment.class_id]
      ).count
    } else {
      // 전체 반 과제: 모든 학생 수
      totalExpected = db.get("SELECT COUNT(*) as count FROM users WHERE role = 'student'").count
    }
  }

  for (const sub of submissions) {
    if (sub.status === 'submitted') submitted++
    else if (sub.status === 'draft') draft++
  }

  const notStarted = Math.max(0, totalExpected - submitted - draft)

  res.json({
    submissions: submissions.map(s => ({
      id: s.id,
      submitter: { id: s.submitter_id, name: s.submitter_name },
      team: s.team_id ? { id: s.team_id, name: s.team_name } : null,
      status: s.status,
      version: s.version,
      submitted_at: s.submitted_at,
      has_feedback: !!s.feedback,
      is_published: !!s.is_published,
      last_modified_by: s.last_modified_by ? {
        id: s.last_modified_by,
        name: s.last_modified_by_name
      } : null
    })),
    stats: {
      total: totalExpected,
      submitted,
      draft,
      not_started: notStarted
    }
  })
}

// ============================================================
// 임시저장 (학생)
// POST /api/v1/assignments/:id/draft
// ============================================================

export function saveDraft(req, res) {
  const { id } = req.params
  const { answers } = req.body
  const user = req.user

  // 학생만 가능
  if (user.role !== 'student') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '학생만 제출할 수 있습니다.' }
    })
  }

  // 과제 조회
  const assignment = db.get('SELECT * FROM assignments WHERE id = ?', [id])
  if (!assignment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' }
    })
  }

  // 접근 권한 확인
  if (!canAccessAssignment(user, assignment)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  // 팀 과제인데 팀이 없으면 에러
  if (assignment.scope === 'team' && !user.team_id) {
    return res.status(403).json({
      error: { code: 'TEAM_REQUIRED', message: '팀 배정이 필요합니다.' }
    })
  }

  // answers 검증
  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '답변 데이터가 필요합니다.' }
    })
  }

  // 질문 목록 조회
  const questions = db.all(
    'SELECT * FROM assignment_questions WHERE assignment_id = ?',
    [id]
  )
  const questionMap = new Map(questions.map(q => [q.id, q]))

  // 기존 제출물 확인
  let submission = getSubmission(id, user, assignment)

  // 제출물 생성 또는 업데이트
  if (submission) {
    // 이미 최종 제출된 경우 마감 전이면 수정 가능
    if (submission.status === 'submitted') {
      if (assignment.due_at && new Date() > new Date(assignment.due_at)) {
        return res.status(400).json({
          error: { code: 'DEADLINE_PASSED', message: '마감 시간이 지났습니다.' }
        })
      }
    }

    // 업데이트
    db.run(
      'UPDATE submissions SET last_modified_by = ?, version = version + 1 WHERE id = ?',
      [user.id, submission.id]
    )
  } else {
    // 새로 생성
    const teamId = assignment.scope === 'team' ? user.team_id : null
    const { lastInsertRowid } = db.run(
      `INSERT INTO submissions (assignment_id, submitter_id, team_id, status, last_modified_by)
       VALUES (?, ?, ?, 'draft', ?)`,
      [id, user.id, teamId, user.id]
    )
    submission = { id: lastInsertRowid, status: 'draft' }
  }

  // 답변 저장 (UPSERT)
  for (const answer of answers) {
    if (!answer.question_id) continue

    const question = questionMap.get(answer.question_id)
    if (!question) continue

    // 검증 (임시저장은 느슨하게)
    const validation = validateAnswer(
      { ...question, required: false }, // 임시저장은 필수 검증 안함
      answer.answer_text
    )
    if (!validation.valid) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: validation.error }
      })
    }

    // 기존 답변 확인
    const existingAnswer = db.get(
      'SELECT id FROM submission_answers WHERE submission_id = ? AND question_id = ?',
      [submission.id, answer.question_id]
    )

    if (existingAnswer) {
      db.run(
        'UPDATE submission_answers SET answer_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [answer.answer_text || '', existingAnswer.id]
      )
    } else {
      db.run(
        'INSERT INTO submission_answers (submission_id, question_id, answer_text) VALUES (?, ?, ?)',
        [submission.id, answer.question_id, answer.answer_text || '']
      )
    }
  }

  // 디바운스 저장 (2초 후)
  debouncedSave()

  // 업데이트된 제출물 조회
  const updatedSubmission = db.get('SELECT * FROM submissions WHERE id = ?', [submission.id])

  res.json({
    submission: {
      id: updatedSubmission.id,
      status: updatedSubmission.status,
      version: updatedSubmission.version
    }
  })
}

// ============================================================
// 최종 제출 (학생)
// POST /api/v1/assignments/:id/submit
// ============================================================

export function submitAssignment(req, res) {
  const { id } = req.params
  const { answers } = req.body
  const user = req.user

  // 학생만 가능
  if (user.role !== 'student') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '학생만 제출할 수 있습니다.' }
    })
  }

  // 과제 조회
  const assignment = db.get('SELECT * FROM assignments WHERE id = ?', [id])
  if (!assignment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' }
    })
  }

  // 접근 권한 확인
  if (!canAccessAssignment(user, assignment)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' }
    })
  }

  // 마감 시간 확인
  if (assignment.due_at && new Date() > new Date(assignment.due_at)) {
    return res.status(400).json({
      error: { code: 'DEADLINE_PASSED', message: '마감 시간이 지났습니다.' }
    })
  }

  // 팀 과제인데 팀이 없으면 에러
  if (assignment.scope === 'team' && !user.team_id) {
    return res.status(403).json({
      error: { code: 'TEAM_REQUIRED', message: '팀 배정이 필요합니다.' }
    })
  }

  // answers 검증
  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '답변 데이터가 필요합니다.' }
    })
  }

  // 질문 목록 조회
  const questions = db.all(
    'SELECT * FROM assignment_questions WHERE assignment_id = ?',
    [id]
  )
  const questionMap = new Map(questions.map(q => [q.id, q]))

  // 필수 질문 확인
  const answerMap = new Map(answers.map(a => [a.question_id, a.answer_text]))

  for (const question of questions) {
    if (question.required && question.question_type !== 'file') {
      const answerText = answerMap.get(question.id)
      if (!answerText?.trim()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `질문 ${question.order_num}번은 필수입니다.`
          }
        })
      }
    }

    // 타입별 검증
    const answerText = answerMap.get(question.id)
    if (answerText) {
      const validation = validateAnswer(question, answerText)
      if (!validation.valid) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: validation.error }
        })
      }
    }
  }

  // 트랜잭션으로 제출 처리
  const result = criticalTransaction('submission_submit', () => {
    // 기존 제출물 확인
    let submission = getSubmission(id, user, assignment)

    if (submission) {
      // 업데이트
      db.run(
        `UPDATE submissions
         SET status = 'submitted',
             last_modified_by = ?,
             version = version + 1,
             submitted_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [user.id, submission.id]
      )
    } else {
      // 새로 생성
      const teamId = assignment.scope === 'team' ? user.team_id : null
      const { lastInsertRowid } = db.run(
        `INSERT INTO submissions (assignment_id, submitter_id, team_id, status, last_modified_by, submitted_at)
         VALUES (?, ?, ?, 'submitted', ?, CURRENT_TIMESTAMP)`,
        [id, user.id, teamId, user.id]
      )
      submission = { id: lastInsertRowid }
    }

    // 답변 저장 (UPSERT)
    for (const answer of answers) {
      if (!answer.question_id) continue

      const existingAnswer = db.get(
        'SELECT id FROM submission_answers WHERE submission_id = ? AND question_id = ?',
        [submission.id, answer.question_id]
      )

      if (existingAnswer) {
        db.run(
          'UPDATE submission_answers SET answer_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [answer.answer_text || '', existingAnswer.id]
        )
      } else {
        db.run(
          'INSERT INTO submission_answers (submission_id, question_id, answer_text) VALUES (?, ?, ?)',
          [submission.id, answer.question_id, answer.answer_text || '']
        )
      }
    }

    return submission.id
  })

  // 업데이트된 제출물 조회
  const updatedSubmission = db.get('SELECT * FROM submissions WHERE id = ?', [result])

  res.json({
    submission: {
      id: updatedSubmission.id,
      status: updatedSubmission.status,
      version: updatedSubmission.version,
      submitted_at: updatedSubmission.submitted_at
    }
  })
}

// ============================================================
// 피드백 작성 (교사)
// PATCH /api/v1/submissions/:id/feedback
// ============================================================

router.patch('/:id/feedback', authenticate, requireTeacher, (req, res) => {
  const { id } = req.params
  const { feedback } = req.body

  // 제출물 조회
  const submission = db.get('SELECT * FROM submissions WHERE id = ?', [id])
  if (!submission) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '제출물을 찾을 수 없습니다.' }
    })
  }

  // 피드백 검증
  if (feedback === undefined) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '피드백 내용이 필요합니다.' }
    })
  }

  // 피드백 저장 (즉시 저장)
  criticalTransaction('feedback_create', () => {
    db.run(
      'UPDATE submissions SET feedback = ? WHERE id = ?',
      [feedback, id]
    )
  })

  res.json({ ok: true })
})

// ============================================================
// 제출물 공개 (교사)
// POST /api/v1/submissions/:id/publish
// ============================================================

router.post('/:id/publish', authenticate, requireTeacher, (req, res) => {
  const { id } = req.params
  const user = req.user

  // 제출물 조회
  const submission = db.get(`
    SELECT s.*, a.title as assignment_title, a.class_id,
           u.name as submitter_name, t.name as team_name
    FROM submissions s
    JOIN assignments a ON s.assignment_id = a.id
    JOIN users u ON s.submitter_id = u.id
    LEFT JOIN teams t ON s.team_id = t.id
    WHERE s.id = ?
  `, [id])

  if (!submission) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '제출물을 찾을 수 없습니다.' }
    })
  }

  // 이미 공개된 경우
  if (submission.is_published) {
    return res.status(400).json({
      error: { code: 'ALREADY_PUBLISHED', message: '이미 공개된 제출물입니다.' }
    })
  }

  // 제출 완료된 경우만 공개 가능
  if (submission.status !== 'submitted') {
    return res.status(400).json({
      error: { code: 'NOT_SUBMITTED', message: '제출 완료된 과제만 공개할 수 있습니다.' }
    })
  }

  // 트랜잭션으로 공개 처리
  const postId = criticalTransaction('submission_publish', () => {
    // 답변 조회
    const answers = db.all(`
      SELECT sa.*, aq.body as question_body, aq.order_num
      FROM submission_answers sa
      JOIN assignment_questions aq ON sa.question_id = aq.id
      WHERE sa.submission_id = ?
      ORDER BY aq.order_num
    `, [id])

    // 게시글 내용 구성
    const submitterInfo = submission.team_name
      ? `${submission.team_name} (${submission.submitter_name})`
      : submission.submitter_name

    let content = `## 제출자: ${submitterInfo}\n\n`
    content += `### 과제: ${submission.assignment_title}\n\n`

    for (const answer of answers) {
      content += `**${answer.order_num}. ${answer.question_body}**\n\n`
      content += `${answer.answer_text || '(응답 없음)'}\n\n`
    }

    if (submission.feedback) {
      content += `---\n\n### 교사 피드백\n\n${submission.feedback}\n`
    }

    // 게시글 생성
    const { lastInsertRowid: postId } = db.run(
      `INSERT INTO posts (title, content, type, author_id, class_id)
       VALUES (?, ?, 'published_submission', ?, ?)`,
      [
        `[우수작] ${submission.assignment_title} - ${submitterInfo}`,
        content,
        user.id,
        submission.class_id
      ]
    )

    // 제출물 공개 상태 업데이트
    db.run(
      'UPDATE submissions SET is_published = 1, published_post_id = ? WHERE id = ?',
      [postId, id]
    )

    return postId
  })

  res.json({ post_id: postId })
})

// ============================================================
// 제출물 파일 업로드 (학생)
// POST /api/v1/submissions/:id/files
// ============================================================

router.post('/:id/files',
  authenticate,
  uploadLimiter,
  uploadVideo.single('file'),  // 동영상 허용 (100MB)
  validateFileType,
  async (req, res) => {
    const { id } = req.params
    const { question_id } = req.body
    const user = req.user
    const file = req.file

    // 제출물 확인
    const submission = db.get('SELECT * FROM submissions WHERE id = ?', [id])
    if (!submission) {
      await fsPromises.unlink(file.path).catch(() => {})
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: '제출물을 찾을 수 없습니다.' }
      })
    }

    // 권한 검증: 제출자 본인 또는 팀원
    const isSubmitter = submission.submitter_id === user.id
    const isTeamMember = submission.team_id && submission.team_id === user.team_id

    if (!isSubmitter && !isTeamMember) {
      await fsPromises.unlink(file.path).catch(() => {})
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: '파일 업로드 권한이 없습니다.' }
      })
    }

    // 과제 마감 확인
    const assignment = db.get('SELECT * FROM assignments WHERE id = ?', [submission.assignment_id])
    if (assignment.due_at && new Date() > new Date(assignment.due_at)) {
      await fsPromises.unlink(file.path).catch(() => {})
      return res.status(400).json({
        error: { code: 'DEADLINE_PASSED', message: '마감 시간이 지났습니다.' }
      })
    }

    // question_id 검증 (있는 경우)
    if (question_id) {
      const question = db.get(
        'SELECT * FROM assignment_questions WHERE id = ? AND assignment_id = ?',
        [question_id, submission.assignment_id]
      )
      if (!question) {
        await fsPromises.unlink(file.path).catch(() => {})
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 질문입니다.' }
        })
      }
      if (question.question_type !== 'file') {
        await fsPromises.unlink(file.path).catch(() => {})
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: '파일 업로드 질문이 아닙니다.' }
        })
      }
    }

    // 기존 파일 삭제 (같은 question_id에 대해 덮어쓰기)
    if (question_id) {
      const existingFile = db.get(
        'SELECT * FROM files WHERE submission_id = ? AND question_id = ?',
        [id, question_id]
      )

      if (existingFile) {
        const oldPath = path.resolve(UPLOAD_DIR, existingFile.filepath)
        if (validateFilePath(oldPath)) {
          await fsPromises.unlink(oldPath).catch(() => {})
        }
        db.run('DELETE FROM files WHERE id = ?', [existingFile.id])
      }
    }

    // 새 파일 저장
    const relativePath = path.relative(path.resolve(UPLOAD_DIR), file.path)

    const { lastInsertRowid } = db.run(
      `INSERT INTO files (
        filename, original_name, filepath, mimetype, size,
        class_id, submission_id, question_id, uploader_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        file.filename,
        file.originalname,
        relativePath,
        file.detectedMime,
        file.size,
        user.class_id,
        id,
        question_id || null,
        user.id,
      ]
    )

    saveImmediate('submission_file_upload')

    res.json({
      file: {
        id: lastInsertRowid,
        filename: file.filename,
        original_name: file.originalname,
        mimetype: file.detectedMime,
        size: file.size,
        url: `/api/v1/files/${lastInsertRowid}/download`,
      }
    })
  }
)

// ============================================================
// 제출물 상세 조회 (교사)
// GET /api/v1/submissions/:id
// ============================================================

router.get('/:id', authenticate, requireTeacher, (req, res) => {
  const { id } = req.params

  // 제출물 조회
  const submission = db.get(`
    SELECT
      s.*,
      u.name as submitter_name,
      t.name as team_name,
      a.title as assignment_title,
      a.description as assignment_description,
      a.scope as assignment_scope
    FROM submissions s
    JOIN users u ON s.submitter_id = u.id
    JOIN assignments a ON s.assignment_id = a.id
    LEFT JOIN teams t ON s.team_id = t.id
    WHERE s.id = ?
  `, [id])

  if (!submission) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '제출물을 찾을 수 없습니다.' }
    })
  }

  // 질문 및 답변 조회
  const questionsWithAnswers = db.all(`
    SELECT
      aq.*,
      sa.answer_text,
      sa.updated_at as answer_updated_at
    FROM assignment_questions aq
    LEFT JOIN submission_answers sa ON aq.id = sa.question_id AND sa.submission_id = ?
    WHERE aq.assignment_id = ?
    ORDER BY aq.order_num
  `, [id, submission.assignment_id])

  // 팀원 정보 (팀 과제인 경우)
  let teamMembers = []
  if (submission.team_id) {
    teamMembers = db.all(`
      SELECT id, name FROM users WHERE team_id = ?
    `, [submission.team_id])
  }

  res.json({
    submission: {
      id: submission.id,
      status: submission.status,
      version: submission.version,
      feedback: submission.feedback,
      is_published: !!submission.is_published,
      submitted_at: submission.submitted_at,
      submitter: { id: submission.submitter_id, name: submission.submitter_name },
      team: submission.team_id ? {
        id: submission.team_id,
        name: submission.team_name,
        members: teamMembers
      } : null
    },
    assignment: {
      id: submission.assignment_id,
      title: submission.assignment_title,
      description: submission.assignment_description,
      scope: submission.assignment_scope
    },
    questions: questionsWithAnswers.map(q => ({
      id: q.id,
      order_num: q.order_num,
      question_type: q.question_type,
      body: q.body,
      options: q.options ? JSON.parse(q.options) : null,
      required: !!q.required,
      answer: {
        text: q.answer_text,
        updated_at: q.answer_updated_at
      }
    }))
  })
})

export default router
