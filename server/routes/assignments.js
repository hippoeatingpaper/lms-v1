// server/routes/assignments.js
// 과제 API (과제 출제, 목록, 상세, 수정, 삭제)

import { Router } from 'express'
import { db, criticalTransaction } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'

const router = Router()

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 과제 접근 권한 확인
 */
function canAccessAssignment(user, assignment) {
  // 교사: 모든 과제 접근 가능
  if (user.role === 'teacher') return true
  // 전체 반 과제 (class_id === NULL)
  if (assignment.class_id === null) return true
  // 본인 반 과제
  return assignment.class_id === user.class_id
}

/**
 * 질문 타입 검증
 */
function isValidQuestionType(type) {
  return ['essay', 'short', 'multiple_choice', 'file'].includes(type)
}

/**
 * 질문 데이터 검증
 */
function validateQuestion(question, index) {
  const errors = []

  if (!question.body?.trim()) {
    errors.push(`질문 ${index + 1}: 내용을 입력하세요.`)
  }

  if (!isValidQuestionType(question.question_type)) {
    errors.push(`질문 ${index + 1}: 유효하지 않은 질문 타입입니다.`)
  }

  if (question.question_type === 'multiple_choice') {
    if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
      errors.push(`질문 ${index + 1}: 객관식은 최소 2개의 선택지가 필요합니다.`)
    }
  }

  return errors
}

// ============================================================
// 과제 목록 조회 (반별)
// GET /api/v1/classes/:classId/assignments
// ============================================================

export function getAssignmentsByClass(req, res) {
  const { classId } = req.params
  const { scope, page = 1, limit = 20 } = req.query
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

  // 페이지네이션 파라미터
  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
  const offset = (pageNum - 1) * limitNum

  // 쿼리 구성
  let sql = `
    SELECT
      a.*,
      u.name as author_name,
      (SELECT COUNT(*) FROM assignment_questions WHERE assignment_id = a.id) as question_count
    FROM assignments a
    JOIN users u ON a.author_id = u.id
    WHERE (a.class_id = ? OR a.class_id IS NULL)
  `
  const params = [classId]

  // scope 필터
  if (scope && ['individual', 'team'].includes(scope)) {
    sql += ' AND a.scope = ?'
    params.push(scope)
  }

  sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?'
  params.push(limitNum, offset)

  const assignments = db.all(sql, params)

  // 학생인 경우 제출 상태 조회
  let submissionStatusMap = {}
  if (user.role === 'student') {
    const assignmentIds = assignments.map(a => a.id)
    if (assignmentIds.length > 0) {
      // 개인 과제 제출 상태
      const individualSubmissions = db.all(`
        SELECT assignment_id, status
        FROM submissions
        WHERE submitter_id = ? AND assignment_id IN (${assignmentIds.map(() => '?').join(',')})
      `, [user.id, ...assignmentIds])

      // 팀 과제 제출 상태 (팀이 있는 경우)
      let teamSubmissions = []
      if (user.team_id) {
        teamSubmissions = db.all(`
          SELECT assignment_id, status
          FROM submissions
          WHERE team_id = ? AND assignment_id IN (${assignmentIds.map(() => '?').join(',')})
        `, [user.team_id, ...assignmentIds])
      }

      for (const sub of individualSubmissions) {
        submissionStatusMap[sub.assignment_id] = sub.status
      }
      for (const sub of teamSubmissions) {
        submissionStatusMap[sub.assignment_id] = sub.status
      }
    }
  }

  // 전체 개수 조회
  let countSql = 'SELECT COUNT(*) as count FROM assignments WHERE (class_id = ? OR class_id IS NULL)'
  const countParams = [classId]
  if (scope && ['individual', 'team'].includes(scope)) {
    countSql += ' AND scope = ?'
    countParams.push(scope)
  }
  const total = db.get(countSql, countParams).count

  res.json({
    assignments: assignments.map(a => ({
      id: a.id,
      title: a.title,
      scope: a.scope,
      due_at: a.due_at,
      question_count: a.question_count,
      author: { id: a.author_id, name: a.author_name },
      created_at: a.created_at,
      ...(user.role === 'student' && {
        submission_status: submissionStatusMap[a.id] || null
      })
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: Math.ceil(total / limitNum)
    }
  })
}

// ============================================================
// 과제 출제 (교사 전용)
// POST /api/v1/assignments
// ============================================================

export function createAssignment(req, res) {
  const { title, description, scope, class_id, due_at, questions } = req.body
  const user = req.user

  // 제목 검증
  if (!title?.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '과제 제목을 입력하세요.' }
    })
  }

  // scope 검증
  if (!scope || !['individual', 'team'].includes(scope)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '유효한 과제 유형(individual/team)을 선택하세요.' }
    })
  }

  // class_id 검증 (null이면 전체 반)
  if (class_id !== null && class_id !== undefined) {
    const classRow = db.get('SELECT id FROM classes WHERE id = ?', [class_id])
    if (!classRow) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: '존재하지 않는 반입니다.' }
      })
    }
  }

  // 질문 검증
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '최소 1개의 질문을 추가하세요.' }
    })
  }

  // 각 질문 검증
  const allErrors = []
  for (let i = 0; i < questions.length; i++) {
    const errors = validateQuestion(questions[i], i)
    allErrors.push(...errors)
  }

  if (allErrors.length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: allErrors.join(' ') }
    })
  }

  // 마감일 파싱
  let dueAtValue = null
  if (due_at) {
    const dueDate = new Date(due_at)
    if (isNaN(dueDate.getTime())) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 마감일 형식입니다.' }
      })
    }
    dueAtValue = dueDate.toISOString()
  }

  // 트랜잭션으로 과제 + 질문 생성
  const result = criticalTransaction('assignment_create', () => {
    // 과제 생성
    const { lastInsertRowid: assignmentId } = db.run(
      `INSERT INTO assignments (title, description, scope, class_id, due_at, author_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title.trim(), description || '', scope, class_id || null, dueAtValue, user.id]
    )

    // 질문 생성
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const orderNum = q.order_num || (i + 1)
      const options = q.options ? JSON.stringify(q.options) : null
      const required = q.required !== false ? 1 : 0
      const allowMultiple = q.allow_multiple ? 1 : 0

      db.run(
        `INSERT INTO assignment_questions (assignment_id, order_num, question_type, body, options, required, allow_multiple)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [assignmentId, orderNum, q.question_type, q.body.trim(), options, required, allowMultiple]
      )
    }

    return assignmentId
  })

  // 생성된 과제 조회
  const assignment = db.get(`
    SELECT a.*, u.name as author_name
    FROM assignments a
    JOIN users u ON a.author_id = u.id
    WHERE a.id = ?
  `, [result])

  const savedQuestions = db.all(`
    SELECT * FROM assignment_questions
    WHERE assignment_id = ?
    ORDER BY order_num
  `, [result])

  res.status(201).json({
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      scope: assignment.scope,
      class_id: assignment.class_id,
      due_at: assignment.due_at,
      author: { id: assignment.author_id, name: assignment.author_name },
      created_at: assignment.created_at
    },
    questions: savedQuestions.map(q => ({
      id: q.id,
      order_num: q.order_num,
      question_type: q.question_type,
      body: q.body,
      options: q.options ? JSON.parse(q.options) : null,
      required: !!q.required,
      allow_multiple: !!q.allow_multiple
    }))
  })
}

