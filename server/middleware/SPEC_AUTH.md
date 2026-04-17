# 인증/보안 백엔드 스펙 (Auth & Security)

> JWT 인증, 토큰 관리, 보안 미들웨어의 백엔드 구현 스펙

## DB Schema

### refresh_tokens — Refresh Token 저장 (무효화 지원)
```sql
CREATE TABLE refresh_tokens (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,           -- SHA256 해시
  expires_at DATETIME NOT NULL,       -- 만료 시점
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

### users 테이블 (참조)
```sql
-- 이미 존재하는 테이블
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,        -- bcryptjs
  role          TEXT NOT NULL,        -- 'teacher' | 'student'
  class_id      INTEGER REFERENCES classes(id),
  team_id       INTEGER REFERENCES teams(id),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 토큰 설정

| 토큰 | 만료 | 저장 위치 | 용도 |
|------|------|----------|------|
| Access Token | 3시간 | httpOnly 쿠키 | API 인증 |
| Refresh Token | 7일 | httpOnly 쿠키 + DB | 토큰 갱신 |

```js
// 환경 변수 (선택적 오버라이드)
JWT_ACCESS_EXPIRES=3h    // 기본 3시간
JWT_REFRESH_EXPIRES=7d   // 기본 7일
JWT_SECRET=최소32자이상의랜덤문자열
```

## API Endpoints

### 로그인 (POST /api/v1/auth/login)

```
POST /api/v1/auth/login
Rate Limit: username당 5회/분

Request:
{
  "username": "student01",
  "password": "password123"
}

Response 200:
{
  "user": {
    "id": 1,
    "name": "홍길동",
    "username": "student01",
    "role": "student",
    "class_id": 1,
    "team_id": 3
  },
  "message": "로그인 성공"
}
Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Lax; Max-Age=10800; Path=/
Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/api/v1/auth/refresh

Error 401:
{ "error": { "code": "INVALID_CREDENTIALS", "message": "아이디 또는 비밀번호가 올바르지 않습니다." } }

Error 429:
{ "error": { "code": "TOO_MANY_REQUESTS", "message": "로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도하세요." } }
```

### 로그아웃 (POST /api/v1/auth/logout)

```
POST /api/v1/auth/logout
Authorization: 인증 필요

Response 200:
{ "ok": true, "message": "로그아웃 되었습니다." }
Set-Cookie: access_token=; Max-Age=0
Set-Cookie: refresh_token=; Max-Age=0; Path=/api/v1/auth/refresh
```

### 토큰 갱신 (POST /api/v1/auth/refresh)

```
POST /api/v1/auth/refresh
Cookie: refresh_token (자동 전송, path=/api/v1/auth/refresh)

Response 200:
{
  "user": { "id": 1, "name": "홍길동", ... },
  "message": "토큰 갱신 성공"
}
Set-Cookie: access_token=새토큰...; HttpOnly; ...
Set-Cookie: refresh_token=새토큰...; HttpOnly; ... (Rotation)

Error 401:
{ "error": { "code": "TOKEN_REVOKED", "message": "세션이 만료되었습니다. 다시 로그인하세요." } }
```

### 인증 상태 확인 (GET /api/v1/auth/me)

```
GET /api/v1/auth/me
Authorization: 인증 필요 (access_token 쿠키)

Response 200:
{
  "user": {
    "id": 1,
    "name": "홍길동",
    "username": "student01",
    "role": "student",
    "class_id": 1,
    "team_id": 3
  }
}

Error 401:
{ "error": { "code": "UNAUTHORIZED", "message": "로그인이 필요합니다." } }
{ "error": { "code": "TOKEN_EXPIRED", "message": "세션이 만료되었습니다." } }
```

## 미들웨어 구현

### authenticate — JWT 인증

```js
// server/middleware/auth.js
import jwt from 'jsonwebtoken'

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
    req.user = payload
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }
      })
    }
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
    })
  }
}
```

### requireRole — 역할 검증

