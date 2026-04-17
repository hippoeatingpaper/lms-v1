# 데이터베이스 스펙 (sql.js 래퍼 및 저장 전략)

> sql.js 기반 SQLite 래퍼, 디바운스/즉시 저장, 자동 백업, 마이그레이션 시스템

## 개요

본 프로젝트는 `sql.js`를 사용합니다:
- WebAssembly 기반 SQLite (순수 JavaScript)
- Windows 빌드 도구 불필요 (`npm install`만으로 설치)
- 초기화만 비동기, 이후 쿼리는 동기
- **메모리 기반이므로 주기적으로 디스크에 저장 필요**

## 저장 전략

| 작업 유형 | 저장 방식 | 함수 | 예시 |
|-----------|-----------|------|------|
| 댓글 작성 | 디바운스 (2초) | `db.run()` | 2초 내 유실 허용 |
| 좋아요 | 디바운스 (2초) | `db.run()` | 2초 내 유실 허용 |
| **과제 제출** | **즉시 저장** | `criticalTransaction()` | 유실 불가 |
| **피드백 작성** | **즉시 저장** | `criticalTransaction()` | 유실 불가 |
| **계정 생성** | **즉시 저장** | `criticalTransaction()` | 유실 불가 |
| **팀 배정** | **즉시 저장** | `criticalTransaction()` | 유실 불가 |
| **파일 업로드** | **즉시 저장** | `saveImmediate()` | 파일-DB 불일치 방지 |

## DB 래퍼 구현

### server/db.js

```js
// server/db.js — sql.js 래퍼
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

const DB_PATH = process.env.DB_PATH || './data/database.db'
const BACKUP_DIR = './data/backups'
const BACKUP_INTERVAL = 5 * 60 * 1000  // 5분
const MAX_BACKUPS = 3

let sqlite = null
let saveTimer = null

/**
 * DB 초기화 (서버 시작 시 1회 호출)
 */
export async function initDatabase() {
  const SQL = await initSqlJs()
  const dbPath = path.resolve(DB_PATH)

  // DB 디렉터리 확인/생성
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    sqlite = new SQL.Database(fileBuffer)
    console.log(`[db] 기존 DB 로드: ${dbPath}`)
  } else {
    sqlite = new SQL.Database()
    console.log(`[db] 새 DB 생성: ${dbPath}`)
  }

  return sqlite
}

/**
 * DB를 디스크에 저장
 */
export function saveDatabase() {
  if (!sqlite) return
  const data = sqlite.export()
  const buffer = Buffer.from(data)
  fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true })
  fs.writeFileSync(path.resolve(DB_PATH), buffer)
}

/**
 * 디바운스 저장 (2초 후 저장, 연속 호출 시 마지막만 실행)
 * 일반적인 읽기/쓰기 작업에 사용
 */
export function debouncedSave(delayMs = 2000) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveDatabase()
    saveTimer = null
  }, delayMs)
}

/**
 * 즉시 저장 — 중요 작업(제출, 피드백, 계정 생성 등)에 사용
 * 디바운스 타이머를 취소하고 즉시 디스크에 저장합니다.
 * @param {string} operation - 작업 식별자 (로깅용)
 */
export function saveImmediate(operation) {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  saveDatabase()
  console.log(`[db] 즉시 저장 완료: ${operation}`)
}

/**
 * 중요 작업용 트랜잭션 + 즉시 저장 래퍼
 * 데이터 유실이 허용되지 않는 작업에 사용합니다.
 * @param {string} operation - 작업 식별자
 * @param {Function} fn - 트랜잭션 내에서 실행할 함수
 */
export function criticalTransaction(operation, fn) {
  const result = db.transaction(fn)
  saveImmediate(operation)
  return result
}

/**
 * sql.js 래퍼
 *
 * 사용 예시:
 *   const user = db.get('SELECT * FROM users WHERE id = ?', [userId])
 *   const users = db.all('SELECT * FROM users WHERE class_id = ?', [classId])
 *   const result = db.run('INSERT INTO users (name) VALUES (?)', [name])
 *   console.log(result.lastInsertRowid)
 */
export const db = {
  /** 단일 행 조회 */
  get: (sql, params = []) => {
    const stmt = sqlite.prepare(sql)
    stmt.bind(params)
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      return row
    }
    stmt.free()
    return undefined
  },

  /** 여러 행 조회 */
  all: (sql, params = []) => {
    const results = []
    const stmt = sqlite.prepare(sql)
    stmt.bind(params)
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  },

  /** INSERT/UPDATE/DELETE 실행 — { changes, lastInsertRowid } 반환 */
  run: (sql, params = []) => {
    sqlite.run(sql, params)
    debouncedSave()  // 변경 시 자동 저장 예약
    return {
      changes: sqlite.getRowsModified(),
      lastInsertRowid: db.get('SELECT last_insert_rowid() as id')?.id,
    }
  },

  /** 트랜잭션 실행 */
  transaction: (fn) => {
    sqlite.run('BEGIN TRANSACTION')
    try {
      const result = fn()
      sqlite.run('COMMIT')
      debouncedSave()
      return result
    } catch (err) {
      sqlite.run('ROLLBACK')
      throw err
    }
  },

  /** DB 저장 후 종료 */
  close: () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveDatabase()  // 남은 저장 즉시 실행
    }
    sqlite.close()
  },
}

export default db
```

