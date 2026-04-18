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

// 환경 변수 기본값
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true'
const SERVER_IP = process.env.SERVER_IP || 'localhost'
const DB_PATH = process.env.DB_PATH || './data/database.db'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const CERT_DIR = './certs'

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

// 서버 시작 전 반드시 호출
ensureDirectories()

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

// ============================================================
// 5. 서버 시작
// ============================================================
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

// ============================================================
// 6. 프로세스 종료 핸들러
// ============================================================
process.on('SIGINT', () => {
  console.log('\n[SERVER] 서버 종료 중...')
  httpServer.close(() => {
    console.log('[SERVER] 서버 종료 완료')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\n[SERVER] 서버 종료 중...')
  httpServer.close(() => {
    console.log('[SERVER] 서버 종료 완료')
    process.exit(0)
  })
})

export { app, httpServer }
