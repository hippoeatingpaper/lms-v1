// server/index.js
// Express + HTTPS/HTTP 서버 진입점

import 'dotenv/config'
import express from 'express'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import cors from 'cors'
import cookieParser from 'cookie-parser'

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

// CORS 설정
const allowedOrigins = [
  `http://localhost:${PORT}`,
  `https://localhost:${PORT}`,
  `http://${SERVER_IP}:${PORT}`,
  `https://${SERVER_IP}:${PORT}`,
]

app.use(cors({
  origin: (origin, callback) => {
    // 같은 origin 요청 또는 허용된 origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS not allowed'))
    }
  },
  credentials: true,
}))

// 기본 미들웨어
app.use(cookieParser())
app.use(express.json())

// ============================================================
// 3. 기본 라우트 (임시 - 추후 라우터로 분리)
// ============================================================
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    https: HTTPS_ENABLED,
  })
})

// 404 핸들러
app.use('/api', (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: '요청한 API를 찾을 수 없습니다.' }
  })
})

// ============================================================
// 4. HTTP/HTTPS 서버 생성
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
// 5. 서버 시작 (비동기 초기화 포함)
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
// 6. 프로세스 종료 핸들러
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
