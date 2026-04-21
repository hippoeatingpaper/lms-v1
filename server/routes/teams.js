// server/routes/teams.js
// 팀 관리 API (교사 전용)

import { Router } from 'express'
import { db, criticalTransaction } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'

const router = Router()

// ============================================================
// 반별 팀 관리 (classes/:classId/teams 경로용)
// ============================================================

/**
 * GET /api/v1/classes/:classId/teams
 * 반별 팀 목록 조회 (팀원 + 미배정 학생 포함)
 */
export function getTeamsByClass(req, res) {
  const { classId } = req.params

  // 반 존재 확인
  const classRow = db.get('SELECT * FROM classes WHERE id = ?', [classId])
  if (!classRow) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '반을 찾을 수 없습니다.' }
    })
  }

  // 팀 목록 조회
  const teams = db.all(
    'SELECT * FROM teams WHERE class_id = ? ORDER BY created_at',
    [classId]
  )

  // 각 팀의 팀원 조회
  const teamsWithMembers = teams.map(team => {
    const members = db.all(
      'SELECT id, name, username FROM users WHERE team_id = ? ORDER BY name',
      [team.id]
    )
    return { ...team, members }
  })

  // 미배정 학생 조회 (해당 반 소속이지만 팀이 없는 학생)
  const unassigned = db.all(
    `SELECT id, name, username FROM users
     WHERE class_id = ? AND team_id IS NULL AND role = 'student'
     ORDER BY name`,
    [classId]
  )

  res.json({
    teams: teamsWithMembers,
    unassigned
  })
}

/**
 * POST /api/v1/classes/:classId/teams
 * 팀 생성
 */
export function createTeam(req, res) {
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
      error: { code: 'VALIDATION_ERROR', message: '팀 이름을 입력하세요.' }
    })
  }

  // 해당 반 내 중복 이름 확인
  const existing = db.get(
    'SELECT id FROM teams WHERE class_id = ? AND name = ?',
    [classId, name.trim()]
  )
  if (existing) {
    return res.status(400).json({
      error: { code: 'DUPLICATE_NAME', message: '해당 반에 이미 존재하는 팀 이름입니다.' }
    })
  }

  // 팀 생성
  const { lastInsertRowid } = db.run(
    'INSERT INTO teams (name, class_id) VALUES (?, ?)',
    [name.trim(), classId]
  )

  const newTeam = db.get('SELECT * FROM teams WHERE id = ?', [lastInsertRowid])

  res.status(201).json({
    team: {
      ...newTeam,
      members: []
    }
  })
}

// ============================================================
// 팀 단일 관리 (/teams/:teamId 경로용)
// ============================================================

/**
 * PATCH /api/v1/teams/:teamId
 * 팀 수정
 */
router.patch('/:teamId', authenticate, requireTeacher, (req, res) => {
  const { teamId } = req.params
  const { name } = req.body

  // 팀 존재 확인
  const team = db.get('SELECT * FROM teams WHERE id = ?', [teamId])
  if (!team) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '팀을 찾을 수 없습니다.' }
    })
  }

  // 이름 검증
  if (!name?.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '팀 이름을 입력하세요.' }
    })
  }

  // 같은 반 내 중복 이름 확인 (자기 자신 제외)
  const existing = db.get(
    'SELECT id FROM teams WHERE class_id = ? AND name = ? AND id != ?',
    [team.class_id, name.trim(), teamId]
  )
  if (existing) {
    return res.status(400).json({
      error: { code: 'DUPLICATE_NAME', message: '해당 반에 이미 존재하는 팀 이름입니다.' }
    })
  }

  // 팀 수정
  db.run('UPDATE teams SET name = ? WHERE id = ?', [name.trim(), teamId])

  const updatedTeam = db.get('SELECT * FROM teams WHERE id = ?', [teamId])

  res.json({ team: updatedTeam })
})

/**
 * DELETE /api/v1/teams/:teamId
 * 팀 삭제
 */