## 자동 백업 시스템

### server/db.js (추가)

```js
/**
 * 자동 백업 시작 — 서버 초기화 후 호출
 */
export function startAutoBackup() {
  // 백업 디렉터리 생성
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  setInterval(() => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.db`)

      // 현재 DB 상태 저장 후 백업
      saveDatabase()
      fs.copyFileSync(path.resolve(DB_PATH), backupPath)
      console.log(`[backup] 자동 백업 완료: ${backupPath}`)

      // 오래된 백업 정리 (최근 N개만 유지)
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
        .sort()
        .reverse()

      for (const old of backups.slice(MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, old))
        console.log(`[backup] 오래된 백업 삭제: ${old}`)
      }
    } catch (err) {
      console.error('[backup] 자동 백업 실패:', err.message)
    }
  }, BACKUP_INTERVAL)

  console.log(`[backup] 자동 백업 활성화 (${BACKUP_INTERVAL / 60000}분 간격)`)
}

/**
 * 비정상 종료 대응 — 서버 초기화 시 등록
 */
export function setupCrashHandler() {
  process.on('uncaughtException', (err) => {
    console.error('[FATAL] 처리되지 않은 예외:', err)
    try {
      saveDatabase()  // 최후의 저장 시도
      console.log('[FATAL] 긴급 저장 완료')
    } catch (saveErr) {
      console.error('[FATAL] 긴급 저장 실패:', saveErr.message)
    }
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] 처리되지 않은 Promise 거부:', reason)
    // 저장은 하되 종료하지 않음 (복구 가능한 경우 대비)
    saveDatabase()
  })
}
```

## 마이그레이션 시스템

### server/migrations/index.js

```js
// server/migrations/index.js — Up/Down + 자동 백업 지원
import { db, saveDatabase } from '../db.js'
import fs from 'fs'
import path from 'path'

const BACKUP_DIR = './data/migration-backups'

/**
 * 마이그레이션 정의
 * - version: 고유 버전 번호 (순차 증가)
 * - description: 변경 내용 설명
 * - up: 적용할 SQL 문
 * - down: 롤백할 SQL 문 (선택, 없으면 롤백 불가)
 */
const migrations = [
  // 예시: 컬럼 추가 (롤백 가능)
  // {
  //   version: 1,
  //   description: 'Add grade column to submissions',
  //   up: `ALTER TABLE submissions ADD COLUMN grade INTEGER DEFAULT NULL`,
  //   down: `ALTER TABLE submissions DROP COLUMN grade`,  // SQLite 3.35.0+
  // },
]

/**
 * 마이그레이션 전 자동 백업
 */
function backupBeforeMigration(version) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(BACKUP_DIR, `pre-v${version}_${timestamp}.db`)

  saveDatabase()
  const DB_PATH = process.env.DB_PATH || './data/database.db'
  fs.copyFileSync(path.resolve(DB_PATH), backupPath)

  console.log(`[migration] 백업 생성: ${backupPath}`)
  return backupPath
}

/**
 * 마이그레이션 실행 — 서버 시작 시 initDatabase() 직후 호출
 */
export function runMigrations() {
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

    console.log(`[migration] v${migration.version}: ${migration.description}`)

    // 마이그레이션 전 백업
    const backupPath = backupBeforeMigration(migration.version)

    try {
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
      console.error(`[migration] v${migration.version} 실패:`, err.message)
      console.error(`[migration] 백업 파일로 복구하세요: ${backupPath}`)
      console.error(`[migration] 복구 명령: npm run migrate:restore ${backupPath}`)
      throw err
    }
  }

  if (migrationsRan > 0) {
    saveDatabase()
    console.log(`[migration] ${migrationsRan}개 마이그레이션 적용 완료`)
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
    console.log('[migration] 롤백할 마이그레이션이 없습니다.')
    return
  }

  for (const row of applied) {
    const migration = migrations.find(m => m.version === row.version)

    if (!migration?.down) {
      console.error(`[migration] v${row.version}은 down 마이그레이션이 없습니다.`)
      throw new Error(`Cannot rollback v${row.version}: no down migration`)
    }

    console.log(`[migration] 롤백 v${row.version}: ${migration.description}`)

    const statements = migration.down.split(';').filter(s => s.trim())
    for (const stmt of statements) {
      db.run(stmt)
    }

    db.run('DELETE FROM _migrations WHERE version = ?', [row.version])
  }

  saveDatabase()
  console.log(`[migration] v${targetVersion}까지 롤백 완료`)
}

