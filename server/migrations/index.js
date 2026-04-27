// server/migrations/index.js
// Up/Down + 자동 백업 지원 마이그레이션 시스템

import { db, saveDatabase } from '../db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '../..')

const BACKUP_DIR = path.join(PROJECT_ROOT, 'data', 'migration-backups')
const DB_PATH = process.env.DB_PATH || path.join(PROJECT_ROOT, 'data', 'database.db')

/**
 * 마이그레이션 정의
 * - version: 고유 버전 번호 (순차 증가)
 * - description: 변경 내용 설명
 * - up: 적용할 SQL 문
 * - down: 롤백할 SQL 문 (선택, 없으면 롤백 불가)
 *
 * 예시:
 * {
 *   version: 1,
 *   description: 'Add grade column to submissions',
 *   up: `ALTER TABLE submissions ADD COLUMN grade INTEGER DEFAULT NULL`,
 *   down: `ALTER TABLE submissions DROP COLUMN grade`,
 * }
 */
const migrations = [
  // 마이그레이션은 여기에 추가
  {
    version: 1,
    description: 'Add allow_multiple column to assignment_questions',
    up: `ALTER TABLE assignment_questions ADD COLUMN allow_multiple BOOLEAN DEFAULT 0`,
    down: null, // SQLite doesn't support DROP COLUMN easily
  },
]

/**
 * 마이그레이션 전 자동 백업
 * @param {number} version - 마이그레이션 버전
 * @returns {string} 백업 파일 경로
 */
function backupBeforeMigration(version) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, `pre-v${version}_${timestamp}.db`)

  saveDatabase()
  fs.copyFileSync(path.resolve(DB_PATH), backupPath)

  console.log(`[MIGRATION] 백업 생성: ${backupPath}`)
  return backupPath
}

/**
 * 마이그레이션 실행 — 서버 시작 시 initDatabase() 직후 호출
 */
export function runMigrations() {
  // 마이그레이션 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now')),
      backup_path TEXT
    )
  `)

  const applied = db.all('SELECT version FROM _migrations')
  const appliedVersions = new Set(applied.map(r => r.version))

  let migrationsRan = 0

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue

    console.log(`[MIGRATION] v${migration.version}: ${migration.description}`)

    // 마이그레이션 전 백업
    const backupPath = backupBeforeMigration(migration.version)

    try {
      // 세미콜론으로 구분된 여러 SQL 문 처리
      const statements = migration.up.split(';').filter(s => s.trim())
      for (const stmt of statements) {
        db.run(stmt)
      }

      db.run(
        'INSERT INTO _migrations (version, backup_path) VALUES (?, ?)',
        [migration.version, backupPath]
      )
      migrationsRan++

    } catch (err) {
      console.error(`[MIGRATION] v${migration.version} 실패:`, err.message)
      console.error(`[MIGRATION] 백업 파일로 복구하세요: ${backupPath}`)
      console.error(`[MIGRATION] 복구 명령: npm run migrate:restore ${backupPath}`)
      throw err
    }
  }

  if (migrationsRan > 0) {
    saveDatabase()
    console.log(`[MIGRATION] ${migrationsRan}개 마이그레이션 적용 완료`)
  } else if (migrations.length > 0) {
    console.log('[MIGRATION] 적용할 새 마이그레이션 없음')
  }
}

/**
 * 특정 버전으로 롤백
 * @param {number} targetVersion - 이 버전까지 유지, 이후 버전 롤백
 */
export function rollbackTo(targetVersion) {
  const applied = db.all(
    'SELECT version FROM _migrations WHERE version > ? ORDER BY version DESC',
    [targetVersion]
  )

  if (applied.length === 0) {
    console.log('[MIGRATION] 롤백할 마이그레이션이 없습니다.')
    return
  }

  for (const row of applied) {
    const migration = migrations.find(m => m.version === row.version)

    if (!migration?.down) {
      console.error(`[MIGRATION] v${row.version}은 down 마이그레이션이 없습니다.`)
      throw new Error(`Cannot rollback v${row.version}: no down migration`)
    }

    console.log(`[MIGRATION] 롤백 v${row.version}: ${migration.description}`)

    const statements = migration.down.split(';').filter(s => s.trim())
    for (const stmt of statements) {
      db.run(stmt)
    }

    db.run('DELETE FROM _migrations WHERE version = ?', [row.version])
  }

  saveDatabase()
  console.log(`[MIGRATION] v${targetVersion}까지 롤백 완료`)
}

/**
 * 마이그레이션 상태 조회
 * @returns {{ applied: Array, pending: Array }}
 */
export function getMigrationStatus() {
  // _migrations 테이블이 없을 수 있음
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now')),
        backup_path TEXT
      )
    `)
  } catch (err) {
    // 이미 존재하면 무시
  }

  const applied = db.all('SELECT version, applied_at, backup_path FROM _migrations ORDER BY version')
  const pending = migrations.filter(m => !applied.some(a => a.version === m.version))

  return {
    applied: applied.map(row => ({
      ...row,
      description: migrations.find(m => m.version === row.version)?.description || '(알 수 없음)',
      hasDown: !!migrations.find(m => m.version === row.version)?.down,
    })),
    pending: pending.map(m => ({
      version: m.version,
      description: m.description,
      hasDown: !!m.down,
    })),
  }
}

export { migrations }
