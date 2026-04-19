// server/middleware/errorHandler.js
// 프로덕션 에러 핸들러

/**
 * Express 에러 핸들러
 * - 개발 환경: 상세 에러 + 스택 트레이스
 * - 프로덕션 환경: 일반적인 에러 메시지만 노출 (보안)
 */
export function errorHandler(err, req, res, next) {
  // 서버 로그에는 전체 에러 기록 (디버깅용)
  console.error(`[error] ${req.method} ${req.path}:`, err)

  // 이미 응답이 시작된 경우 Express 기본 핸들러에 위임
  if (res.headersSent) {
    return next(err)
  }

  // HTTP 상태 코드 결정
  const statusCode = err.statusCode || err.status || 500

  // 프로덕션 환경: 상세 정보 숨김
  if (process.env.NODE_ENV === 'production') {
    return res.status(statusCode).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: statusCode === 500
          ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
          : err.message || '요청을 처리할 수 없습니다.'
      }
    })
  }

  // 개발 환경: 상세 에러 표시 (경로 정보 포함 가능)
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
      stack: err.stack, // 개발 환경에서만
    }
  })
}
