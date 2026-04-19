// test/phase1-2-test.js
// Phase 1-2: 역할/반/팀 검증 미들웨어 테스트

import http from 'http'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config()

const PORT = process.env.PORT || 3000
const HOST = 'localhost'
const JWT_SECRET = process.env.JWT_SECRET

// 테스트 결과 추적
let passed = 0
let failed = 0
const results = []

// 테스트 데이터 저장
let testData = null

// HTTP 요청 헬퍼
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      ...options
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data })
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: null, raw: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

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

// 토큰 생성 헬퍼
function createToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: options.expiresIn || '1h',
    ...options
  })
}

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // ============================================================
  // requireRole 테스트
  // ============================================================
  test('requireRole("teacher") - 교사 접근 허용', async () => {
    const token = createToken({
      id: testData.users.teacherId,
      role: 'teacher',
      class_id: null,
      team_id: null
    })

    const res = await request({
      path: '/api/v1/test-role-teacher',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.message === '교사 전용 접근 성공', `Message mismatch: ${res.body?.message}`)
  }),

  test('requireRole("teacher") - 학생 접근 거부 (403)', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: '/api/v1/test-role-teacher',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('requireRole("student") - 학생 접근 허용', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: '/api/v1/test-role-student',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.message === '학생 전용 접근 성공', `Message mismatch: ${res.body?.message}`)
  }),

  test('requireRole("student") - 교사 접근 거부 (403)', async () => {
    const token = createToken({
      id: testData.users.teacherId,
      role: 'teacher',
      class_id: null,
      team_id: null
    })

    const res = await request({
      path: '/api/v1/test-role-student',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('requireRole("teacher", "student") - 교사 허용', async () => {
    const token = createToken({
      id: testData.users.teacherId,
      role: 'teacher',
      class_id: null,
      team_id: null
    })

    const res = await request({
      path: '/api/v1/test-role-both',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
  }),

  test('requireRole("teacher", "student") - 학생 허용', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: '/api/v1/test-role-both',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
  }),

  test('권한 부족 시 에러 코드 FORBIDDEN 반환', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: '/api/v1/test-role-teacher',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.body?.error?.code === 'FORBIDDEN', `Expected FORBIDDEN, got ${res.body?.error?.code}`)
  }),

  // ============================================================
  // verifyClassAccess 테스트
  // ============================================================
  test('교사 - 모든 반 접근 허용', async () => {
    const token = createToken({
      id: testData.users.teacherId,
      role: 'teacher',
      class_id: null,
      team_id: null
    })

    // 반 1 접근
    const res1 = await request({
      path: `/api/v1/test-class/${testData.classes.classId1}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })
    assert(res1.status === 200, `Expected 200 for class1, got ${res1.status}`)

    // 반 2 접근
    const res2 = await request({
      path: `/api/v1/test-class/${testData.classes.classId2}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })
    assert(res2.status === 200, `Expected 200 for class2, got ${res2.status}`)
  }),

  test('학생 - 자신의 반 접근 허용', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: `/api/v1/test-class/${testData.classes.classId1}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.message === '반 접근 성공', `Message mismatch: ${res.body?.message}`)
  }),

  test('학생 - 다른 반 접근 거부 (403)', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    // 학생1은 classId1 소속, classId2에 접근 시도
    const res = await request({
      path: `/api/v1/test-class/${testData.classes.classId2}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
    assert(res.body?.error?.code === 'FORBIDDEN', `Expected FORBIDDEN, got ${res.body?.error?.code}`)
  }),

  test('URL 파라미터 classId 검증', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: `/api/v1/test-class/${testData.classes.classId1}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.body?.classId === String(testData.classes.classId1),
      `Expected classId ${testData.classes.classId1}, got ${res.body?.classId}`)
  }),

  test('존재하지 않는 반 접근 시 403 반환 (학생)', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: '/api/v1/test-class/99999',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    // 학생이 다른 반에 접근하면 403
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // verifyTeamAccess 테스트
  // ============================================================
  test('교사 - 모든 팀 접근 허용', async () => {
    const token = createToken({
      id: testData.users.teacherId,
      role: 'teacher',
      class_id: null,
      team_id: null
    })

    // 팀 1 접근
    const res1 = await request({
      path: `/api/v1/test-team/${testData.teams.teamId1}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })
    assert(res1.status === 200, `Expected 200 for team1, got ${res1.status}`)

    // 팀 3 접근 (다른 반의 팀)
    const res3 = await request({
      path: `/api/v1/test-team/${testData.teams.teamId3}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })
    assert(res3.status === 200, `Expected 200 for team3, got ${res3.status}`)
  }),

  test('학생 - 자신의 팀 접근 허용', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: `/api/v1/test-team/${testData.teams.teamId1}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.message === '팀 접근 성공', `Message mismatch: ${res.body?.message}`)
  }),

  test('학생 - 다른 팀 접근 거부 (403)', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    // 학생1은 teamId1 소속, teamId2에 접근 시도
    const res = await request({
      path: `/api/v1/test-team/${testData.teams.teamId2}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
    assert(res.body?.error?.code === 'FORBIDDEN', `Expected FORBIDDEN, got ${res.body?.error?.code}`)
  }),

  test('팀에 속하지 않은 학생 접근 거부 (403)', async () => {
    // student4는 팀이 없는 학생
    const token = createToken({
      id: testData.users.student4Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: null
    })

    const res = await request({
      path: `/api/v1/test-team/${testData.teams.teamId1}`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('존재하지 않는 팀 접근 시 403 반환 (학생)', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: '/api/v1/test-team/99999',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 미들웨어 조합 테스트
  // ============================================================
  test('인증 → 반 접근 순서로 검증 (성공)', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    const res = await request({
      path: `/api/v1/test-classes/${testData.classes.classId1}/posts`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.message === '반 게시판 접근 성공', `Message mismatch: ${res.body?.message}`)
  }),

  test('인증 실패 시 401 반환 (첫 단계)', async () => {
    const res = await request({
      path: `/api/v1/test-classes/${testData.classes.classId1}/posts`,
      method: 'GET'
      // 토큰 없음
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
    assert(res.body?.error?.code === 'UNAUTHORIZED', `Expected UNAUTHORIZED, got ${res.body?.error?.code}`)
  }),

  test('인증 성공 후 반 접근 거부 시 403 반환 (두번째 단계)', async () => {
    const token = createToken({
      id: testData.users.student1Id,
      role: 'student',
      class_id: testData.classes.classId1,
      team_id: testData.teams.teamId1
    })

    // 학생1은 classId1 소속, classId2에 접근 시도
    const res = await request({
      path: `/api/v1/test-classes/${testData.classes.classId2}/posts`,
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
    assert(res.body?.error?.code === 'FORBIDDEN', `Expected FORBIDDEN, got ${res.body?.error?.code}`)
  }),
]

// ============================================================
// 메인 실행
// ============================================================

async function setup() {
  console.log('테스트 데이터 설정 중...')

  const res = await request({
    path: '/api/v1/test-setup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })

  if (res.status !== 200) {
    throw new Error(`테스트 데이터 설정 실패: ${res.raw}`)
  }

  testData = res.body.data
  console.log('테스트 데이터 설정 완료')
  console.log(`  - Classes: ${JSON.stringify(testData.classes)}`)
  console.log(`  - Teams: ${JSON.stringify(testData.teams)}`)
  console.log(`  - Users: ${JSON.stringify(testData.users)}`)
  console.log('')
}

async function cleanup() {
  console.log('\n테스트 데이터 정리 중...')

  try {
    await request({
      path: '/api/v1/test-cleanup',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    console.log('테스트 데이터 정리 완료')
  } catch (err) {
    console.error('테스트 데이터 정리 실패:', err.message)
  }
}

async function runTests() {
  console.log('\n========================================')
  console.log('Phase 1-2: 역할/반/팀 검증 미들웨어 테스트')
  console.log('========================================\n')

  // JWT_SECRET 확인
  if (!JWT_SECRET) {
    console.error('JWT_SECRET 환경 변수가 설정되지 않았습니다.')
    console.error('.env 파일을 확인하세요.')
    process.exit(1)
  }

  // 서버 연결 확인
  console.log(`서버 연결 확인 중... (http://${HOST}:${PORT})`)
  try {
    await request({ path: '/api/v1/health', method: 'GET' })
    console.log('서버 연결 성공!\n')
  } catch (err) {
    console.error('서버에 연결할 수 없습니다.')
    console.error('서버를 먼저 시작하세요: npm run dev')
    process.exit(1)
  }

  // 테스트 데이터 설정
  try {
    await setup()
  } catch (err) {
    console.error('테스트 데이터 설정 실패:', err.message)
    process.exit(1)
  }

  // 테스트 실행
  console.log('테스트 실행 중...\n')

  for (const t of tests) {
    await t()
  }

  // 테스트 데이터 정리
  await cleanup()

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
