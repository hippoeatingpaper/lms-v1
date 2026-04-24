// server/index.js
// Express + HTTPS/HTTP 서버 진입점

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// .env 파일 경로 설정 (루트 디렉토리)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import express from 'express'
import https from 'https'
import http from 'http'
import fs from 'fs'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'

// 미들웨어
import { blockSensitivePaths } from './middleware/securityFilter.js'
import { errorHandler } from './middleware/errorHandler.js'
import {
  authenticate,
  requireRole,
  requireTeacher,
  verifyClassAccess,
  verifyTeamAccess
} from './middleware/auth.js'
import {
  loginLimiter,
  authenticatedLimiter,
  globalLimiter,
  apiLimiter
} from './middleware/rateLimit.js'

// DB 모듈
import {
  initDatabase,
  startAutoBackup,
  setupCrashHandler,
  db,
  saveDatabase
} from './db.js'

// 스키마 및 마이그레이션
import { createInitialSchema } from './migrations/schema.js'
import { runMigrations } from './migrations/index.js'

// 라우터
import authRouter from './routes/auth.js'
import classRouter from './routes/classes.js'
import userRouter from './routes/users.js'
import teamRouter, { getTeamsByClass, createTeam } from './routes/teams.js'
import postRouter, { getPostsByClass, createPost, deleteComment } from './routes/posts.js'
import assignmentRouter, { getAssignmentsByClass, createAssignment } from './routes/assignments.js'
import submissionRouter, { getSubmissionsByAssignment, saveDraft, submitAssignment } from './routes/submissions.js'
import fileRouter, { getFilesByPost, getFilesBySubmission } from './routes/files.js'

// 환경 변수 기본값
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true'
const SERVER_IP = process.env.SERVER_IP || 'localhost'
const DB_PATH = process.env.DB_PATH || './data/database.db'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const CERT_DIR = '../certs'

// ============================================================
// 1. 필수 디렉터리 자동 생성
// ============================================================
function ensureDirectories() {
  const dbDir = path.dirname(path.resolve(DB_PATH))
  const uploadDir = path.resolve(UPLOAD_DIR)
  const certDir = path.resolve(CERT_DIR)

  fs.mkdirSync(dbDir, { recursive: true })
  fs.mkdirSync(uploadDir, { recursive: true })
  fs.mkdirSync(certDir, { recursive: true })

  console.log(`[INIT] DB 디렉터리: ${dbDir}`)
  console.log(`[INIT] 업로드 디렉터리: ${uploadDir}`)
  console.log(`[INIT] 인증서 디렉터리: ${certDir}`)
}

// ============================================================
// 2. Express 앱 생성
// ============================================================
const app = express()

// ============================================================
// 2-1. 미들웨어 순서대로 적용
// ============================================================

// 1. 보안 필터 (가장 먼저 - 민감 경로 차단)
app.use(blockSensitivePaths)

// 2. 글로벌 Rate Limit (NAT 환경 고려, IP당 1000회/분)
app.use('/api/v1', globalLimiter)

// 3. CORS 설정
const VITE_DEV_PORT = 5173
const allowedOrigins = [
  `http://localhost:${PORT}`,
  `https://localhost:${PORT}`,
  `http://${SERVER_IP}:${PORT}`,
  `https://${SERVER_IP}:${PORT}`,
  // Vite 개발 서버 (개발 환경)
  `http://localhost:${VITE_DEV_PORT}`,
  `http://127.0.0.1:${VITE_DEV_PORT}`,
]

app.use(cors({
  origin: (origin, callback) => {
    // 같은 origin 요청 또는 허용된 origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else if (NODE_ENV === 'development') {
      // 개발 환경에서는 같은 네트워크의 모든 origin 허용
      callback(null, true)
    } else {
      callback(new Error('CORS not allowed'))
    }
  },
  credentials: true,
}))

// 4. 기본 미들웨어
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 5. 정적 파일 서빙
// 주의: uploads 폴더는 직접 서빙하지 않음 (보안)
// 파일 다운로드는 /api/v1/files/:id/download API를 통해서만 가능

// ============================================================
// 6. API 라우터
// ============================================================

// 인증 라우터 (로그인/로그아웃/토큰갱신 - 일부는 인증 불필요)
app.use('/api/v1/auth', authRouter)

// 반 관리 라우터 (교사 전용 - 라우터 내부에서 인증 처리)
app.use('/api/v1/classes', classRouter)

// 학생 관리 라우터 (교사 전용 - 라우터 내부에서 인증 처리)
app.use('/api/v1/users', userRouter)