router.delete('/:teamId', authenticate, requireTeacher, (req, res) => {
  const { teamId } = req.params

  // 팀 존재 확인
  const team = db.get('SELECT * FROM teams WHERE id = ?', [teamId])
  if (!team) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '팀을 찾을 수 없습니다.' }
    })
  }

  // 팀 삭제 전 소속 학생들의 team_id를 NULL로 변경
  const members = db.all('SELECT id FROM users WHERE team_id = ?', [teamId])

  criticalTransaction('team_delete', () => {
    // 소속 학생들의 팀 해제
    db.run('UPDATE users SET team_id = NULL WHERE team_id = ?', [teamId])
    // 팀 삭제
    db.run('DELETE FROM teams WHERE id = ?', [teamId])
  })

  // Socket.IO 알림 (Phase 4에서 구현 예정)
  // const io = getIO()
  // for (const member of members) {
  //   io.to(`user:${member.id}`).emit('team:removed', { teamId: parseInt(teamId) })
  // }

  res.json({ ok: true })
})

// ============================================================
// 팀원 관리
// ============================================================

/**
 * POST /api/v1/teams/:teamId/members
 * 팀원 배정
 */
router.post('/:teamId/members', authenticate, requireTeacher, (req, res) => {
  const { teamId } = req.params
  const { user_ids } = req.body

  // 입력 검증
  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '배정할 학생을 선택하세요.' }
    })
  }

  // 팀 존재 확인
  const team = db.get('SELECT * FROM teams WHERE id = ?', [teamId])
  if (!team) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '팀을 찾을 수 없습니다.' }
    })
  }

  // 유효성 검증
  for (const userId of user_ids) {
    const user = db.get(
      "SELECT * FROM users WHERE id = ? AND role = 'student'",
      [userId]
    )

    if (!user) {
      return res.status(400).json({
        error: { code: 'INVALID_USER', message: '유효하지 않은 학생입니다.' }
      })
    }

    if (user.class_id !== team.class_id) {
      return res.status(400).json({
        error: { code: 'INVALID_USER', message: '해당 반에 소속되지 않은 학생이 포함되어 있습니다.' }
      })
    }

    if (user.team_id && user.team_id !== parseInt(teamId)) {
      return res.status(400).json({
        error: { code: 'ALREADY_ASSIGNED', message: '이미 다른 팀에 배정된 학생이 포함되어 있습니다.' }
      })
    }
  }

  // 배정 실행 (중요 작업 - 즉시 저장)
  criticalTransaction('team_assign', () => {
    for (const userId of user_ids) {
      db.run('UPDATE users SET team_id = ? WHERE id = ?', [teamId, userId])
    }
  })

  // Socket.IO 알림 (Phase 4에서 구현 예정)
  // const io = getIO()
  // for (const userId of user_ids) {
  //   io.to(`user:${userId}`).emit('team:assigned', {
  //     teamId: parseInt(teamId),
  //     teamName: team.name,
  //   })
  // }

  // 업데이트된 팀 정보 반환
  const members = db.all(
    'SELECT id, name, username FROM users WHERE team_id = ? ORDER BY name',
    [teamId]
  )

  res.json({
    team: { ...team, members },
    assigned: user_ids
  })
})

/**
 * DELETE /api/v1/teams/:teamId/members/:userId
 * 팀원 제거
 */
router.delete('/:teamId/members/:userId', authenticate, requireTeacher, (req, res) => {
  const { teamId, userId } = req.params

  // 해당 팀 소속 확인
  const user = db.get(
    'SELECT * FROM users WHERE id = ? AND team_id = ?',
    [userId, teamId]
  )

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '해당 팀에 소속되지 않은 학생입니다.' }
    })
  }

  // 팀에서 제거
  criticalTransaction('team_remove', () => {
    db.run('UPDATE users SET team_id = NULL WHERE id = ?', [userId])
  })

  // Socket.IO 알림 (Phase 4에서 구현 예정)
  // const io = getIO()
  // io.to(`user:${userId}`).emit('team:removed', { teamId: parseInt(teamId) })

  res.json({ ok: true })
})

export default router