// ============================================================
// 과제 상세 조회
// GET /api/v1/assignments/:id
// ============================================================

router.get('/:id', authenticate, (req, res) => {
  const { id } = req.params
  const user = req.user

  // 과제 조회
  const assignment = db.get(`
    SELECT a.*, u.name as author_name
    FROM assignments a
    JOIN users u ON a.author_id = u.id
    WHERE a.id = ?
  `, [id])

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

  // 질문 조회
  const questions = db.all(`
    SELECT * FROM assignment_questions
    WHERE assignment_id = ?
    ORDER BY order_num
  `, [id])

  // 학생인 경우 본인/팀 제출물 조회
  let submission = null
  let answers = null

  if (user.role === 'student') {
    if (assignment.scope === 'team' && user.team_id) {
      // 팀 과제: 팀 제출물 조회
      submission = db.get(`
        SELECT s.*, u.name as submitter_name
        FROM submissions s
        JOIN users u ON s.submitter_id = u.id
        WHERE s.assignment_id = ? AND s.team_id = ?
      `, [id, user.team_id])
    } else {
      // 개인 과제: 본인 제출물 조회
      submission = db.get(`
        SELECT s.*, u.name as submitter_name
        FROM submissions s
        JOIN users u ON s.submitter_id = u.id
        WHERE s.assignment_id = ? AND s.submitter_id = ?
      `, [id, user.id])
    }

    // 응답 조회
    if (submission) {
      answers = db.all(`
        SELECT * FROM submission_answers
        WHERE submission_id = ?
      `, [submission.id])
    }
  }

  res.json({
    assignment: {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      scope: assignment.scope,
      class_id: assignment.class_id,
      due_at: assignment.due_at,
      author: { id: assignment.author_id, name: assignment.author_name },
      created_at: assignment.created_at
    },
    questions: questions.map(q => ({
      id: q.id,
      order_num: q.order_num,
      question_type: q.question_type,
      body: q.body,
      options: q.options ? JSON.parse(q.options) : null,
      required: !!q.required,
      allow_multiple: !!q.allow_multiple
    })),
    ...(user.role === 'student' && {
      submission: submission ? {
        id: submission.id,
        status: submission.status,
        version: submission.version,
        feedback: submission.feedback,
        submitted_at: submission.submitted_at,
        submitter: { id: submission.submitter_id, name: submission.submitter_name }
      } : null,
      answers: answers ? answers.map(a => ({
        question_id: a.question_id,
        answer_text: a.answer_text
      })) : null
    })
  })
})