// 팀 관리 라우터 (교사 전용)
// /api/v1/classes/:classId/teams - 반별 팀 목록/생성
app.get('/api/v1/classes/:classId/teams', authenticate, requireTeacher, getTeamsByClass)
app.post('/api/v1/classes/:classId/teams', authenticate, requireTeacher, createTeam)
// /api/v1/teams - 팀 단일 관리 및 팀원 관리
app.use('/api/v1/teams', teamRouter)

// 게시판 라우터
// /api/v1/classes/:classId/posts - 반별 게시물 목록/작성
app.get('/api/v1/classes/:classId/posts', authenticate, getPostsByClass)
app.post('/api/v1/classes/:classId/posts', authenticate, requireTeacher, createPost)
// /api/v1/posts - 게시물 상세/수정/삭제, 댓글, 좋아요
app.use('/api/v1/posts', postRouter)
// /api/v1/comments - 댓글 삭제
app.delete('/api/v1/comments/:commentId', authenticate, deleteComment)

// 과제 라우터
// /api/v1/classes/:classId/assignments - 반별 과제 목록
app.get('/api/v1/classes/:classId/assignments', authenticate, getAssignmentsByClass)
// /api/v1/assignments - 과제 출제 (교사)
app.post('/api/v1/assignments', authenticate, requireTeacher, createAssignment)

// 제출물 라우터 (assignmentRouter보다 먼저 등록해야 함)
// /api/v1/assignments/:id/submissions - 제출 현황 조회 (교사)
app.get('/api/v1/assignments/:id/submissions', authenticate, requireTeacher, getSubmissionsByAssignment)
// /api/v1/assignments/:id/draft - 임시저장 (학생)
app.post('/api/v1/assignments/:id/draft', authenticate, saveDraft)
// /api/v1/assignments/:id/submit - 최종 제출 (학생)
app.post('/api/v1/assignments/:id/submit', authenticate, submitAssignment)
// /api/v1/submissions - 제출물 상세/피드백/공개
app.use('/api/v1/submissions', submissionRouter)

// /api/v1/assignments - 과제 상세/수정/삭제 (제출물 라우터 이후에 등록)
app.use('/api/v1/assignments', assignmentRouter)

// 파일 라우터 (인증 필수)
// /api/v1/files - 파일 업로드/다운로드/삭제
app.use('/api/v1/files', authenticate, fileRouter)
// /api/v1/posts/:postId/files - 게시물 첨부파일 목록
app.get('/api/v1/posts/:postId/files', authenticate, getFilesByPost)
// /api/v1/submissions/:submissionId/files - 제출물 첨부파일 목록 (GET)
app.get('/api/v1/submissions/:submissionId/files', authenticate, getFilesBySubmission)

// ============================================================
// 7. 기타 라우트
// ============================================================
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    https: HTTPS_ENABLED,
  })
})

