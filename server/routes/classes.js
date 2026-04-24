// server/routes/classes.js
// 반 관리 API (교사 전용)

import { Router } from 'express'
import { db } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'

const router = Router()
const MAX_CLASSES = 11

/**
 * GET /api/v1/classes
 * 반 목록 조회 (통계 포함)
 */
router.get('/', authenticate, requireTeacher, (req, res) => {
  const classes = db.all(`
    SELECT
      c.*,
      (SELECT COUNT(*) FROM users WHERE class_id = c.id AND role = 'student') as student_count,
      (SELECT COUNT(*) FROM teams WHERE class_id = c.id) as team_count,
      (SELECT COUNT(*) FROM users WHERE class_id = c.id AND team_id IS NULL AND role = 'student') as unassigned_count
    FROM classes c
    ORDER BY c.created_at
  `)

  res.json({
    classes: classes.map(c => ({
      id: c.id,
      name: c.name,
      created_at: c.created_at,
      stats: {
        student_count: c.student_count,
        team_count: c.team_count,
        unassigned_count: c.unassigned_count,
      }
    }))
  })
})

/**
 * POST /api/v1/classes
 * 반 생성
 */
router.post('/', authenticate, requireTeacher, (req, res) => {
  const { name } = req.body

  // 이름 검증
  if (!name?.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '반 이름을 입력하세요.' }
    })
  }

  // 최대 반 개수 확인
  const count = db.get('SELECT COUNT(*) as cnt FROM classes')
  if (count.cnt >= MAX_CLASSES) {
    return res.status(400).json({
      error: { code: 'MAX_CLASSES_EXCEEDED', message: `최대 ${MAX_CLASSES}개의 반만 생성할 수 있습니다.` }
    })
  }

  // 중복 이름 확인
  const existing = db.get('SELECT id FROM classes WHERE name = ?', [name.trim()])
  if (existing) {
    return res.status(400).json({
      error: { code: 'DUPLICATE_NAME', message: '이미 존재하는 반 이름입니다.' }
    })
  }

  // 반 생성
  const { lastInsertRowid } = db.run(
    'INSERT INTO classes (name) VALUES (?)',
    [name.trim()]
  )

  const newClass = db.get('SELECT * FROM classes WHERE id = ?', [lastInsertRowid])

  res.status(201).json({ class: newClass })
})

/**
 * GET /api/v1/classes/:classId
 * 반 상세 조회
 * - 교사: 모든 반 조회 가능 (통계 포함)
 * - 학생: 본인 반만 조회 가능 (기본 정보만)
 */
router.get('/:classId', authenticate, (req, res) => {
  const { classId } = req.params
  const user = req.user

  // 학생은 본인 반만 조회 가능
  if (user.role === 'student' && user.class_id !== parseInt(classId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '권한이 없습니다.' }
    })
  }

  const classRow = db.get(`
    SELECT
      c.*,
      (SELECT COUNT(*) FROM users WHERE class_id = c.id AND role = 'student') as student_count,
      (SELECT COUNT(*) FROM teams WHERE class_id = c.id) as team_count,
      (SELECT COUNT(*) FROM users WHERE class_id = c.id AND team_id IS NULL AND role = 'student') as unassigned_count
    FROM classes c
    WHERE c.id = ?
  `, [classId])

  if (!classRow) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '반을 찾을 수 없습니다.' }
    })
  }

  // 교사에게는 통계 포함, 학생에게는 기본 정보만
  if (user.role === 'teacher') {
    res.json({
      class: {
        id: classRow.id,
        name: classRow.name,
        created_at: classRow.created_at,
        stats: {
          student_count: classRow.student_count,
          team_count: classRow.team_count,
          unassigned_count: classRow.unassigned_count,
        }
      }
    })
  } else {
    res.json({
      class: {
        id: classRow.id,
        name: classRow.name,
      }
    })
  }
})

/**
 * PATCH /api/v1/classes/:classId
 * 반 수정
 */
router.patch('/:classId', authenticate, requireTeacher, (req, res) => {
  const { classId } = req.params
  const { name } = req.body

  // 반 존재 확인
  const classRow = db.get('SELECT * FROM classes WHERE id = ?', [classId])
  if (!classRow) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '반을 찾을 수 없습니다.' }
    })
  }

  // 이름 검증
  if (!name?.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '반 이름을 입력하세요.' }
    })
  }

  // 중복 이름 확인 (자기 자신 제외)
  const existing = db.get(
    'SELECT id FROM classes WHERE name = ? AND id != ?',
    [name.trim(), classId]
  )
  if (existing) {
    return res.status(400).json({
      error: { code: 'DUPLICATE_NAME', message: '이미 존재하는 반 이름입니다.' }
    })
  }

  // 반 수정
  db.run('UPDATE classes SET name = ? WHERE id = ?', [name.trim(), classId])

  const updatedClass = db.get('SELECT * FROM classes WHERE id = ?', [classId])

  res.json({ class: updatedClass })
})

/**
 * DELETE /api/v1/classes/:classId
 * 반 삭제
 */
router.delete('/:classId', authenticate, requireTeacher, (req, res) => {
  const { classId } = req.params

  // 반 존재 확인
  const classRow = db.get('SELECT * FROM classes WHERE id = ?', [classId])
  if (!classRow) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '반을 찾을 수 없습니다.' }
    })
  }

  // 소속 학생 확인
  const studentCount = db.get(
    'SELECT COUNT(*) as cnt FROM users WHERE class_id = ? AND role = ?',
    [classId, 'student']
  )

  if (studentCount.cnt > 0) {
    return res.status(400).json({
      error: {
        code: 'HAS_STUDENTS',
        message: '학생이 배정된 반은 삭제할 수 없습니다. 먼저 학생을 다른 반으로 이동하세요.'
      }
    })
  }

  // 반 삭제 (CASCADE로 팀도 함께 삭제됨)
  db.run('DELETE FROM classes WHERE id = ?', [classId])

  res.json({ ok: true })
})

export default router
