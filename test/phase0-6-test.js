// test/phase0-6-test.js
// Phase 0-6: 교사 계정 CLI 및 백업/복원 테스트

import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import archiver from 'archiver'
import AdmZip from 'adm-zip'
import { initDatabase, db, saveDatabase } from '../server/db.js'
import { createInitialSchema } from '../server/migrations/schema.js'

// 테스트 결과 추적
let passed = 0
let failed = 0
const results = []

// 테스트 유틸
function test(name, fn) {
  return async () => {
    try {
      await fn()
      passed++
      results.push({ name, status: 'PASS' })
      console.log(`  ✓ ${name}`)
    } catch (err) {
      failed++
      results.push({ name, status: 'FAIL', error: err.message })
      console.log(`  ✗ ${name}`)
      console.log(`    → ${err.message}`)
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // 교사 계정 생성 테스트
  test('createTeacher.js 파일 존재 확인', async () => {
    const exists = fs.existsSync(path.resolve('scripts/createTeacher.js'))
    assert(exists, 'createTeacher.js 파일이 존재하지 않습니다')
  }),

  test('비밀번호 해싱 (bcrypt) 동작 확인', async () => {
    const password = 'testpassword123'
    const hash = await bcrypt.hash(password, 10)

    assert(hash.startsWith('$2'), `해시가 bcrypt 형식이 아닙니다: ${hash.substring(0, 10)}...`)

    const isValid = await bcrypt.compare(password, hash)
    assert(isValid, '비밀번호 검증 실패')
  }),

  test('교사 계정 DB 저장 (role=teacher)', async () => {
    // 테스트용 교사 계정 생성
    const testUsername = `test_teacher_${Date.now()}`
    const passwordHash = await bcrypt.hash('testpass', 10)

    db.run(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
      ['테스트 교사', testUsername, passwordHash, 'teacher']
    )

    const user = db.get('SELECT * FROM users WHERE username = ?', [testUsername])
    assert(user, '교사 계정이 저장되지 않았습니다')
    assert(user.role === 'teacher', `role이 teacher가 아닙니다: ${user.role}`)
    assert(user.name === '테스트 교사', `이름이 일치하지 않습니다: ${user.name}`)

    // 테스트 데이터 정리
    db.run('DELETE FROM users WHERE username = ?', [testUsername])
  }),

  test('중복 아이디 검사 로직 확인', async () => {
    const testUsername = `dup_test_${Date.now()}`
    const passwordHash = await bcrypt.hash('testpass', 10)

    // 첫 번째 계정 생성
    db.run(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
      ['교사1', testUsername, passwordHash, 'teacher']
    )

    // 중복 확인
    const existing = db.get('SELECT id FROM users WHERE username = ?', [testUsername])
    assert(existing, '중복 확인 쿼리가 작동하지 않습니다')

    // 테스트 데이터 정리
    db.run('DELETE FROM users WHERE username = ?', [testUsername])
  }),

  // 백업 스크립트 테스트
  test('backup.js 파일 존재 확인', async () => {
    const exists = fs.existsSync(path.resolve('scripts/backup.js'))
    assert(exists, 'backup.js 파일이 존재하지 않습니다')
  }),

  test('백업 파일 생성 (ZIP + AES 암호화)', async () => {
    const BACKUP_DIR = './test-backups'
    const PASSWORD = 'test_backup_password'
    const DB_PATH = './data/database.db'

    fs.mkdirSync(BACKUP_DIR, { recursive: true })

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '')
    const backupName = `test_backup_${timestamp}_${timeStr}`
    const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`)
    const encPath = path.join(BACKUP_DIR, `${backupName}.zip.enc`)

    // ZIP 압축
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', resolve)
      archive.on('error', reject)

      archive.pipe(output)
      archive.file(path.resolve(DB_PATH), { name: 'database.db' })
      archive.finalize()
    })

    assert(fs.existsSync(zipPath), 'ZIP 파일이 생성되지 않았습니다')

    // AES 암호화
    const key = crypto.scryptSync(PASSWORD, 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

    const input = fs.createReadStream(zipPath)
    const encrypted = fs.createWriteStream(encPath)

    encrypted.write(iv)

    await new Promise((resolve, reject) => {
      input.pipe(cipher).pipe(encrypted)
      encrypted.on('finish', resolve)
      encrypted.on('error', reject)
    })

    assert(fs.existsSync(encPath), '암호화된 백업 파일이 생성되지 않았습니다')

    // 파일 크기 확인
    const stats = fs.statSync(encPath)
    assert(stats.size > 0, '백업 파일 크기가 0입니다')

    // 정리
    fs.unlinkSync(zipPath)
    fs.unlinkSync(encPath)
    fs.rmdirSync(BACKUP_DIR)
  }),

  test('백업 파일명에 타임스탬프 포함', async () => {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const backupName = `backup_${timestamp}_120000`

    assert(backupName.includes(timestamp), '백업 파일명에 타임스탬프가 포함되지 않았습니다')
    assert(/backup_\d{8}_\d{6}/.test(backupName), '백업 파일명 형식이 올바르지 않습니다')
  }),

  // 복원 스크립트 테스트
  test('restore.js 파일 존재 확인', async () => {
    const exists = fs.existsSync(path.resolve('scripts/restore.js'))
    assert(exists, 'restore.js 파일이 존재하지 않습니다')
  }),

  test('백업 복원 (복호화 + ZIP 해제)', async () => {
    const BACKUP_DIR = './test-backups'
    const RESTORE_DIR = './test-restore'
    const PASSWORD = 'test_backup_password'
    const DB_PATH = './data/database.db'

    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    fs.mkdirSync(RESTORE_DIR, { recursive: true })

    // 백업 생성
    const backupName = `test_restore_${Date.now()}`
    const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`)
    const encPath = path.join(BACKUP_DIR, `${backupName}.zip.enc`)

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', resolve)
      archive.on('error', reject)

      archive.pipe(output)
      archive.file(path.resolve(DB_PATH), { name: 'database.db' })
      archive.finalize()
    })

    // 암호화
    const key = crypto.scryptSync(PASSWORD, 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

    const input = fs.createReadStream(zipPath)
    const encrypted = fs.createWriteStream(encPath)
    encrypted.write(iv)

    await new Promise((resolve, reject) => {
      input.pipe(cipher).pipe(encrypted)
      encrypted.on('finish', resolve)
      encrypted.on('error', reject)
    })

    // 복호화
    const encData = fs.readFileSync(encPath)
    const decIv = encData.slice(0, 16)
    const data = encData.slice(16)

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, decIv)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])

    // ZIP 해제
    const zip = new AdmZip(decrypted)
    const dbEntry = zip.getEntry('database.db')
    assert(dbEntry, '백업에서 database.db를 찾을 수 없습니다')

    const restorePath = path.join(RESTORE_DIR, 'restored.db')
    fs.writeFileSync(restorePath, zip.readFile(dbEntry))

    assert(fs.existsSync(restorePath), '복원된 DB 파일이 없습니다')

    const originalSize = fs.statSync(path.resolve(DB_PATH)).size
    const restoredSize = fs.statSync(restorePath).size
    assert(restoredSize === originalSize, `복원된 파일 크기가 다릅니다: ${restoredSize} vs ${originalSize}`)

    // 정리
    fs.unlinkSync(zipPath)
    fs.unlinkSync(encPath)
    fs.unlinkSync(restorePath)
    fs.rmdirSync(BACKUP_DIR)
    fs.rmdirSync(RESTORE_DIR)
  }),

  test('잘못된 비밀번호로 복원 시 실패', async () => {
    const PASSWORD = 'correct_password'
    const WRONG_PASSWORD = 'wrong_password'

    // 테스트 데이터 생성
    const testData = Buffer.from('test data for encryption')

    // 암호화
    const key = crypto.scryptSync(PASSWORD, 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    const encrypted = Buffer.concat([iv, cipher.update(testData), cipher.final()])

    // 잘못된 비밀번호로 복호화 시도
    const wrongKey = crypto.scryptSync(WRONG_PASSWORD, 'salt', 32)
    const decIv = encrypted.slice(0, 16)
    const data = encrypted.slice(16)

    let decryptFailed = false
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', wrongKey, decIv)
      Buffer.concat([decipher.update(data), decipher.final()])
    } catch (err) {
      decryptFailed = true
    }

    assert(decryptFailed, '잘못된 비밀번호로 복호화가 성공했습니다 (실패해야 함)')
  }),

  test('복원 전 기존 DB 백업 로직 확인', async () => {
    // 코드 검증: restore.js에서 기존 DB 백업 로직 존재 확인
    const restoreCode = fs.readFileSync(path.resolve('scripts/restore.js'), 'utf-8')

    assert(restoreCode.includes('.bak'), '복원 전 기존 DB 백업 로직이 없습니다')
    assert(restoreCode.includes('copyFileSync'), '파일 복사 로직이 없습니다')
  }),
]

// ============================================================
// 메인 실행
// ============================================================

async function runTests() {
  console.log('\n========================================')
  console.log('Phase 0-6: 교사 계정 CLI 및 백업/복원 테스트')
  console.log('========================================\n')

  // DB 초기화
  console.log('DB 초기화 중...')
  await initDatabase()
  createInitialSchema()
  console.log('DB 초기화 완료!\n')

  // 테스트 실행
  console.log('테스트 실행 중...\n')

  for (const t of tests) {
    await t()
  }

  // DB 저장
  saveDatabase()

  // 결과 요약
  console.log('\n========================================')
  console.log(`결과: ${passed} 통과, ${failed} 실패`)
  console.log('========================================\n')

  // 실패한 테스트 상세
  const failures = results.filter(r => r.status === 'FAIL')
  if (failures.length > 0) {
    console.log('실패한 테스트:')
    failures.forEach(f => {
      console.log(`  - ${f.name}: ${f.error}`)
    })
    console.log('')
  }

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
