# Server - Backend Rules

> 각 기능별 상세 스펙은 해당 SPEC 파일을 참조하세요.

## Feature Specs (기능별 상세 스펙)
| 기능 | 스펙 파일 |
|------|----------|
| **서버 설정 (HTTPS, 환경변수, CLI)** | `SPEC_SETUP.md` |
| **데이터베이스 (sql.js, 저장 전략, 마이그레이션)** | `SPEC_DATABASE.md` |
| 인증/보안 (JWT, 미들웨어) | `middleware/SPEC_AUTH.md` |
| 파일 업로드 (Multer, MIME 검증) | `middleware/SPEC_UPLOAD.md` |
| 반/팀/학생 관리 (Admin) | `routes/SPEC_ADMIN.md` |
| 게시판 (공지/자료/댓글/좋아요) | `routes/SPEC_POSTS.md` |
| 과제 출제/제출/피드백 | `routes/SPEC_ASSIGNMENTS.md` |
| 공동 문서 편집 (Yjs) | `sockets/SPEC_COLLAB.md` |
| 실시간 알림 (Socket.IO) | `sockets/SPEC_REALTIME.md` |

> 해당 기능 구현 시 반드시 스펙 파일을 먼저 참조하세요.

## File Structure
```
server/
├── index.js           # Express + Socket.IO + Yjs 진입점
├── db.js              # sql.js 래퍼
├── routes/
│   ├── auth.js        # 로그인/로그아웃/토큰갱신
│   ├── classes.js     # 반 CRUD
│   ├── posts.js       # 게시판 (공지/자료)
│   ├── assignments.js # 과제 출제/목록
│   ├── submissions.js # 과제 제출/피드백
│   ├── files.js       # 파일 업로드/다운로드
│   ├── teams.js       # 팀 관리
│   └── users.js       # 학생 계정 관리
├── middleware/
│   ├── auth.js           # JWT 인증 (authenticate, requireRole)
│   ├── upload.js         # Multer + MIME 검증
│   ├── rateLimit.js      # Rate Limiting
│   ├── securityFilter.js # 민감 경로 차단
│   └── errorHandler.js   # 프로덕션 에러 핸들러
├── sockets/
│   └── index.js       # Socket.IO 이벤트
└── migrations/
    └── index.js       # DB 마이그레이션
```

## Middleware Order (index.js)
```js
// 1. 보안 필터 (가장 먼저)
app.use(blockSensitivePaths)

// 2. 기본 미들웨어
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(cookieParser())
app.use(express.json())

// 3. 라우터
app.use('/api/v1/auth', authRouter)
app.use('/api/v1', authenticate, apiRouter)  // 인증 필요

// 4. 에러 핸들러 (가장 마지막)
app.use(errorHandler)
```

## sql.js Database Pattern
```js
import { db, saveImmediate, criticalTransaction } from './db.js'

// 단일 조회
const user = db.get('SELECT * FROM users WHERE id = ?', [id])

// 다중 조회
const users = db.all('SELECT * FROM users WHERE class_id = ?', [classId])

// 삽입/수정/삭제 (자동 디바운스 저장)
const { lastInsertRowid } = db.run(
  'INSERT INTO users (name, username) VALUES (?, ?)',
  [name, username]
)

// 중요 작업 (즉시 저장) - 제출, 피드백, 계정생성, 팀배정
criticalTransaction('submission_submit', () => {
  db.run('UPDATE submissions SET status = ? WHERE id = ?', ['submitted', id])
  // ... 추가 쿼리
})
```

## JWT Authentication Pattern
```js
// middleware/auth.js
import jwt from 'jsonwebtoken'

export function authenticate(req, res, next) {
  const token = req.cookies.access_token
  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded  // { id, username, role, class_id, team_id }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: '토큰이 만료되었습니다.' }
      })
    }
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }
    })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' }
      })
    }
    next()
  }
}
```

## Cookie Settings
```js
const cookieOptions = {
  httpOnly: true,
  secure: process.env.HTTPS_ENABLED === 'true',
  sameSite: 'Lax',
  maxAge: 3 * 60 * 60 * 1000,  // 3시간
  path: '/',
}

res.cookie('access_token', token, cookieOptions)
```

## API Response Format
```js
// 성공
res.json({ user: {...}, message: '로그인 성공' })
res.json({ assignments: [...] })
res.json({ ok: true })

// 에러
res.status(400).json({
  error: { code: 'VALIDATION_ERROR', message: '필수 항목을 입력하세요.' }
})
res.status(401).json({
  error: { code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다.' }
})
res.status(404).json({
  error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' }
})
```

## File Upload Pattern
```js
// middleware/upload.js
import multer from 'multer'
import { fileTypeFromBuffer } from 'file-type'

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png',
  'video/mp4',
]

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g,'')
    cb(null, `${timestamp}_${file.originalname}`)
  }
})

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024  // 100MB (동영상)
  },
  fileFilter: async (req, file, cb) => {
    // MIME 타입 검증 로직
  }
})
```

## Socket.IO Rooms
```js
// Room 명명 규칙
`class:${classId}`   // 반 전체
`team:${teamId}`     // 팀
`user:${userId}`     // 개인

// 이벤트
socket.join(`class:${user.class_id}`)
io.to(`class:${classId}`).emit('notification', { ... })
io.to(`team:${teamId}`).emit('team:assigned', { ... })
```

## Rate Limiting
```js
import rateLimit from 'express-rate-limit'

// 로그인 시도 제한
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 5,  // 5회
  keyGenerator: (req) => req.body.username || req.ip,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: '잠시 후 다시 시도하세요.' }}
})

// 일반 API 제한
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 100,
})
```

## DB Tables (Quick Reference)
```
users (id, name, username, password_hash, role, class_id, team_id)
classes (id, name)
teams (id, name, class_id)
posts (id, title, content, type, author_id, class_id)
assignments (id, title, description, scope, class_id, due_at, author_id)
assignment_questions (id, assignment_id, order_num, question_type, body, options)
submissions (id, assignment_id, submitter_id, team_id, status, feedback)
submission_answers (id, submission_id, question_id, answer_text)
files (id, filename, filepath, size, class_id, post_id, submission_id)
documents (id, title, team_id, ydoc_state)
comments (id, body, post_id, author_id)
likes (id, post_id, user_id)
notifications (id, message, class_id, target_id)
refresh_tokens (id, user_id, token_hash, expires_at)
```