/**
 * 마이그레이션 상태 조회
 */
export function getMigrationStatus() {
  const applied = db.all('SELECT version, applied_at, backup_path FROM _migrations ORDER BY version')
  const pending = migrations.filter(m => !applied.some(a => a.version === m.version))

  return {
    applied: applied.map(row => ({
      ...row,
      description: migrations.find(m => m.version === row.version)?.description,
      hasDown: !!migrations.find(m => m.version === row.version)?.down,
    })),
    pending: pending.map(m => ({
      version: m.version,
      description: m.description,
      hasDown: !!m.down,
    })),
  }
}
```

## 초기 스키마 생성

### server/migrations/schema.js

```js
// server/migrations/schema.js — 초기 테이블 생성
import { db, saveDatabase } from '../db.js'

/**
 * 초기 스키마 생성 — DB가 비어있을 때 실행
 */
export function createInitialSchema() {
  // 테이블 존재 여부 확인
  const tables = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
  if (tables) {
    console.log('[schema] 기존 스키마 존재, 생략')
    return
  }

  console.log('[schema] 초기 스키마 생성 중...')

  db.run(`
    CREATE TABLE classes (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE teams (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      class_id   INTEGER REFERENCES classes(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL,
      class_id      INTEGER REFERENCES classes(id),
      team_id       INTEGER REFERENCES teams(id),
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE refresh_tokens (
      id         INTEGER PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE posts (
      id         INTEGER PRIMARY KEY,
      title      TEXT NOT NULL,
      content    TEXT,
      type       TEXT NOT NULL,
      author_id  INTEGER REFERENCES users(id),
      class_id   INTEGER REFERENCES classes(id),
      team_id    INTEGER REFERENCES teams(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE assignments (
      id           INTEGER PRIMARY KEY,
      title        TEXT NOT NULL,
      description  TEXT,
      scope        TEXT NOT NULL,
      class_id     INTEGER REFERENCES classes(id),
      due_at       DATETIME,
      author_id    INTEGER REFERENCES users(id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE assignment_questions (
      id             INTEGER PRIMARY KEY,
      assignment_id  INTEGER REFERENCES assignments(id),
      order_num      INTEGER NOT NULL,
      question_type  TEXT NOT NULL,
      body           TEXT NOT NULL,
      options        TEXT,
      required       BOOLEAN DEFAULT 1
    )
  `)

  db.run(`
    CREATE TABLE submissions (
      id               INTEGER PRIMARY KEY,
      assignment_id    INTEGER REFERENCES assignments(id),
      submitter_id     INTEGER REFERENCES users(id),
      team_id          INTEGER REFERENCES teams(id),
      status           TEXT NOT NULL DEFAULT 'draft',
      version          INTEGER DEFAULT 1,
      last_modified_by INTEGER REFERENCES users(id),
      feedback         TEXT,
      is_published     BOOLEAN DEFAULT 0,
      published_post_id INTEGER REFERENCES posts(id),
      submitted_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE submission_answers (
      id             INTEGER PRIMARY KEY,
      submission_id  INTEGER REFERENCES submissions(id),
      question_id    INTEGER REFERENCES assignment_questions(id),
      answer_text    TEXT,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(submission_id, question_id)
    )
  `)

  db.run(`
    CREATE TABLE files (
      id             INTEGER PRIMARY KEY,
      filename       TEXT NOT NULL,
      original_name  TEXT NOT NULL,
      filepath       TEXT NOT NULL,
      mimetype       TEXT NOT NULL,
      size           INTEGER NOT NULL,
      class_id       INTEGER REFERENCES classes(id),
      post_id        INTEGER REFERENCES posts(id),
      submission_id  INTEGER REFERENCES submissions(id),
      question_id    INTEGER REFERENCES assignment_questions(id),
      uploader_id    INTEGER REFERENCES users(id),
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE documents (
      id          INTEGER PRIMARY KEY,
      title       TEXT NOT NULL,
      team_id     INTEGER REFERENCES teams(id),
      class_id    INTEGER REFERENCES classes(id),
      ydoc_state  BLOB,
      version     INTEGER DEFAULT 1,
      created_by  INTEGER REFERENCES users(id),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE comments (
      id         INTEGER PRIMARY KEY,
      body       TEXT NOT NULL,
      post_id    INTEGER REFERENCES posts(id),
      author_id  INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE likes (
      id      INTEGER PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id),
      user_id INTEGER REFERENCES users(id),
      UNIQUE(post_id, user_id)
    )
  `)

  db.run(`
    CREATE TABLE notifications (
      id         INTEGER PRIMARY KEY,
      type       TEXT NOT NULL,
      message    TEXT NOT NULL,
      data       TEXT,
      class_id   INTEGER REFERENCES classes(id),
      target_id  INTEGER REFERENCES users(id),
      sender_id  INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE notification_reads (
      id              INTEGER PRIMARY KEY,
      notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      read_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(notification_id, user_id)
    )
  `)

  // 인덱스 생성
  db.run('CREATE INDEX idx_users_class ON users(class_id)')
  db.run('CREATE INDEX idx_users_team ON users(team_id)')
  db.run('CREATE INDEX idx_posts_class ON posts(class_id)')
  db.run('CREATE INDEX idx_assignments_class ON assignments(class_id)')
  db.run('CREATE INDEX idx_submissions_assignment ON submissions(assignment_id)')
  db.run('CREATE INDEX idx_files_submission ON files(submission_id, question_id)')
  db.run('CREATE INDEX idx_files_class ON files(class_id)')
  db.run('CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)')

  saveDatabase()
  console.log('[schema] 초기 스키마 생성 완료')
}
```

## 서버 초기화 통합

```js
// server/index.js — 초기화 순서
import { initDatabase, startAutoBackup, setupCrashHandler, db } from './db.js'
import { createInitialSchema } from './migrations/schema.js'
import { runMigrations } from './migrations/index.js'

