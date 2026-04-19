// server/middleware/securityFilter.js
// 민감 경로 차단 미들웨어

/**
 * 민감한 파일/디렉터리 접근 차단
 * .env, .git, node_modules 등 서버 내부 파일 접근 방지
 */
export function blockSensitivePaths(req, res, next) {
  const blockedPatterns = [
    '.env',
    '.git',
    '.pem',
    '.key',
    'node_modules',
    '.DS_Store',
    'Thumbs.db',
    '.vscode',
    '.idea',
    '/data/',
    '/certs/',
  ]

  const lowerPath = req.path.toLowerCase()

  if (blockedPatterns.some(pattern => lowerPath.includes(pattern))) {
    console.warn(`[security] 차단된 경로 접근 시도: ${req.ip} → ${req.path}`)
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '접근이 허용되지 않는 경로입니다.' }
    })
  }

  next()
}
