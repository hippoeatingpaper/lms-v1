// scripts/restoreMigration.js
// 백업에서 DB 복원 CLI

import fs from 'fs'
import path from 'path'

const backupPath = process.argv[2]
const DB_PATH = process.env.DB_PATH || './data/database.db'

if (!backupPath) {
  console.log('')
  console.log('사용법: npm run migrate:restore <백업파일경로>')
  console.log('')
  console.log('예시:')
  console.log('  npm run migrate:restore ./data/migration-backups/pre-v1_2024-01-15T10-30-00.db')
  console.log('')
  console.log('백업 파일 위치:')
  console.log('  - 마이그레이션 백업: ./data/migration-backups/')
  console.log('  - 자동 백업: ./data/backups/')
  console.log('')
  process.exit(1)
}

const resolvedBackupPath = path.resolve(backupPath)
const resolvedDbPath = path.resolve(DB_PATH)

if (!fs.existsSync(resolvedBackupPath)) {
  console.error('')
  console.error(`[ERROR] 백업 파일을 찾을 수 없습니다: ${resolvedBackupPath}`)
  console.error('')

  // 사용 가능한 백업 목록 출력
  const migrationBackupDir = './data/migration-backups'
  const autoBackupDir = './data/backups'

  if (fs.existsSync(migrationBackupDir)) {
    const files = fs.readdirSync(migrationBackupDir).filter(f => f.endsWith('.db'))
    if (files.length > 0) {
      console.log('[마이그레이션 백업 파일]')
      for (const file of files.sort().reverse()) {
        console.log(`  ${path.join(migrationBackupDir, file)}`)
      }
      console.log('')
    }
  }

  if (fs.existsSync(autoBackupDir)) {
    const files = fs.readdirSync(autoBackupDir).filter(f => f.endsWith('.db'))
    if (files.length > 0) {
      console.log('[자동 백업 파일]')
      for (const file of files.sort().reverse()) {
        console.log(`  ${path.join(autoBackupDir, file)}`)
      }
      console.log('')
    }
  }

  process.exit(1)
}

try {
  // 현재 DB 백업 (복원 전)
  if (fs.existsSync(resolvedDbPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const preRestoreBackup = resolvedDbPath.replace('.db', `_pre-restore_${timestamp}.db`)
    fs.copyFileSync(resolvedDbPath, preRestoreBackup)
    console.log(`[BACKUP] 복원 전 현재 DB 백업: ${preRestoreBackup}`)
  }

  // 복원 실행
  fs.copyFileSync(resolvedBackupPath, resolvedDbPath)

  console.log('')
  console.log('='.repeat(50))
  console.log('복원 완료')
  console.log('='.repeat(50))
  console.log(`  백업 파일: ${resolvedBackupPath}`)
  console.log(`  대상 DB: ${resolvedDbPath}`)
  console.log('='.repeat(50))
  console.log('')

  process.exit(0)
} catch (err) {
  console.error('[ERROR] 복원 실패:', err.message)
  process.exit(1)
}