async function start() {
  // 1. DB 초기화 (비동기)
  await initDatabase()

  // 2. 초기 스키마 생성 (DB가 비어있을 때만)
  createInitialSchema()

  // 3. 마이그레이션 실행 (동기)
  runMigrations()

  // 4. 백업 및 크래시 핸들러 설정
  startAutoBackup()
  setupCrashHandler()

  // 5. 서버 시작
  // ... Express 설정 및 listen
}

start()
```

## CLI 스크립트

### 마이그레이션 상태 확인

```bash
npm run migrate:status
```

```js
// scripts/migrationStatus.js
import { initDatabase } from '../server/db.js'
import { getMigrationStatus } from '../server/migrations/index.js'

async function main() {
  await initDatabase()
  const status = getMigrationStatus()
  console.log('\n=== 적용된 마이그레이션 ===')
  console.table(status.applied)
  console.log('\n=== 대기 중인 마이그레이션 ===')
  console.table(status.pending)
}
main()
```

### 마이그레이션 롤백

```bash
npm run migrate:rollback 2   # v3 이후 롤백 (v2까지 유지)
```

```js
// scripts/rollbackMigration.js
import { initDatabase } from '../server/db.js'
import { rollbackTo } from '../server/migrations/index.js'

const targetVersion = parseInt(process.argv[2])
if (isNaN(targetVersion)) {
  console.log('사용법: node scripts/rollbackMigration.js <버전>')
  process.exit(1)
}

async function main() {
  await initDatabase()
  rollbackTo(targetVersion)
}
main()
```

### 백업에서 복원

```bash
npm run migrate:restore ./data/migration-backups/pre-v1_xxx.db
```

```js
// scripts/restoreMigration.js
import fs from 'fs'
const backupPath = process.argv[2]
const DB_PATH = process.env.DB_PATH || './data/database.db'

if (!backupPath || !fs.existsSync(backupPath)) {
  console.log('사용법: node scripts/restoreMigration.js <백업파일경로>')
  process.exit(1)
}

fs.copyFileSync(backupPath, DB_PATH)
console.log(`✅ 복원 완료: ${backupPath} → ${DB_PATH}`)
```

## package.json 스크립트

```json
{
  "scripts": {
    "migrate:status": "node scripts/migrationStatus.js",
    "migrate:rollback": "node scripts/rollbackMigration.js",
    "migrate:restore": "node scripts/restoreMigration.js"
  }
}
```

## 주의사항

1. **sql.js는 메모리 기반**: 서버가 비정상 종료되면 저장되지 않은 데이터 유실 가능
2. **디바운스 저장 (2초)**: 일반 작업은 2초 지연 저장
3. **중요 작업은 즉시 저장**: `criticalTransaction()` 또는 `saveImmediate()` 사용
4. **자동 백업**: 5분마다 백업, 최근 3개 유지
5. **비정상 종료 대응**: `uncaughtException` 시 긴급 저장 시도

## 운영 권장사항

- 노트북은 항상 **전원 어댑터에 연결**하여 갑작스런 전원 차단 방지
- 수업 전후로 **수동 백업** 권장 (`npm run backup`)
- 중요 데이터는 외부 저장소에 추가 백업
