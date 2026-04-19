// server/routes/users.js
// 학생 계정 관리 API (교사 전용)

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db, criticalTransaction } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'

const router = Router()

/**
 * GET /api/v1/users
 * 학생 목록 조회
 * Query: class_id (선택), unassigned (선택)
 */
router.get('/', authenticate, requireTeacher, (req, res) => {
  const { class_id, unassigned } = req.query

  let sql = `
    SELECT
      u.id, u.name, u.username, u.role, u.class_id, u.team_id, u.created_at,
      c.name as class_name,
      t.name as team_name
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.role = 'student'
  `
  const params = []

  if (class_id) {
    sql += ' AND u.class_id = ?'
    params.push(class_id)
  }

  if (unassigned === 'true') {
    sql += ' AND u.class_id IS NULL'
  }

  sql += ' ORDER BY u.class_id, u.name'

  const users = db.all(sql, params)
  res.json({ users })
})

/**
 * GET /api/v1/users/:userId
 * 학생 상세 조회
 */
router.get('/:userId', authenticate, requireTeacher, (req, res) => {
  const { userId } = req.params

  const user = db.get(`
    SELECT
      u.id, u.name, u.username, u.role, u.class_id, u.team_id, u.created_at,
      c.name as class_name,
      t.name as team_name
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.id = ? AND u.role = 'student'
  `, [userId])

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '학생을 찾을 수 없습니다.' }
    })
  }

  res.json({ user })
})

/**
 * POST /api/v1/users
 * 학생 계정 생성
 */
router.post('/', authenticate, requireTeacher, (req, res) => {
  const { name, username, password, class_id } = req.body

  // 필수 필드 검증
  if (!name?.trim() || !username?.trim() || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '이름, 아이디, 비밀번호를 입력하세요.' }
    })
  }

  // 아이디 중복 확인
  const existing = db.get('SELECT id FROM users WHERE username = ?', [username.trim()])
  if (existing) {
    return res.status(400).json({
      error: { code: 'DUPLICATE_USERNAME', message: '이미 사용 중인 아이디입니다.' }
    })
  }

  // class_id 유효성 확인 (제공된 경우)
  if (class_id) {
    const classExists = db.get('SELECT id FROM classes WHERE id = ?', [class_id])
    if (!classExists) {
      return res.status(400).json({
        error: { code: 'INVALID_CLASS', message: '존재하지 않는 반입니다.' }
      })
    }
  }

  // 비밀번호 해시
  const passwordHash = bcrypt.hashSync(password, 10)

  // 학생 생성 (중요 작업 - 즉시 저장)
  const result = criticalTransaction('user_create', () => {
    return db.run(
      'INSERT INTO users (name, username, password_hash, role, class_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), username.trim(), passwordHash, 'student', class_id || null]
    )
  })

  const user = db.get(
    'SELECT id, name, username, role, class_id, team_id, created_at FROM users WHERE id = ?',
    [result.lastInsertRowid]
  )

  res.status(201).json({ user })
})

/**
 * POST /api/v1/users/bulk
 * 학생 일괄 생성
 */
router.post('/bulk', authenticate, requireTeacher, (req, res) => {
  const { class_id, users } = req.body

  // 필수 필드 검증
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '생성할 학생 목록을 입력하세요.' }
    })
  }

  // class_id 유효성 확인 (제공된 경우)
  if (class_id) {
    const classExists = db.get('SELECT id FROM classes WHERE id = ?', [class_id])
    if (!classExists) {
      return res.status(400).json({
        error: { code: 'INVALID_CLASS', message: '존재하지 않는 반입니다.' }
      })
    }
  }

  const created = []
  const failed = []

  // 일괄 생성 (트랜잭션)
  criticalTransaction('users_bulk_create', () => {
    for (const userData of users) {
      const { name, username, password } = userData

      // 필수 필드 검증
      if (!name?.trim() || !username?.trim() || !password) {
        failed.push({
          username: username || '(없음)',
          error: '이름, 아이디, 비밀번호를 입력하세요.'
        })
        continue
      }

      // 아이디 중복 확인
      const existing = db.get('SELECT id FROM users WHERE username = ?', [username.trim()])
      if (existing) {
        failed.push({
          username: username.trim(),
          error: '이미 사용 중인 아이디입니다.'
        })
        continue
      }

      // 비밀번호 해시 및 생성
      const passwordHash = bcrypt.hashSync(password, 10)
      db.run(
        'INSERT INTO users (name, username, password_hash, role, class_id) VALUES (?, ?, ?, ?, ?)',
        [name.trim(), username.trim(), passwordHash, 'student', class_id || null]
      )
      created.push(username.trim())
    }
  })

  res.status(201).json({
    created: created.length,
    failed
  })
})