```js
// server/middleware/auth.js
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

// 사용 예시
router.post('/assignments', authenticate, requireRole('teacher'), createAssignment)
```

### requireTeacher — 교사 전용 (단축)

```js
// server/middleware/auth.js
export function requireTeacher(req, res, next) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '교사만 접근 가능합니다.' }
    })
  }
  next()
}
```

### verifyClassAccess — 반 소속 검증

```js
// server/middleware/auth.js
import { db } from '../db.js'

export function verifyClassAccess(req, res, next) {
  const { classId } = req.params

  // 교사는 전체 반 접근 가능
  if (req.user.role === 'teacher') return next()

  // JWT 클레임만 믿지 말고 DB에서 재확인 (클레임 위조 방지)
  const user = db.get('SELECT class_id FROM users WHERE id = ?', [req.user.id])

  if (!user || String(user.class_id) !== String(classId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '해당 반에 접근 권한이 없습니다.' }
    })
  }
  next()
}

// 사용 예시
router.get('/classes/:classId/posts', authenticate, verifyClassAccess, getPosts)
```

## 핵심 로직

### 토큰 발급 함수

```js
// server/routes/auth.js
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '../db.js'

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

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
    path: '/api/v1/auth/refresh',
  })

  // Refresh Token DB 저장 (무효화 지원)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  db.run(
    `INSERT OR REPLACE INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [user.id, hashToken(refreshToken), expiresAt]
  )
}
```

### 로그인 처리

```js
// server/routes/auth.js
import bcrypt from 'bcryptjs'
import { loginLimiter } from '../middleware/rateLimit.js'

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '아이디와 비밀번호를 입력하세요.' }
    })
  }

  const user = db.get(
    'SELECT id, name, username, password_hash, role, class_id, team_id FROM users WHERE username = ?',
    [username]
  )

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다.' }
    })
  }

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
    message: '로그인 성공',
  })
})
```

### 토큰 갱신 처리

```js
// server/routes/auth.js
router.post('/refresh', (req, res) => {
  const token = req.cookies?.refresh_token
  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }
    })
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
  } catch {
    return res.status(401).json({
      error: { code: 'TOKEN_EXPIRED', message: '세션이 만료되었습니다.' }
    })
  }

  // DB에서 토큰 존재 확인 (무효화된 토큰 거부)
  const stored = db.get(
    'SELECT * FROM refresh_tokens WHERE user_id = ? AND token_hash = ?',
    [payload.id, hashToken(token)]
  )

  if (!stored) {
    return res.status(401).json({
      error: { code: 'TOKEN_REVOKED', message: '세션이 만료되었습니다. 다시 로그인하세요.' }
    })
  }

  // 기존 토큰 삭제 (Refresh Token Rotation)
  db.run('DELETE FROM refresh_tokens WHERE id = ?', [stored.id])

  // 사용자 최신 정보 조회
  const user = db.get(
    'SELECT id, name, username, role, class_id, team_id FROM users WHERE id = ?',
    [payload.id]
  )

  if (!user) {
    return res.status(401).json({
      error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' }
    })
  }

  // 새 토큰 발급
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
```

### 로그아웃 처리

```js
// server/routes/auth.js
router.post('/logout', authenticate, (req, res) => {
  // DB에서 Refresh Token 삭제
  db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id])

  // 쿠키 삭제
  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' })

  res.json({ ok: true, message: '로그아웃 되었습니다.' })
})
```

## Rate Limiting

### 로그인 제한 (username 기반)

```js
// server/middleware/rateLimit.js
import rateLimit from 'express-rate-limit'

// NAT 환경 대응: IP가 아닌 username 기반 제한
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 5,               // 5회
  keyGenerator: (req) => req.body?.username?.toLowerCase() || req.ip,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도하세요.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
})
```

### 인증된 API 제한 (userID 기반)

```js
// server/middleware/rateLimit.js
export const authenticatedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,              // 사용자당 60회/분
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: {
    error: { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다.' }
  },
})
```

### 글로벌 제한 (IP 기반, NAT 고려)

```js
// server/middleware/rateLimit.js
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,            // NAT 환경: 30명이 공유해도 33회/분/학생
  message: {
    error: { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다.' }
  },
})
```

## 미들웨어 적용 순서

```js
// server/index.js
import { blockSensitivePaths } from './middleware/securityFilter.js'
import { errorHandler } from './middleware/errorHandler.js'
import { globalLimiter, loginLimiter } from './middleware/rateLimit.js'
import { authenticate } from './middleware/auth.js'

