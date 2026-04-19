// server/routes/auth.js
// 인증 API - 로그인, 로그아웃, 토큰 갱신, 내 정보

import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db, criticalTransaction } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import { loginLimiter } from '../middleware/rateLimit.js'

const router = Router()

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * Refresh Token 해시 생성
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

/**
 * 토큰 발급 및 쿠키 설정
 * @param {Response} res - Express Response 객체
 * @param {Object} user - 사용자 정보 { id, role, class_id, team_id }
 */
function issueTokens(res, user) {
  const payload = {
    id: user.id,
    role: user.role,
    class_id: user.class_id,
    team_id: user.team_id,
  }

  // Access Token (3시간)
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '3h',
  })

  // Refresh Token (7일)
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  })

  const isHttps = process.env.HTTPS_ENABLED === 'true'

  // Access Token 쿠키
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'Lax',
    maxAge: 3 * 60 * 60 * 1000, // 3시간
    path: '/',
  })

  // Refresh Token 쿠키 (갱신 API 경로에서만 전송)
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    path: '/api/v1/auth',
  })

  // Refresh Token DB 저장 (기존 토큰 대체)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  criticalTransaction('issue_refresh_token', () => {
    // 기존 토큰 삭제 후 새 토큰 저장
    db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id])
    db.run(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, hashToken(refreshToken), expiresAt]
    )
  })
}

// ============================================================
// POST /api/v1/auth/login - 로그인
// ============================================================

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body

  // 입력 검증
  if (!username || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '아이디와 비밀번호를 입력하세요.' }
    })
  }

  // 사용자 조회
  const user = db.get(
    'SELECT id, name, username, password_hash, role, class_id, team_id FROM users WHERE username = ?',
    [username.toLowerCase()]
  )

  // 사용자 존재 여부 및 비밀번호 확인
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다.' }
    })
  }

  // 토큰 발급
  issueTokens(res, user)

  // 응답 (password_hash 제외)
  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      class_id: user.class_id,
      team_id: user.team_id,
    },
    message: '로그인 성공',
  })
})

// ============================================================
// POST /api/v1/auth/logout - 로그아웃
// ============================================================

router.post('/logout', authenticate, (req, res) => {
  // DB에서 Refresh Token 삭제
  criticalTransaction('logout', () => {
    db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id])
  })

  // 쿠키 삭제
  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/api/v1/auth' })

  res.json({ ok: true, message: '로그아웃 되었습니다.' })
})

// ============================================================
// POST /api/v1/auth/refresh - 토큰 갱신
// ============================================================

router.post('/refresh', (req, res) => {
  const token = req.cookies?.refresh_token

  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }
    })
  }

  // JWT 검증
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    })
  } catch (err) {
    // 쿠키 삭제
    res.clearCookie('access_token', { path: '/' })
    res.clearCookie('refresh_token', { path: '/api/v1/auth' })

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다. 다시 로그인하세요.' }
      })
    }
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
    })
  }

  // DB에서 토큰 존재 확인 (무효화된 토큰 거부)
  const stored = db.get(
    'SELECT id FROM refresh_tokens WHERE user_id = ? AND token_hash = ?',
    [payload.id, hashToken(token)]
  )

  if (!stored) {
    // 쿠키 삭제
    res.clearCookie('access_token', { path: '/' })
    res.clearCookie('refresh_token', { path: '/api/v1/auth' })

    return res.status(401).json({
      error: { code: 'TOKEN_REVOKED', message: '세션이 만료되었습니다. 다시 로그인하세요.' }
    })
  }

  // 사용자 최신 정보 조회
  const user = db.get(
    'SELECT id, name, username, role, class_id, team_id FROM users WHERE id = ?',
    [payload.id]
  )

  if (!user) {
    // 사용자가 삭제된 경우
    res.clearCookie('access_token', { path: '/' })
    res.clearCookie('refresh_token', { path: '/api/v1/auth' })

    return res.status(401).json({
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' }
    })
  }

  // 새 토큰 발급 (Refresh Token Rotation - 기존 토큰은 issueTokens에서 삭제됨)
  issueTokens(res, user)

  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      class_id: user.class_id,
      team_id: user.team_id,
    },
    message: '토큰 갱신 성공',
  })
})

// ============================================================
// GET /api/v1/auth/me - 내 정보 조회
// ============================================================

router.get('/me', authenticate, (req, res) => {
  // DB에서 최신 사용자 정보 조회
  const user = db.get(
    'SELECT id, name, username, role, class_id, team_id FROM users WHERE id = ?',
    [req.user.id]
  )

  if (!user) {
    return res.status(401).json({
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' }
    })
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      class_id: user.class_id,
      team_id: user.team_id,
    },
  })
})

export default router