/**
 * PATCH /api/v1/users/:userId
 * 학생 정보 수정
 */
router.patch('/:userId', authenticate, requireTeacher, (req, res) => {
  const { userId } = req.params
  const { name, class_id, team_id } = req.body

  // 학생 존재 확인
  const user = db.get('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'student'])
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '학생을 찾을 수 없습니다.' }
    })
  }

  const updates = []
  const params = []

  // 이름 수정
  if (name !== undefined) {
    if (!name?.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: '이름을 입력하세요.' }
      })
    }
    updates.push('name = ?')
    params.push(name.trim())
  }

  // 반 변경
  if (class_id !== undefined) {
    // class_id 유효성 확인 (null이 아닌 경우)
    if (class_id !== null) {
      const classExists = db.get('SELECT id FROM classes WHERE id = ?', [class_id])
      if (!classExists) {
        return res.status(400).json({
          error: { code: 'INVALID_CLASS', message: '존재하지 않는 반입니다.' }
        })
      }
    }

    updates.push('class_id = ?')
    params.push(class_id)

    // 반이 변경되면 팀도 초기화
    if (class_id !== user.class_id) {
      updates.push('team_id = NULL')
    }
  }

  // 팀 변경 (반 변경이 없을 때만)
  if (team_id !== undefined && class_id === undefined) {
    // team_id 유효성 확인 (null이 아닌 경우)
    if (team_id !== null) {
      const team = db.get('SELECT id, class_id FROM teams WHERE id = ?', [team_id])
      if (!team) {
        return res.status(400).json({
          error: { code: 'INVALID_TEAM', message: '존재하지 않는 팀입니다.' }
        })
      }
      // 팀이 해당 학생의 반에 속하는지 확인
      if (team.class_id !== user.class_id) {
        return res.status(400).json({
          error: { code: 'INVALID_TEAM', message: '해당 반에 속하지 않는 팀입니다.' }
        })
      }
    }
    updates.push('team_id = ?')
    params.push(team_id)
  }

  if (updates.length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '수정할 항목이 없습니다.' }
    })
  }

  params.push(userId)
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

  // 업데이트된 사용자 정보 조회
  const updatedUser = db.get(`
    SELECT
      u.id, u.name, u.username, u.role, u.class_id, u.team_id, u.created_at,
      c.name as class_name,
      t.name as team_name
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.id = ?
  `, [userId])

  // TODO: Socket.IO로 학생에게 알림 (Phase 4에서 구현)
  // io.to(`user:${userId}`).emit('user:updated', { user: updatedUser })

  res.json({ user: updatedUser })
})

/**
 * POST /api/v1/users/:userId/reset-password
 * 비밀번호 초기화
 */
router.post('/:userId/reset-password', authenticate, requireTeacher, (req, res) => {
  const { userId } = req.params
  const { new_password } = req.body

  // 새 비밀번호 검증
  if (!new_password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '새 비밀번호를 입력하세요.' }
    })
  }

  // 학생 존재 확인
  const user = db.get('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'student'])
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '학생을 찾을 수 없습니다.' }
    })
  }

  // 비밀번호 해시 및 업데이트
  const passwordHash = bcrypt.hashSync(new_password, 10)
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId])

  res.json({ ok: true, message: '비밀번호가 초기화되었습니다.' })
})

/**
 * DELETE /api/v1/users/:userId
 * 학생 계정 삭제
 */
router.delete('/:userId', authenticate, requireTeacher, (req, res) => {
  const { userId } = req.params

  // 학생 존재 확인
  const user = db.get('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'student'])
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '학생을 찾을 수 없습니다.' }
    })
  }

  // 학생 삭제 (CASCADE로 관련 데이터도 삭제됨)
  db.run('DELETE FROM users WHERE id = ?', [userId])

  res.json({ ok: true })
})

export default router
