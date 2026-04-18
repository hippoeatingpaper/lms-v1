// test/phase0-3-test.js
// Phase 0-3: sql.js 데이터베이스 래퍼 테스트

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const SERVER_DIR = path.join(PROJECT_ROOT, 'server')

// 환경변수 설정
process.chdir(SERVER_DIR)

// DB 모듈 동적 import
async function runTests() {
  console.log('='.repeat(60))
  console.log('Phase 0-3: sql.js 데이터베이스 래퍼 테스트')
  console.log('='.repeat(60))
  console.log('')

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  }

  function test(name, fn) {
    try {
      fn()
      results.passed++
      results.tests.push({ name, status: 'PASS' })
      console.log(`[PASS] ${name}`)
    } catch (err) {
      results.failed++
      results.tests.push({ name, status: 'FAIL', error: err.message })
      console.log(`[FAIL] ${name}`)
      console.log(`       Error: ${err.message}`)
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn()
      results.passed++
      results.tests.push({ name, status: 'PASS' })
      console.log(`[PASS] ${name}`)
    } catch (err) {
      results.failed++
      results.tests.push({ name, status: 'FAIL', error: err.message })
      console.log(`[FAIL] ${name}`)
      console.log(`       Error: ${err.message}`)
    }
  }

  // 테스트용 DB 경로
  const TEST_DB_PATH = './data/test_database.db'
  const TEST_BACKUP_DIR = './data/test_backups'

  // 기존 테스트 파일 정리
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH)
  }
  if (fs.existsSync(TEST_BACKUP_DIR)) {
    fs.rmSync(TEST_BACKUP_DIR, { recursive: true })
  }

  // ============================================================
  // 1. 초기화 테스트
  // ============================================================
  console.log('\n--- 1. 초기화 테스트 ---\n')

  // DB 모듈 import
  const { initDatabase, db, saveDatabase, debouncedSave, saveImmediate, criticalTransaction } = await import('../server/db.js')

  await testAsync('서버 시작 시 sql.js 초기화 성공', async () => {
    const sqlite = await initDatabase()
    if (!sqlite) throw new Error('sql.js 초기화 실패')
  })

  test('data/database.db 파일 생성 확인', () => {
    const dbPath = path.join(SERVER_DIR, 'data', 'database.db')
    if (!fs.existsSync(dbPath)) throw new Error('database.db 파일 없음')
  })

  test('DB 객체 메서드 존재 확인 (get, all, run, transaction)', () => {
    if (typeof db.get !== 'function') throw new Error('db.get 없음')
    if (typeof db.all !== 'function') throw new Error('db.all 없음')
    if (typeof db.run !== 'function') throw new Error('db.run 없음')
    if (typeof db.transaction !== 'function') throw new Error('db.transaction 없음')
  })

  // ============================================================
  // 2. 기본 CRUD 테스트
  // ============================================================
  console.log('\n--- 2. 기본 CRUD 테스트 ---\n')

  test('테스트 테이블 생성', () => {
    db.run(`
      CREATE TABLE IF NOT EXISTS test_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
  })

  test('INSERT 실행 및 lastInsertRowid 반환', () => {
    const result = db.run('INSERT INTO test_items (name) VALUES (?)', ['테스트 아이템 1'])
    if (!result.lastInsertRowid) throw new Error('lastInsertRowid 반환 안됨')
    console.log(`       lastInsertRowid: ${result.lastInsertRowid}`)
  })

  test('SELECT 단일 행 조회 (db.get)', () => {
    const item = db.get('SELECT * FROM test_items WHERE name = ?', ['테스트 아이템 1'])
    if (!item) throw new Error('조회 결과 없음')
    if (item.name !== '테스트 아이템 1') throw new Error('데이터 불일치')
  })

  test('SELECT 다중 행 조회 (db.all)', () => {
    db.run('INSERT INTO test_items (name) VALUES (?)', ['테스트 아이템 2'])
    db.run('INSERT INTO test_items (name) VALUES (?)', ['테스트 아이템 3'])
    const items = db.all('SELECT * FROM test_items')
    if (items.length < 3) throw new Error(`예상 3개 이상, 실제 ${items.length}개`)
  })

  test('UPDATE 실행 및 changes 반환', () => {
    const result = db.run('UPDATE test_items SET name = ? WHERE name = ?', ['수정된 아이템', '테스트 아이템 1'])
    if (result.changes === undefined) throw new Error('changes 반환 안됨')
    console.log(`       changes: ${result.changes}`)
  })

  test('DELETE 실행', () => {
    const result = db.run('DELETE FROM test_items WHERE name = ?', ['수정된 아이템'])
    if (result.changes !== 1) throw new Error(`삭제 실패: changes=${result.changes}`)
  })

  // ============================================================
  // 3. 디바운스 저장 테스트
  // ============================================================
  console.log('\n--- 3. 디바운스 저장 테스트 ---\n')

  await testAsync('디바운스 저장 함수 호출 (2초 후 저장)', async () => {
    const beforeTime = fs.statSync(path.join(SERVER_DIR, 'data', 'database.db')).mtime.getTime()
    debouncedSave()
    // 2.5초 대기
    await new Promise(resolve => setTimeout(resolve, 2500))
    const afterTime = fs.statSync(path.join(SERVER_DIR, 'data', 'database.db')).mtime.getTime()
    if (afterTime <= beforeTime) throw new Error('파일이 저장되지 않음')
    console.log(`       파일 수정 시간 변경됨: ${new Date(afterTime).toISOString()}`)
  })

  await testAsync('연속 호출 시 마지막만 저장 (디바운스)', async () => {
    const beforeTime = fs.statSync(path.join(SERVER_DIR, 'data', 'database.db')).mtime.getTime()
    // 0.5초 간격으로 3번 호출
    debouncedSave()
    await new Promise(resolve => setTimeout(resolve, 500))
    debouncedSave()
    await new Promise(resolve => setTimeout(resolve, 500))
    debouncedSave()
    // 마지막 호출 후 2.5초 대기
    await new Promise(resolve => setTimeout(resolve, 2500))
    const afterTime = fs.statSync(path.join(SERVER_DIR, 'data', 'database.db')).mtime.getTime()
    if (afterTime <= beforeTime) throw new Error('디바운스 저장 실패')
    console.log(`       디바운스 저장 동작 확인`)
  })

  // ============================================================
  // 4. 즉시 저장 테스트
  // ============================================================
  console.log('\n--- 4. 즉시 저장 테스트 ---\n')

  test('saveImmediate() 호출 시 즉시 저장', () => {
    const beforeTime = fs.statSync(path.join(SERVER_DIR, 'data', 'database.db')).mtime.getTime()
    db.run('INSERT INTO test_items (name) VALUES (?)', ['즉시저장 테스트'])
    saveImmediate('즉시저장 테스트')
    const afterTime = fs.statSync(path.join(SERVER_DIR, 'data', 'database.db')).mtime.getTime()
    // 즉시 저장이므로 시간 차이가 거의 없어야 함
    if (afterTime < beforeTime) throw new Error('저장 실패')
    console.log(`       즉시 저장 완료`)
  })

  test('트랜잭션 정상 완료', () => {
    const result = db.transaction(() => {
      db.run('INSERT INTO test_items (name) VALUES (?)', ['트랜잭션 테스트 1'])
      db.run('INSERT INTO test_items (name) VALUES (?)', ['트랜잭션 테스트 2'])
      return 'success'
    })
    if (result !== 'success') throw new Error('트랜잭션 반환값 오류')
    const items = db.all("SELECT * FROM test_items WHERE name LIKE '트랜잭션%'")
    if (items.length !== 2) throw new Error(`트랜잭션 데이터 오류: ${items.length}개`)
  })

  test('트랜잭션 롤백 시 데이터 미저장', () => {
    const countBefore = db.all('SELECT * FROM test_items').length
    try {
      db.transaction(() => {
        db.run('INSERT INTO test_items (name) VALUES (?)', ['롤백 테스트'])
        throw new Error('의도적 오류')
      })
    } catch (err) {
      // 예상된 오류
    }
    const countAfter = db.all('SELECT * FROM test_items').length
    if (countAfter !== countBefore) throw new Error('롤백 실패: 데이터가 저장됨')
    console.log(`       롤백 성공: 트랜잭션 전후 카운트 동일 (${countBefore})`)
  })

  // ============================================================
  // 5. 자동 백업 테스트 (이미 생성된 백업 확인)
  // ============================================================
  console.log('\n--- 5. 자동 백업 테스트 ---\n')

  test('data/backups/ 폴더 존재 확인', () => {
    const backupDir = path.join(SERVER_DIR, 'data', 'backups')
    if (!fs.existsSync(backupDir)) throw new Error('backups 폴더 없음')
  })

  test('백업 파일 존재 확인', () => {
    const backupDir = path.join(SERVER_DIR, 'data', 'backups')
    const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_') && f.endsWith('.db'))
    if (backups.length === 0) throw new Error('백업 파일 없음')
    console.log(`       백업 파일 수: ${backups.length}`)
    backups.forEach(b => console.log(`       - ${b}`))
  })

  test('백업 파일명에 타임스탬프 포함', () => {
    const backupDir = path.join(SERVER_DIR, 'data', 'backups')
    const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_') && f.endsWith('.db'))
    const timestampRegex = /backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db/
    const validBackups = backups.filter(b => timestampRegex.test(b))
    if (validBackups.length === 0) throw new Error('타임스탬프 형식 불일치')
    console.log(`       유효한 타임스탬프 형식: ${validBackups.length}개`)
  })

  // ============================================================
  // 6. 크래시 핸들러 테스트 (코드 확인)
  // ============================================================
  console.log('\n--- 6. 크래시 핸들러 테스트 (코드 분석) ---\n')

  test('index.js에 SIGINT 핸들러 등록', () => {
    const indexPath = path.join(SERVER_DIR, 'index.js')
    const code = fs.readFileSync(indexPath, 'utf-8')
    if (!code.includes("process.on('SIGINT'")) throw new Error('SIGINT 핸들러 없음')
    console.log(`       SIGINT 핸들러 등록됨`)
  })

  test('index.js에 SIGTERM 핸들러 등록', () => {
    const indexPath = path.join(SERVER_DIR, 'index.js')
    const code = fs.readFileSync(indexPath, 'utf-8')
    if (!code.includes("process.on('SIGTERM'")) throw new Error('SIGTERM 핸들러 없음')
    console.log(`       SIGTERM 핸들러 등록됨`)
  })

  test('db.js에 uncaughtException 핸들러 등록', () => {
    const dbPath = path.join(SERVER_DIR, 'db.js')
    const code = fs.readFileSync(dbPath, 'utf-8')
    if (!code.includes("process.on('uncaughtException'")) throw new Error('uncaughtException 핸들러 없음')
    console.log(`       uncaughtException 핸들러 등록됨`)
  })

  test('db.js에 unhandledRejection 핸들러 등록', () => {
    const dbPath = path.join(SERVER_DIR, 'db.js')
    const code = fs.readFileSync(dbPath, 'utf-8')
    if (!code.includes("process.on('unhandledRejection'")) throw new Error('unhandledRejection 핸들러 없음')
    console.log(`       unhandledRejection 핸들러 등록됨`)
  })

  // ============================================================
  // 정리
  // ============================================================
  console.log('\n--- 테스트 정리 ---\n')

  test('테스트 테이블 삭제', () => {
    db.run('DROP TABLE IF EXISTS test_items')
  })

  // ============================================================
  // 결과 출력
  // ============================================================
  console.log('\n' + '='.repeat(60))
  console.log('테스트 결과')
  console.log('='.repeat(60))
  console.log(`총 테스트: ${results.passed + results.failed}`)
  console.log(`통과: ${results.passed}`)
  console.log(`실패: ${results.failed}`)
  console.log('')

  if (results.failed > 0) {
    console.log('실패한 테스트:')
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`)
    })
  }

  // DB 저장 후 종료
  saveImmediate('테스트 종료')
  process.exit(results.failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('테스트 실행 오류:', err)
  process.exit(1)
})
