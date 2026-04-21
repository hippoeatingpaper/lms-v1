// server/db.js
// sql.js 래퍼 — 디바운스/즉시 저장, 자동 백업, 크래시 핸들러

import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// __dirname 설정 (ESM 환경)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 프로젝트 루트 기준 경로 설정
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DB_PATH = process.env.DB_PATH || path.join(PROJECT_ROOT, 'data', 'database.db')
const BACKUP_DIR = path.join(PROJECT_ROOT, 'data', 'backups')
const BACKUP_INTERVAL = 5 * 60 * 1000  // 5분
const MAX_BACKUPS = 3
const DEBOUNCE_DELAY = 2000  // 2초

// 모듈 상태
let sqlite = null
let saveTimer = null

// ============================================================
// 초기화
// ============================================================

/**
 * DB 초기화 (서버 시작 시 1회 호출)
 * @returns {Promise<Database>} sql.js Database 인스턴스
 */
export async function initDatabase() {
  const SQL = await initSqlJs()
  const dbPath = path.resolve(DB_PATH)

  // DB 디렉터리 확인/생성
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    sqlite = new SQL.Database(fileBuffer)
    console.log(`[DB] 기존 DB 로드: ${dbPath}`)
  } else {
    sqlite = new SQL.Database()
    console.log(`[DB] 새 DB 생성: ${dbPath}`)
  }

  return sqlite
}

// ============================================================
// 저장 함수
// ============================================================

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
 * @param {number} delayMs - 지연 시간 (기본 2초)
 */
export function debouncedSave(delayMs = DEBOUNCE_DELAY) {
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
  console.log(`[DB] 즉시 저장 완료: ${operation}`)
}

/**
 * 중요 작업용 트랜잭션 + 즉시 저장 래퍼
 * 데이터 유실이 허용되지 않는 작업에 사용합니다.
 * @param {string} operation - 작업 식별자
 * @param {Function} fn - 트랜잭션 내에서 실행할 함수
 * @returns {*} fn의 반환값
 */
export function criticalTransaction(operation, fn) {
  const result = db.transaction(fn)
  saveImmediate(operation)
  return result
}

// ============================================================
// 자동 백업 시스템
// ============================================================

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
      console.log(`[BACKUP] 자동 백업 완료: ${backupPath}`)

      // 오래된 백업 정리 (최근 N개만 유지)
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
        .sort()
        .reverse()

      for (const old of backups.slice(MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, old))
        console.log(`[BACKUP] 오래된 백업 삭제: ${old}`)
      }
    } catch (err) {
      console.error('[BACKUP] 자동 백업 실패:', err.message)
    }
  }, BACKUP_INTERVAL)

  console.log(`[BACKUP] 자동 백업 활성화 (${BACKUP_INTERVAL / 60000}분 간격)`)
}

// ============================================================
// 크래시 핸들러
// ============================================================

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

  console.log('[DB] 크래시 핸들러 등록 완료')
}

// ============================================================
// sql.js 래퍼
// ============================================================

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
    console.log('[DB] 데이터베이스 연결 종료')
  },
}

export default db