// ============================================================
// 과제 수정 (교사 전용)
// PUT /api/v1/assignments/:id
// ============================================================

router.put('/:id', authenticate, requireTeacher, (req, res) => {
  const { id } = req.params
  const { title, description, scope, class_id, due_at, questions } = req.body
  const user = req.user

  // 과제 존재 확인
  const assignment = db.get('SELECT * FROM assignments WHERE id = ?', [id])
  if (!assignment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' }
    })
  }

  // 제출물이 있는지 확인 (있으면 scope 변경 불가)
  const hasSubmissions = db.get(
    'SELECT 1 FROM submissions WHERE assignment_id = ?',
    [id]
  )

  if (hasSubmissions && scope && scope !== assignment.scope) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '제출물이 있는 과제는 유형을 변경할 수 없습니다.' }
    })
  }

  // 업데이트할 필드 구성
  const updates = []
  const params = []

  if (title !== undefined) {
    if (!title.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: '과제 제목을 입력하세요.' }
      })
    }
    updates.push('title = ?')
    params.push(title.trim())
  }

  if (description !== undefined) {
    updates.push('description = ?')
    params.push(description)
  }

  if (scope !== undefined) {
    if (!['individual', 'team'].includes(scope)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: '유효한 과제 유형을 선택하세요.' }
      })
    }
    updates.push('scope = ?')
    params.push(scope)
  }

  if (class_id !== undefined) {
    if (class_id !== null) {
      const classRow = db.get('SELECT id FROM classes WHERE id = ?', [class_id])
      if (!classRow) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: '존재하지 않는 반입니다.' }
        })
      }
    }
    updates.push('class_id = ?')
    params.push(class_id)
  }

  // 기한 연장 여부 확인을 위한 변수
  let isDeadlineExtended = false
  let newDueAt = null

  if (due_at !== undefined) {
    if (due_at === null) {
      updates.push('due_at = ?')
      params.push(null)
    } else {
      const dueDate = new Date(due_at)
      if (isNaN(dueDate.getTime())) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 마감일 형식입니다.' }
        })
      }
      newDueAt = dueDate.toISOString()
      updates.push('due_at = ?')
      params.push(newDueAt)

      // 기한 연장 여부 확인 (기존 마감일보다 새 마감일이 늦은 경우)
      if (assignment.due_at) {
        const oldDueDate = new Date(assignment.due_at)
        if (dueDate > oldDueDate) {
          isDeadlineExtended = true
        }
      }
    }
  }

  // 트랜잭션으로 과제 + 질문 수정
  criticalTransaction('assignment_update', () => {
    // 과제 업데이트
    if (updates.length > 0) {
      params.push(id)
      db.run(`UPDATE assignments SET ${updates.join(', ')} WHERE id = ?`, params)
    }

    // 질문 업데이트 (questions가 있는 경우)
    if (questions && Array.isArray(questions)) {
      // 기존 질문 조회
      const existingQuestions = db.all(
        'SELECT * FROM assignment_questions WHERE assignment_id = ? ORDER BY order_num',
        [id]
      )

      // 질문이 실제로 변경되었는지 확인
      const questionsChanged = (() => {
        if (existingQuestions.length !== questions.length) return true

        for (let i = 0; i < questions.length; i++) {
          const newQ = questions[i]
          const oldQ = existingQuestions[i]

          if (newQ.question_type !== oldQ.question_type) return true
          if (newQ.body?.trim() !== oldQ.body) return true
          if ((newQ.required !== false ? 1 : 0) !== oldQ.required) return true

          const newOptions = newQ.options ? JSON.stringify(newQ.options) : null
          if (newOptions !== oldQ.options) return true
        }

        return false
      })()

      // 제출물이 있고 질문이 변경되었으면 에러
      if (hasSubmissions && questionsChanged) {
        throw new Error('제출물이 있는 과제의 질문은 수정할 수 없습니다.')
      }

      // 질문이 변경된 경우에만 업데이트
      if (questionsChanged) {
        // 각 질문 검증
        const allErrors = []
        for (let i = 0; i < questions.length; i++) {
          const errors = validateQuestion(questions[i], i)
          allErrors.push(...errors)
        }

        if (allErrors.length > 0) {
          throw new Error(allErrors.join(' '))
        }

        // 기존 질문 삭제 후 새로 생성
        db.run('DELETE FROM assignment_questions WHERE assignment_id = ?', [id])

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i]
          const orderNum = q.order_num || (i + 1)
          const options = q.options ? JSON.stringify(q.options) : null
          const required = q.required !== false ? 1 : 0
          const allowMultiple = q.allow_multiple ? 1 : 0

          db.run(
            `INSERT INTO assignment_questions (assignment_id, order_num, question_type, body, options, required, allow_multiple)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, orderNum, q.question_type, q.body.trim(), options, required, allowMultiple]
          )
        }
      }
    }

    // 기한 연장 시 해당 반 학생들에게 알림 발송
    if (isDeadlineExtended && newDueAt) {
      const targetClassId = class_id !== undefined ? class_id : assignment.class_id
      const assignmentTitle = title !== undefined ? title.trim() : assignment.title

      // 새 마감일 포맷
      const formattedDueAt = new Date(newDueAt).toLocaleString('ko-KR', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      const message = `"${assignmentTitle}" 과제의 제출기한이 ${formattedDueAt}까지로 연장되었습니다.`

      // 해당 반 학생 목록 조회 (전체 반 과제인 경우 모든 학생)
      const students = targetClassId
        ? db.all("SELECT id FROM users WHERE role = 'student' AND class_id = ?", [targetClassId])
        : db.all("SELECT id FROM users WHERE role = 'student'")

      // 각 학생에게 알림 생성
      for (const student of students) {
        db.run(
          `INSERT INTO notifications (type, message, data, class_id, target_id, sender_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            'deadline_extended',
            message,
            JSON.stringify({ assignment_id: parseInt(id), new_due_at: newDueAt }),
            targetClassId,
            student.id,
            user.id
          ]
        )
      }
    }
  })

  // 업데이트된 과제 조회
  const updatedAssignment = db.get(`
    SELECT a.*, u.name as author_name
    FROM assignments a
    JOIN users u ON a.author_id = u.id
    WHERE a.id = ?
  `, [id])

  const updatedQuestions = db.all(`
    SELECT * FROM assignment_questions
    WHERE assignment_id = ?
    ORDER BY order_num
  `, [id])

  res.json({
    assignment: {
      id: updatedAssignment.id,
      title: updatedAssignment.title,
      description: updatedAssignment.description,
      scope: updatedAssignment.scope,
      class_id: updatedAssignment.class_id,
      due_at: updatedAssignment.due_at,
      author: { id: updatedAssignment.author_id, name: updatedAssignment.author_name },
      created_at: updatedAssignment.created_at
    },
    questions: updatedQuestions.map(q => ({
      id: q.id,
      order_num: q.order_num,
      question_type: q.question_type,
      body: q.body,
      options: q.options ? JSON.parse(q.options) : null,
      required: !!q.required,
      allow_multiple: !!q.allow_multiple
    }))
  })
})

