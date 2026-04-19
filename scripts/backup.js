// scripts/backup.js
// DB + uploads 백업 (AES 암호화)

import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import crypto from 'crypto'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config()

const DB_PATH = process.env.DB_PATH || './data/database.db'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const BACKUP_DIR = './backups'
const PASSWORD = process.env.BACKUP_PASSWORD

if (!PASSWORD) {
  console.error('❌ BACKUP_PASSWORD 환경 변수가 설정되지 않았습니다.')
  console.error('   .env 파일에 BACKUP_PASSWORD=비밀번호 를 추가하세요.')
  process.exit(1)
}

async function backup() {
  // 백업 디렉터리 생성
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  // DB 파일 존재 확인
  const dbPath = path.resolve(DB_PATH)
  if (!fs.existsSync(dbPath)) {
    console.error('❌ 데이터베이스 파일이 존재하지 않습니다:', dbPath)
    process.exit(1)
  }

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '')
  const backupName = `backup_${timestamp}_${timeStr}`
  const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`)
  const encPath = path.join(BACKUP_DIR, `${backupName}.zip.enc`)

  console.log('📦 백업 시작...')
  console.log(`   DB: ${dbPath}`)
  console.log(`   업로드 폴더: ${path.resolve(UPLOAD_DIR)}`)

  // ZIP 압축
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', resolve)
    archive.on('error', reject)

    archive.pipe(output)
    archive.file(dbPath, { name: 'database.db' })

    // uploads 폴더가 존재하면 포함
    const uploadPath = path.resolve(UPLOAD_DIR)
    if (fs.existsSync(uploadPath)) {
      archive.directory(uploadPath, 'uploads')
    }

    archive.finalize()
  })

  console.log('🔐 암호화 중...')

  // AES 암호화
  const key = crypto.scryptSync(PASSWORD, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

  const input = fs.createReadStream(zipPath)
  const encrypted = fs.createWriteStream(encPath)

  // IV를 파일 앞에 저장
  encrypted.write(iv)

  await new Promise((resolve, reject) => {
    input.pipe(cipher).pipe(encrypted)
    encrypted.on('finish', resolve)
    encrypted.on('error', reject)
  })

  // 원본 ZIP 삭제
  fs.unlinkSync(zipPath)

  // 파일 크기 확인
  const stats = fs.statSync(encPath)
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2)

  console.log('')
  console.log('✅ 백업 완료!')
  console.log(`   파일: ${encPath}`)
  console.log(`   크기: ${sizeMB} MB`)
  console.log('')
  console.log('💡 복원 명령어:')
  console.log(`   npm run restore ${encPath}`)
}

backup().catch(err => {
  console.error('❌ 백업 실패:', err.message)
  process.exit(1)
})