// 테스트용 라우트 (개발 환경에서만)
if (NODE_ENV === 'development') {
  // 에러 핸들러 테스트
  app.get('/api/v1/test-error', (req, res, next) => {
    const error = new Error('테스트 에러입니다.')
    error.code = 'TEST_ERROR'
    error.statusCode = 500
    next(error)
  })

  // Phase 1-3: Rate Limiting 테스트
  // 로그인 Rate Limit 테스트 (15분 내 5회 제한)
  app.post('/api/v1/test-login-limit', loginLimiter, (req, res) => {
    res.json({ message: '로그인 시도 성공', attempt: req.rateLimit?.current || 'unknown' })
  })

  // 인증된 사용자 Rate Limit 테스트 (1분 60회 제한)
  app.get('/api/v1/test-auth-limit', authenticate, authenticatedLimiter, (req, res) => {
    res.json({ message: 'API 호출 성공', remaining: req.rateLimit?.remaining || 'unknown' })
  })

  // 일반 API Rate Limit 테스트 (1분 100회 제한)
  app.get('/api/v1/test-api-limit', apiLimiter, (req, res) => {
    res.json({ message: 'API 호출 성공', remaining: req.rateLimit?.remaining || 'unknown' })
  })

  // 인증 테스트 - 인증 필요 라우트
  app.get('/api/v1/test-auth', authenticate, (req, res) => {
    res.json({
      message: '인증 성공',
      user: req.user,
    })
  })

  // Phase 1-2 테스트용 라우트
  // requireRole 테스트
  app.get('/api/v1/test-role-teacher', authenticate, requireRole('teacher'), (req, res) => {
    res.json({ message: '교사 전용 접근 성공', user: req.user })
  })

  app.get('/api/v1/test-role-student', authenticate, requireRole('student'), (req, res) => {
    res.json({ message: '학생 전용 접근 성공', user: req.user })
  })

  app.get('/api/v1/test-role-both', authenticate, requireRole('teacher', 'student'), (req, res) => {
    res.json({ message: '교사/학생 접근 성공', user: req.user })
  })

  // verifyClassAccess 테스트
  app.get('/api/v1/test-class/:classId', authenticate, verifyClassAccess, (req, res) => {
    res.json({ message: '반 접근 성공', classId: req.params.classId, user: req.user })
  })

  // verifyTeamAccess 테스트
  app.get('/api/v1/test-team/:teamId', authenticate, verifyTeamAccess, (req, res) => {
    res.json({ message: '팀 접근 성공', teamId: req.params.teamId, user: req.user })
  })

  // 미들웨어 조합 테스트 (인증 → 반 접근)
  app.get('/api/v1/test-classes/:classId/posts', authenticate, verifyClassAccess, (req, res) => {
    res.json({ message: '반 게시판 접근 성공', classId: req.params.classId, user: req.user })
  })

  // 테스트 데이터 설정 API
  app.post('/api/v1/test-setup', (req, res) => {
    try {
      // 기존 테스트 데이터 삭제
      db.run("DELETE FROM users WHERE username LIKE 'test_%'")
      db.run("DELETE FROM teams WHERE name LIKE 'Test Team%'")
      db.run("DELETE FROM classes WHERE name LIKE 'Test Class%'")

      // 테스트용 반 생성
      const { lastInsertRowid: classId1 } = db.run("INSERT INTO classes (name) VALUES ('Test Class 1')")
      const { lastInsertRowid: classId2 } = db.run("INSERT INTO classes (name) VALUES ('Test Class 2')")

      // 테스트용 팀 생성
      const { lastInsertRowid: teamId1 } = db.run("INSERT INTO teams (name, class_id) VALUES ('Test Team 1', ?)", [classId1])
      const { lastInsertRowid: teamId2 } = db.run("INSERT INTO teams (name, class_id) VALUES ('Test Team 2', ?)", [classId1])
      const { lastInsertRowid: teamId3 } = db.run("INSERT INTO teams (name, class_id) VALUES ('Test Team 3', ?)", [classId2])

      // 테스트용 사용자 생성 (비밀번호는 더미)
      const { lastInsertRowid: teacherId } = db.run(
        "INSERT INTO users (name, username, password_hash, role, class_id, team_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['테스트 교사', 'test_teacher', 'dummy_hash', 'teacher', null, null]
      )
      const { lastInsertRowid: student1Id } = db.run(
        "INSERT INTO users (name, username, password_hash, role, class_id, team_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['테스트 학생1', 'test_student1', 'dummy_hash', 'student', classId1, teamId1]
      )
      const { lastInsertRowid: student2Id } = db.run(
        "INSERT INTO users (name, username, password_hash, role, class_id, team_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['테스트 학생2', 'test_student2', 'dummy_hash', 'student', classId1, teamId2]
      )
      const { lastInsertRowid: student3Id } = db.run(
        "INSERT INTO users (name, username, password_hash, role, class_id, team_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['테스트 학생3', 'test_student3', 'dummy_hash', 'student', classId2, teamId3]
      )
      // 팀이 없는 학생
      const { lastInsertRowid: student4Id } = db.run(
        "INSERT INTO users (name, username, password_hash, role, class_id, team_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['테스트 학생4', 'test_student4', 'dummy_hash', 'student', classId1, null]
      )

      res.json({
        message: '테스트 데이터 설정 완료',
        data: {
          classes: { classId1, classId2 },
          teams: { teamId1, teamId2, teamId3 },
          users: { teacherId, student1Id, student2Id, student3Id, student4Id }
        }
      })
    } catch (err) {
      res.status(500).json({ error: { code: 'TEST_SETUP_ERROR', message: err.message } })
    }
  })

  // 테스트 데이터 정리 API
  app.post('/api/v1/test-cleanup', (req, res) => {
    try {
      db.run("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'test_%')")
      db.run("DELETE FROM users WHERE username LIKE 'test_%'")
      db.run("DELETE FROM teams WHERE name LIKE 'Test Team%'")
      db.run("DELETE FROM classes WHERE name LIKE 'Test Class%'")
      res.json({ message: '테스트 데이터 정리 완료' })
    } catch (err) {
      res.status(500).json({ error: { code: 'TEST_CLEANUP_ERROR', message: err.message } })
    }
  })

  // Auth 테스트용 데이터 설정 API (bcrypt 해시 포함)
  app.post('/api/v1/test-auth-setup', (req, res) => {
    try {
      // 기존 테스트 데이터 삭제
      db.run("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'test_%')")
      db.run("DELETE FROM users WHERE username LIKE 'test_%'")
      db.run("DELETE FROM teams WHERE name LIKE 'Test Team%'")
      db.run("DELETE FROM classes WHERE name LIKE 'Test Class%'")

      // 테스트용 비밀번호 (bcrypt 해시)
      const teacherPassword = 'teacher_pass_123'
      const studentPassword = 'student_pass_123'
      const teacherHash = bcrypt.hashSync(teacherPassword, 10)
      const studentHash = bcrypt.hashSync(studentPassword, 10)

      // 테스트용 반 생성
      const { lastInsertRowid: classId1 } = db.run("INSERT INTO classes (name) VALUES ('Test Auth Class')")

      // 테스트용 팀 생성
      const { lastInsertRowid: teamId1 } = db.run("INSERT INTO teams (name, class_id) VALUES ('Test Auth Team', ?)", [classId1])

      // 테스트용 교사 생성
      const { lastInsertRowid: teacherId } = db.run(
        "INSERT INTO users (name, username, password_hash, role, class_id, team_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['테스트 교사', 'test_auth_teacher', teacherHash, 'teacher', null, null]
      )

      // 테스트용 학생 생성
      const { lastInsertRowid: studentId } = db.run(
        "INSERT INTO users (name, username, password_hash, role, class_id, team_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['테스트 학생', 'test_auth_student', studentHash, 'student', classId1, teamId1]
      )

      res.json({
        message: 'Auth 테스트 데이터 설정 완료',
        data: {
          teacher: {
            id: teacherId,
            username: 'test_auth_teacher',
            password: teacherPassword
          },
          student: {
            id: studentId,
            username: 'test_auth_student',
            password: studentPassword,
            classId: classId1,
            teamId: teamId1
          }
        }
      })
    } catch (err) {
      res.status(500).json({ error: { code: 'TEST_SETUP_ERROR', message: err.message } })
    }
  })
}

