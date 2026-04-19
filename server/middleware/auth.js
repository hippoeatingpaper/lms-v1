// server/middleware/auth.js
// JWT 인증 및 권한 검증 미들웨어

import jwt from 'jsonwebtoken'
import { db } from '../db.js'

/**
 * JWT 인증 미들웨어
 * - httpOnly 쿠키에서 access_token 추출
 * - JWT 검증 후 req.user에 페이로드 저장
 * - 만료/무효 토큰 에러 처리
 */
export function authenticate(req, res, next) {
  const token = req.cookies?.access_token

  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }
    })
  }

  try {
    // algorithms 옵션 필수 (none 알고리즘 공격 방지)
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    })

    // req.user에 사용자 정보 저장
    // { id, role, class_id, team_id }
    req.user = payload
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }
      })
    }

    // JsonWebTokenError, NotBeforeError 등
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
    })
  }
}

/**
 * 인증 선택적 미들웨어
 * - 토큰이 있으면 검증 후 req.user 설정
 * - 토큰이 없어도 에러 없이 통과 (req.user = null)
 * - 공개 API에서 로그인 사용자 구분이 필요할 때 사용
 */
export function optionalAuth(req, res, next) {
  const token = req.cookies?.access_token

  if (!token) {
    req.user = null
    return next()
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    })
    req.user = payload
  } catch {
    req.user = null
  }

  next()
}

// ============================================================
// 역할 검증 미들웨어
// ============================================================

/**
 * 역할 검증 미들웨어
 * @param {...string} roles - 허용할 역할 목록 ('teacher', 'student')
 * @returns {Function} Express 미들웨어
 *
 * 사용 예시:
 *   router.post('/assignments', authenticate, requireRole('teacher'), createAssignment)
 *   router.get('/posts', authenticate, requireRole('teacher', 'student'), getPosts)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' }
      })
    }
    next()
  }
}

/**
 * 교사 전용 미들웨어 (단축)
 *
 * 사용 예시:
 *   router.post('/classes', authenticate, requireTeacher, createClass)
 */
export function requireTeacher(req, res, next) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '교사만 접근 가능합니다.' }
    })
  }
  next()
}

// ============================================================
// 반/팀 소속 검증 미들웨어
// ============================================================

/**
 * 반 소속 검증 미들웨어
 * - 교사: 전체 반 접근 가능
 * - 학생: 자신이 속한 반만 접근 가능 (DB에서 재확인)
 *
 * 주의: JWT 클레임만 믿지 않고 DB에서 재확인 (클레임 위조 방지)
 *
 * 사용 예시:
 *   router.get('/classes/:classId/posts', authenticate, verifyClassAccess, getPosts)
 */
export function verifyClassAccess(req, res, next) {
  const { classId } = req.params

  // classId 파라미터 검증
  if (!classId) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '반 ID가 필요합니다.' }
    })
  }

  // 교사는 전체 반 접근 가능
  if (req.user.role === 'teacher') {
    return next()
  }

  // 학생: DB에서 반 소속 재확인 (JWT 클레임 위조 방지)
  const user = db.get('SELECT class_id FROM users WHERE id = ?', [req.user.id])

  if (!user || String(user.class_id) !== String(classId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '해당 반에 접근 권한이 없습니다.' }
    })
  }

  next()
}

/**
 * 팀 소속 검증 미들웨어
 * - 교사: 전체 팀 접근 가능
 * - 학생: 자신이 속한 팀만 접근 가능 (DB에서 재확인)
 *
 * 사용 예시:
 *   router.get('/teams/:teamId/documents', authenticate, verifyTeamAccess, getDocuments)
 */
export function verifyTeamAccess(req, res, next) {
  const { teamId } = req.params

  // teamId 파라미터 검증
  if (!teamId) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '팀 ID가 필요합니다.' }
    })
  }

  // 교사는 전체 팀 접근 가능
  if (req.user.role === 'teacher') {
    return next()
  }

  // 학생: DB에서 팀 소속 재확인 (JWT 클레임 위조 방지)
  const user = db.get('SELECT team_id FROM users WHERE id = ?', [req.user.id])

  if (!user || String(user.team_id) !== String(teamId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '해당 팀에 접근 권한이 없습니다.' }
    })
  }

  next()
}

/**
 * 반+팀 복합 검증 미들웨어
 * - 해당 팀이 해당 반에 속하는지도 확인
 *
 * 사용 예시:
 *   router.get('/classes/:classId/teams/:teamId', authenticate, verifyClassTeamAccess, getTeam)
 */
export function verifyClassTeamAccess(req, res, next) {
  const { classId, teamId } = req.params

  // 파라미터 검증
  if (!classId || !teamId) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '반 ID와 팀 ID가 필요합니다.' }
    })
  }

  // 팀이 해당 반에 속하는지 확인
  const team = db.get('SELECT id, class_id FROM teams WHERE id = ?', [teamId])

  if (!team || String(team.class_id) !== String(classId)) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '해당 반에서 팀을 찾을 수 없습니다.' }
    })
  }

  // 교사는 전체 접근 가능
  if (req.user.role === 'teacher') {
    return next()
  }

  // 학생: DB에서 반/팀 소속 재확인
  const user = db.get('SELECT class_id, team_id FROM users WHERE id = ?', [req.user.id])

  if (!user) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '사용자 정보를 찾을 수 없습니다.' }
    })
  }

  if (String(user.class_id) !== String(classId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '해당 반에 접근 권한이 없습니다.' }
    })
  }

  if (String(user.team_id) !== String(teamId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '해당 팀에 접근 권한이 없습니다.' }
    })
  }

  next()
}
