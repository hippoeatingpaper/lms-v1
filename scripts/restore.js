// scripts/restore.js
// 백업 복원

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import AdmZip from 'adm-zip'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config()

const DB_PATH = process.env.DB_PATH || './data/database.db'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const PASSWORD = process.env.BACKUP_PASSWORD
const backupFile = process.argv[2]

if (!backupFile) {
  console.error('사용법: node scripts/restore.js <백업파일.zip.enc>')
  console.error('')
  console.error('예시:')
  console.error('  node scripts/restore.js backups/backup_20240419_120000.zip.enc')
  console.error('  npm run restore backups/backup_20240419_120000.zip.enc')
  process.exit(1)
}

if (!fs.existsSync(backupFile)) {
  console.error(`❌ 백업 파일을 찾을 수 없습니다: ${backupFile}`)
  process.exit(1)
}

if (!PASSWORD) {
  console.error('❌ BACKUP_PASSWORD 환경 변수가 설정되지 않았습니다.')
  console.error('   .env 파일에 BACKUP_PASSWORD=비밀번호 를 추가하세요.')
  process.exit(1)
}

async function restore() {
  console.log('🔓 복호화 중...')

  // 복호화
  const key = crypto.scryptSync(PASSWORD, 'salt', 32)
  const encrypted = fs.readFileSync(backupFile)
  const iv = encrypted.slice(0, 16)
  const data = encrypted.slice(16)

  let decrypted
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  } catch (err) {
    console.error('❌ 복호화 실패: 비밀번호가 올바르지 않습니다.')
    process.exit(1)
  }

  console.log('📦 압축 해제 중...')

  // ZIP 압축 해제
  const zip = new AdmZip(decrypted)

  // DB 복원
  const dbEntry = zip.getEntry('database.db')
  if (dbEntry) {
    const dbPath = path.resolve(DB_PATH)
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })

    // 기존 DB 백업
    if (fs.existsSync(dbPath)) {
      const backupPath = dbPath + '.bak'
      fs.copyFileSync(dbPath, backupPath)
      console.log(`   기존 DB 백업: ${backupPath}`)
    }

    fs.writeFileSync(dbPath, zip.readFile(dbEntry))
    console.log('✅ DB 복원 완료')
  } else {
    console.warn('⚠️  백업에 DB 파일이 없습니다.')
  }

  // uploads 복원
  const uploadEntries = zip.getEntries().filter(e => e.entryName.startsWith('uploads/'))

  if (uploadEntries.length > 0) {
    let fileCount = 0

    for (const entry of uploadEntries) {
      const targetPath = path.resolve(entry.entryName)

      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true })
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        fs.writeFileSync(targetPath, zip.readFile(entry))
        fileCount++
      }
    }

    console.log(`✅ 파일 복원 완료 (${fileCount}개 파일)`)
  } else {
    console.log('ℹ️  복원할 업로드 파일이 없습니다.')
  }

  console.log('')
  console.log('✅ 복원 완료!')
  console.log('')
  console.log('⚠️  서버가 실행 중이라면 재시작하세요.')
}

restore().catch(err => {
  console.error('❌ 복원 실패:', err.message)
  process.exit(1)
})