// 404 핸들러
app.use('/api', (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: '요청한 API를 찾을 수 없습니다.' }
  })
})

// 8. 에러 핸들러 (가장 마지막)
app.use(errorHandler)

// ============================================================
// 9. HTTP/HTTPS 서버 생성
// ============================================================
let httpServer

function createServer() {
  if (HTTPS_ENABLED) {
    const certPath = path.resolve(CERT_DIR, 'cert.pem')
    const keyPath = path.resolve(CERT_DIR, 'key.pem')

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.error('[ERROR] 인증서 파일이 없습니다.')
      console.error('        먼저 다음 명령을 실행하세요:')
      console.error('        npm run generate-cert')
      process.exit(1)
    }

    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    }

    httpServer = https.createServer(options, app)
    console.log('[SERVER] HTTPS 모드로 서버 실행')
  } else {
    httpServer = http.createServer(app)
    console.log('[SERVER] HTTP 모드로 서버 실행 (개발 환경 전용)')
  }

  return httpServer
}

// ============================================================
// 10. 서버 시작 (비동기 초기화 포함)
// ============================================================
async function start() {
  try {
    // 1. 필수 디렉터리 생성
    ensureDirectories()

    // 2. DB 초기화 (비동기)
    await initDatabase()

    // 3. 초기 스키마 생성 (DB가 비어있을 때만)
    createInitialSchema()

    // 4. 마이그레이션 실행 (동기)
    runMigrations()

    // 5. 크래시 핸들러 설정
    setupCrashHandler()

    // 6. 자동 백업 시작
    startAutoBackup()

    // 7. HTTP/HTTPS 서버 생성
    createServer()

    // 8. 서버 리스닝
    httpServer.listen(PORT, '0.0.0.0', () => {
      const protocol = HTTPS_ENABLED ? 'https' : 'http'
      console.log('')
      console.log('='.repeat(50))
      console.log(`[SERVER] 서버 실행: ${protocol}://${SERVER_IP}:${PORT}`)
      console.log(`[SERVER] 환경: ${NODE_ENV}`)
      console.log(`[SERVER] Health Check: ${protocol}://${SERVER_IP}:${PORT}/api/v1/health`)
      console.log('='.repeat(50))
      console.log('')
    })
  } catch (err) {
    console.error('[FATAL] 서버 시작 실패:', err)
    process.exit(1)
  }
}

// ============================================================
// 11. 프로세스 종료 핸들러
// ============================================================
function gracefulShutdown(signal) {
  console.log(`\n[SERVER] ${signal} 수신, 서버 종료 중...`)

  // DB 저장
  try {
    saveDatabase()
    console.log('[SERVER] DB 저장 완료')
  } catch (err) {
    console.error('[SERVER] DB 저장 실패:', err.message)
  }

  // 서버 종료
  if (httpServer) {
    httpServer.close(() => {
      console.log('[SERVER] 서버 종료 완료')
      process.exit(0)
    })
  } else {
    process.exit(0)
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

// 서버 시작
start()

export { app, httpServer }
