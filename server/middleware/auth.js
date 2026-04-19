// server/middleware/auth.js
// JWT 인증 미들웨어

import jwt from 'jsonwebtoken'

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