// ============================================================
// 과제 삭제 (교사 전용)
// DELETE /api/v1/assignments/:id
// ============================================================

router.delete('/:id', authenticate, requireTeacher, (req, res) => {
  const { id } = req.params

  // 과제 존재 확인
  const assignment = db.get('SELECT * FROM assignments WHERE id = ?', [id])
  if (!assignment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' }
    })
  }

  // 제출물 확인
  const submissionCount = db.get(
    'SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ?',
    [id]
  ).count

  // 트랜잭션으로 삭제
  criticalTransaction('assignment_delete', () => {
    // 제출물 관련 데이터 삭제
    if (submissionCount > 0) {
      // 제출 응답 삭제
      db.run(`
        DELETE FROM submission_answers
        WHERE submission_id IN (SELECT id FROM submissions WHERE assignment_id = ?)
      `, [id])

      // 첨부 파일 연결 해제
      db.run(`
        UPDATE files SET submission_id = NULL, question_id = NULL
        WHERE submission_id IN (SELECT id FROM submissions WHERE assignment_id = ?)
      `, [id])

      // 제출물 삭제
      db.run('DELETE FROM submissions WHERE assignment_id = ?', [id])
    }

    // 질문 삭제
    db.run('DELETE FROM assignment_questions WHERE assignment_id = ?', [id])

    // 과제 삭제
    db.run('DELETE FROM assignments WHERE id = ?', [id])
  })

  res.json({ ok: true, deleted_submissions: submissionCount })
})

export default router
