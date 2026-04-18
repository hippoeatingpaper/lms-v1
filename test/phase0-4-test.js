// test/phase0-4-test.js
// Phase 0-4: 초기 스키마 + 마이그레이션 테스트

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const SERVER_DIR = path.join(PROJECT_ROOT, 'server')

// 환경변수 설정
process.chdir(SERVER_DIR)

async function runTests() {
  console.log('='.repeat(60))
  console.log('Phase 0-4: 초기 스키마 + 마이그레이션 테스트')
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

  // ============================================================
  // 1. DB 및 스키마 모듈 로드
  // ============================================================
  console.log('\n--- 1. 초기화 ---\n')

  const { initDatabase, db, saveImmediate } = await import('../server/db.js')
  const { createInitialSchema } = await import('../server/migrations/schema.js')
  const { runMigrations, getMigrationStatus, rollbackTo } = await import('../server/migrations/index.js')

  await testAsync('DB 초기화', async () => {
    await initDatabase()
  })

  test('초기 스키마 생성 함수 호출', () => {
    createInitialSchema()
  })

  test('마이그레이션 실행', () => {
    runMigrations()
  })

  // ============================================================
  // 2. 초기 스키마 테스트 - 필수 테이블
  // ============================================================
  console.log('\n--- 2. 초기 스키마 테스트 ---\n')

  const requiredTables = [
    'users',
    'classes',
    'teams',
    'posts',
    'assignments',
    'submissions',
    'files',
    'notifications',
    '_migrations'  // 마이그레이션 테이블
  ]

  for (const table of requiredTables) {
    test(`'${table}' 테이블 존재 확인`, () => {
      const result = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [table]
      )
      if (!result) throw new Error(`테이블 '${table}' 없음`)
    })
  }

  // 추가 테이블 확인
  const additionalTables = [
    'refresh_tokens',
    'comments',
    'likes',
    'assignment_questions',
    'submission_answers',
    'documents',
    'notification_reads'
  ]

  for (const table of additionalTables) {
    test(`'${table}' 테이블 존재 확인`, () => {
      const result = db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [table]
      )
      if (!result) throw new Error(`테이블 '${table}' 없음`)
    })
  }

  // ============================================================
  // 3. 테이블 스키마 검증
  // ============================================================
  console.log('\n--- 3. 테이블 스키마 검증 ---\n')

  test('users 테이블 컬럼 확인', () => {
    const columns = db.all("PRAGMA table_info(users)")
    const columnNames = columns.map(c => c.name)
    const required = ['id', 'name', 'username', 'password_hash', 'role', 'class_id', 'team_id']
    for (const col of required) {
      if (!columnNames.includes(col)) {
        throw new Error(`users 테이블에 '${col}' 컬럼 없음`)
      }
    }
    console.log(`       컬럼: ${columnNames.join(', ')}`)
  })

  test('classes 테이블 컬럼 확인', () => {
    const columns = db.all("PRAGMA table_info(classes)")
    const columnNames = columns.map(c => c.name)
    const required = ['id', 'name', 'created_at']
    for (const col of required) {
      if (!columnNames.includes(col)) {
        throw new Error(`classes 테이블에 '${col}' 컬럼 없음`)
      }
    }
    console.log(`       컬럼: ${columnNames.join(', ')}`)
  })

  test('assignments 테이블 컬럼 확인', () => {
    const columns = db.all("PRAGMA table_info(assignments)")
    const columnNames = columns.map(c => c.name)
    const required = ['id', 'title', 'description', 'scope', 'class_id', 'due_at', 'author_id']
    for (const col of required) {
      if (!columnNames.includes(col)) {
        throw new Error(`assignments 테이블에 '${col}' 컬럼 없음`)
      }
    }
    console.log(`       컬럼: ${columnNames.join(', ')}`)
  })

  test('submissions 테이블 컬럼 확인', () => {
    const columns = db.all("PRAGMA table_info(submissions)")
    const columnNames = columns.map(c => c.name)
    const required = ['id', 'assignment_id', 'submitter_id', 'team_id', 'status', 'feedback']
    for (const col of required) {
      if (!columnNames.includes(col)) {
        throw new Error(`submissions 테이블에 '${col}' 컬럼 없음`)
      }
    }
    console.log(`       컬럼: ${columnNames.join(', ')}`)
  })

  // ============================================================
  // 4. 인덱스 확인
  // ============================================================
  console.log('\n--- 4. 인덱스 확인 ---\n')

  test('인덱스 생성 확인', () => {
    const indexes = db.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
    if (indexes.length === 0) {
      throw new Error('인덱스가 생성되지 않음')
    }
    console.log(`       인덱스 수: ${indexes.length}`)
    indexes.forEach(idx => console.log(`       - ${idx.name}`))
  })

  // ============================================================
  // 5. 마이그레이션 시스템 테스트
  // ============================================================
  console.log('\n--- 5. 마이그레이션 시스템 테스트 ---\n')

  test('_migrations 테이블 구조 확인', () => {
    const columns = db.all("PRAGMA table_info(_migrations)")
    const columnNames = columns.map(c => c.name)
    const required = ['version', 'applied_at', 'backup_path']
    for (const col of required) {
      if (!columnNames.includes(col)) {
        throw new Error(`_migrations 테이블에 '${col}' 컬럼 없음`)
      }
    }
    console.log(`       컬럼: ${columnNames.join(', ')}`)
  })

  test('getMigrationStatus() 함수 동작', () => {
    const status = getMigrationStatus()
    if (!status || typeof status.applied === 'undefined' || typeof status.pending === 'undefined') {
      throw new Error('getMigrationStatus() 반환값 오류')
    }
    console.log(`       적용됨: ${status.applied.length}개`)
    console.log(`       대기중: ${status.pending.length}개`)
  })

  // ============================================================
  // 6. 스크립트 파일 존재 확인
  // ============================================================
  console.log('\n--- 6. 스크립트 파일 확인 ---\n')

  const scripts = [
    { path: 'scripts/migrationStatus.js', desc: 'migrate:status 스크립트' },
    { path: 'scripts/rollbackMigration.js', desc: 'migrate:rollback 스크립트' },
    { path: 'scripts/restoreMigration.js', desc: 'migrate:restore 스크립트' },
  ]

  for (const script of scripts) {
    test(`${script.desc} 존재 확인`, () => {
      const scriptPath = path.join(PROJECT_ROOT, script.path)
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`${script.path} 없음`)
      }
    })
  }

  // ============================================================
  // 7. package.json 스크립트 확인
  // ============================================================
  console.log('\n--- 7. npm 스크립트 확인 ---\n')

  test('package.json migrate:status 스크립트', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'))
    if (!pkg.scripts['migrate:status']) {
      throw new Error('migrate:status 스크립트 없음')
    }
    console.log(`       ${pkg.scripts['migrate:status']}`)
  })

  test('package.json migrate:rollback 스크립트', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'))
    if (!pkg.scripts['migrate:rollback']) {
      throw new Error('migrate:rollback 스크립트 없음')
    }
    console.log(`       ${pkg.scripts['migrate:rollback']}`)
  })

  test('package.json migrate:restore 스크립트', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'))
    if (!pkg.scripts['migrate:restore']) {
      throw new Error('migrate:restore 스크립트 없음')
    }
    console.log(`       ${pkg.scripts['migrate:restore']}`)
  })

  // ============================================================
  // 8. 코드 구조 확인
  // ============================================================
  console.log('\n--- 8. 코드 구조 확인 ---\n')

  test('server/index.js에서 createInitialSchema 호출', () => {
    const indexCode = fs.readFileSync(path.join(SERVER_DIR, 'index.js'), 'utf-8')
    if (!indexCode.includes('createInitialSchema')) {
      throw new Error('createInitialSchema 호출 없음')
    }
  })

  test('server/index.js에서 runMigrations 호출', () => {
    const indexCode = fs.readFileSync(path.join(SERVER_DIR, 'index.js'), 'utf-8')
    if (!indexCode.includes('runMigrations')) {
      throw new Error('runMigrations 호출 없음')
    }
  })

  test('rollbackTo 함수 존재', () => {
    if (typeof rollbackTo !== 'function') {
      throw new Error('rollbackTo 함수 없음')
    }
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
