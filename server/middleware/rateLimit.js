// server/middleware/rateLimit.js
// Rate Limiting 미들웨어 - NAT 환경(같은 WiFi) 고려

import rateLimit from 'express-rate-limit'

// ============================================================
// 로그인 시도 제한 (username 기반)
// ============================================================

/**
 * 로그인 Rate Limiter
 * - NAT 환경 대응: IP가 아닌 username 기반 제한
 * - 15분 내 5회 초과 시 차단
 *
 * 적용: POST /api/v1/auth/login
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 5,                     // 5회
  keyGenerator: (req) => {
    // username이 있으면 username 기준, 없으면 IP 기준
    const username = req.body?.username?.toLowerCase()
    return username || req.ip
  },
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도하세요.',
    }
  },
  standardHeaders: true,   // RateLimit-* 헤더 반환
  legacyHeaders: false,    // X-RateLimit-* 헤더 비활성화
  skipSuccessfulRequests: false,  // 성공해도 카운트 (브루트포스 방지)
})

// ============================================================
// 인증된 API 제한 (userID 기반)
// ============================================================

/**
 * 인증된 사용자 Rate Limiter
 * - 사용자당 1분 60회 제한
 * - authenticate 미들웨어 이후에 적용
 *
 * 적용: 인증이 필요한 모든 API
 */
export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 60,               // 사용자당 60회/분
  keyGenerator: (req) => {
    // 인증된 사용자는 user.id 기준, 아니면 IP
    return req.user?.id?.toString() || req.ip
  },
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ============================================================
// 글로벌 제한 (IP 기반, NAT 고려)
// ============================================================

/**
 * 글로벌 Rate Limiter
 * - NAT 환경: 같은 IP를 최대 30명이 공유한다고 가정
 * - IP당 1분 1000회 = 학생당 약 33회/분
 *
 * 적용: /api/v1 전체 (가장 먼저)
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 1000,             // IP당 1000회 (NAT 환경: 30명 공유 시 33회/분/학생)
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ============================================================
// 일반 API 제한 (IP 기반)
// ============================================================

/**
 * 일반 API Rate Limiter
 * - IP당 1분 100회 제한
 * - 인증 불필요 API에 적용
 *
 * 적용: 공개 API
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 100,              // IP당 100회
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// ============================================================
// 파일 업로드 제한 (userID 기반)
// ============================================================

/**
 * 파일 업로드 Rate Limiter
 * - 사용자당 1분 10회 제한
 * - authenticate 미들웨어 이후에 적용
 *
 * 적용: POST /api/v1/files, POST /api/v1/submissions/:id/files
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 10,               // 사용자당 10회
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '파일 업로드 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
})
