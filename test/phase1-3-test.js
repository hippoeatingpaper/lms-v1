// test/phase1-3-test.js
// Phase 1-3: Rate Limiting 테스트

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

// 여러 요청을 순차적으로 보내는 헬퍼
async function sendRequests(options, count, body = null) {
  const responses = []
  for (let i = 0; i < count; i++) {
    const res = await request(options, body)
    responses.push(res)
  }
  return responses
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
  // 로그인 시도 제한 테스트
  // ============================================================
  test('로그인 5회 시도 후 6번째에서 429 응답', async () => {
    // 고유한 username 사용 (다른 테스트와 충돌 방지)
    const uniqueUsername = `test_user_${Date.now()}`

    // 5회 시도 (모두 성공해야 함)
    for (let i = 1; i <= 5; i++) {
      const res = await request({
        path: '/api/v1/test-login-limit',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: uniqueUsername, password: 'wrong' })

      assert(res.status === 200, `Request ${i}: Expected 200, got ${res.status}`)
    }

    // 6번째 시도 (차단되어야 함)
    const res6 = await request({
      path: '/api/v1/test-login-limit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: uniqueUsername, password: 'wrong' })

    assert(res6.status === 429, `6th request: Expected 429, got ${res6.status}`)
  }),

  test('차단 시 429 응답 반환', async () => {
    const uniqueUsername = `test_block_${Date.now()}`

    // 5회 시도
    for (let i = 0; i < 5; i++) {
      await request({
        path: '/api/v1/test-login-limit',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: uniqueUsername })
    }

    // 차단 확인
    const res = await request({
      path: '/api/v1/test-login-limit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: uniqueUsername })

    assert(res.status === 429, `Expected 429, got ${res.status}`)
  }),

  test('차단 시 에러 코드 TOO_MANY_REQUESTS 반환', async () => {
    const uniqueUsername = `test_code_${Date.now()}`

    // 6회 시도
    for (let i = 0; i < 6; i++) {
      await request({
        path: '/api/v1/test-login-limit',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: uniqueUsername })
    }

    const res = await request({
      path: '/api/v1/test-login-limit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: uniqueUsername })

    assert(res.body?.error?.code === 'TOO_MANY_REQUESTS',
      `Expected TOO_MANY_REQUESTS, got ${res.body?.error?.code}`)
  }),

  test('에러 메시지에 재시도 관련 내용 포함', async () => {
    const uniqueUsername = `test_msg_${Date.now()}`

    // 6회 시도
    for (let i = 0; i < 6; i++) {
      await request({
        path: '/api/v1/test-login-limit',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: uniqueUsername })
    }

    const res = await request({
      path: '/api/v1/test-login-limit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: uniqueUsername })

    const message = res.body?.error?.message || ''
    assert(message.includes('15분') || message.includes('다시 시도'),
      `Expected retry message, got: ${message}`)
  }),

  test('다른 username은 별도로 카운트됨', async () => {
    const user1 = `test_sep1_${Date.now()}`
    const user2 = `test_sep2_${Date.now()}`

    // user1로 5회 시도
    for (let i = 0; i < 5; i++) {
      await request({
        path: '/api/v1/test-login-limit',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: user1 })
    }

    // user2는 아직 제한 안 됨
    const res = await request({
      path: '/api/v1/test-login-limit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: user2 })

    assert(res.status === 200, `Expected 200 for different user, got ${res.status}`)
  }),

  // ============================================================
  // 일반 API 제한 테스트
  // ============================================================
  test('일반 API 첫 요청 성공 (200)', async () => {
    const res = await request({
      path: '/api/v1/test-api-limit',
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
  }),

  test('일반 API Rate Limit 헤더 포함 확인', async () => {
    const res = await request({
      path: '/api/v1/test-api-limit',
      method: 'GET'
    })

    // standardHeaders: true → RateLimit-* 헤더 사용
    const hasRateLimitHeader =
      res.headers['ratelimit-limit'] !== undefined ||
      res.headers['ratelimit-remaining'] !== undefined

    assert(hasRateLimitHeader, 'Expected RateLimit headers to be present')
  }),

  // ============================================================
  // Rate Limit 헤더 테스트
  // ============================================================
  test('RateLimit-Limit 헤더 반환', async () => {
    const res = await request({
      path: '/api/v1/test-api-limit',
      method: 'GET'
    })

    const limit = res.headers['ratelimit-limit']
    assert(limit !== undefined, `Expected RateLimit-Limit header, got: ${JSON.stringify(res.headers)}`)
  }),

  test('RateLimit-Remaining 헤더 반환', async () => {
    const res = await request({
      path: '/api/v1/test-api-limit',
      method: 'GET'
    })

    const remaining = res.headers['ratelimit-remaining']
    assert(remaining !== undefined, 'Expected RateLimit-Remaining header')
  }),

  test('RateLimit-Reset 헤더 반환', async () => {
    const res = await request({
      path: '/api/v1/test-api-limit',
      method: 'GET'
    })

    const reset = res.headers['ratelimit-reset']
    assert(reset !== undefined, 'Expected RateLimit-Reset header')
  }),

  test('Remaining 값이 요청마다 감소', async () => {
    // 두 번 요청해서 remaining 비교
    const res1 = await request({
      path: '/api/v1/test-api-limit',
      method: 'GET'
    })

    const res2 = await request({
      path: '/api/v1/test-api-limit',
      method: 'GET'
    })

    const remaining1 = parseInt(res1.headers['ratelimit-remaining'], 10)
    const remaining2 = parseInt(res2.headers['ratelimit-remaining'], 10)

    assert(remaining2 < remaining1,
      `Expected remaining to decrease: ${remaining1} → ${remaining2}`)
  }),

  // ============================================================
  // 예외 경로 테스트
  // ============================================================
  test('헬스체크 경로는 글로벌 Rate Limit 적용됨 (API 경로이므로)', async () => {
    // /api/v1/health는 globalLimiter 적용됨
    const res = await request({
      path: '/api/v1/health',
      method: 'GET'
    })

    // 헬스체크는 동작해야 함
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.status === 'ok', 'Expected status ok')
  }),

  test('정적 파일 경로는 Rate Limit 미적용', async () => {
    // /uploads는 API 경로가 아니므로 Rate Limit 미적용
    const res = await request({
      path: '/uploads/test.txt',
      method: 'GET'
    })

    // 파일이 없어도 404이지만, Rate Limit 헤더는 없어야 함
    const hasRateLimitHeader = res.headers['ratelimit-limit'] !== undefined
    assert(!hasRateLimitHeader, 'Static files should not have RateLimit headers')
  }),

  // ============================================================
  // 인증된 사용자 Rate Limit 테스트
  // ============================================================
  test('인증된 사용자 API Rate Limit 동작', async () => {
    const token = createToken({
      id: 999,
      role: 'student',
      class_id: 1,
      team_id: 1
    })

    const res = await request({
      path: '/api/v1/test-auth-limit',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token}` }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.headers['ratelimit-limit'] !== undefined, 'Expected RateLimit headers')
  }),

  test('인증된 사용자는 사용자ID 기반으로 제한됨', async () => {
    // 서로 다른 사용자 토큰
    const token1 = createToken({ id: 1001, role: 'student', class_id: 1, team_id: 1 })
    const token2 = createToken({ id: 1002, role: 'student', class_id: 1, team_id: 1 })

    // user1로 요청
    const res1 = await request({
      path: '/api/v1/test-auth-limit',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token1}` }
    })

    // user2로 요청 - 별도 카운트이므로 remaining이 더 높아야 함
    const res2 = await request({
      path: '/api/v1/test-auth-limit',
      method: 'GET',
      headers: { 'Cookie': `access_token=${token2}` }
    })

    const remaining1 = parseInt(res1.headers['ratelimit-remaining'], 10)
    const remaining2 = parseInt(res2.headers['ratelimit-remaining'], 10)

    // 두 사용자는 별도 카운트이므로 remaining이 같거나 user2가 더 높음
    // (user2는 첫 요청이므로)
    assert(remaining2 >= remaining1,
      `Expected separate counts: user1=${remaining1}, user2=${remaining2}`)
  }),
]

// ============================================================
// 메인 실행
// ============================================================

async function runTests() {
  console.log('\n========================================')
  console.log('Phase 1-3: Rate Limiting 테스트')
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

  // 테스트 실행
  console.log('테스트 실행 중...\n')
  console.log('주의: Rate Limit 테스트는 여러 요청을 보내므로 시간이 걸릴 수 있습니다.\n')

  for (const t of tests) {
    await t()
  }

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