// 1. 보안 필터 (가장 먼저)
app.use(blockSensitivePaths)

// 2. 글로벌 Rate Limit
app.use('/api/v1', globalLimiter)

// 3. 기본 미들웨어
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(cookieParser())
app.use(express.json())

// 4. 인증 라우터 (로그인은 인증 불필요)
app.use('/api/v1/auth', authRouter)

// 5. 인증 필요 라우터
app.use('/api/v1', authenticate, apiRouter)

// 6. 에러 핸들러 (가장 마지막)
app.use(errorHandler)
```

## Socket.IO 인증

```js
// server/sockets/index.js
import jwt from 'jsonwebtoken'
import { parse } from 'cookie'

io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie || ''
  const cookies = parse(cookieHeader)
  const token = cookies.access_token

  if (!token) {
    return next(new Error('UNAUTHORIZED'))
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    })
    socket.data.user = user
    next()
  } catch {
    next(new Error('TOKEN_EXPIRED'))
  }
})

io.on('connection', (socket) => {
  const user = socket.data.user

  // 서버가 직접 Room 입장 (클라이언트 조작 불가)
  socket.join(`user:${user.id}`)
  if (user.class_id) socket.join(`class:${user.class_id}`)
  if (user.team_id) socket.join(`team:${user.team_id}`)
  if (user.role === 'teacher') socket.join('teachers')
})
```

## 민감 경로 차단 미들웨어

### blockSensitivePaths

학생이 URL을 직접 조작하여 `.env`, `.git`, `node_modules` 등 서버의 민감한 파일에 접근하는 것을 차단합니다.

```js
// server/middleware/securityFilter.js
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
```

**적용 위치**: 다른 라우터보다 **먼저** 등록

```js
// server/index.js
import { blockSensitivePaths } from './middleware/securityFilter.js'

// ⚠️ 다른 라우터보다 먼저 등록
app.use(blockSensitivePaths)

// 이후 라우터 등록
app.use('/api/v1', apiRouter)
```

## 프로덕션 에러 핸들러

### errorHandler

에러 발생 시 스택 트레이스에 서버 파일 경로가 노출되는 것을 방지합니다.

```js
// server/middleware/errorHandler.js
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
```

**적용 위치**: 모든 라우터 **이후에** 등록

```js
// server/index.js
import { errorHandler } from './middleware/errorHandler.js'

// 모든 라우터 등록 후 가장 마지막에 등록
app.use('/api/v1', apiRouter)
// ... 기타 라우터

// ⚠️ 에러 핸들러는 항상 마지막에 등록
app.use(errorHandler)
```

> **참고**: Express에서 에러 핸들러는 반드시 4개의 인자(`err, req, res, next`)를 가져야 합니다.

## 보안 체크리스트

- [ ] `jwt.verify()`에 `algorithms: ['HS256']` 명시
- [ ] JWT 페이로드는 참조용, 민감 작업은 DB 재확인
- [ ] `JWT_SECRET`은 최소 32자 랜덤 문자열
- [ ] httpOnly 쿠키 사용 (XSS 방어)
- [ ] HTTPS 환경에서 `secure: true` 설정
- [ ] Refresh Token은 DB 저장 + Rotation
- [ ] 로그아웃 시 DB에서 Refresh Token 삭제
- [ ] Rate Limiting 적용 (username 기반)
- [ ] Socket.IO 연결 시 JWT 검증
- [ ] 민감 경로 차단 미들웨어 적용 (`blockSensitivePaths`)
- [ ] 프로덕션 에러 핸들러 적용 (`errorHandler`)
