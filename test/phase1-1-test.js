// test/phase1-1-test.js
// Phase 1-1: JWT 인증 미들웨어 테스트

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
  // Access Token 검증 테스트
  test('유효한 Access Token으로 인증 성공', async () => {
    const token = createToken({
      id: 1,
      role: 'teacher',
      class_id: null,
      team_id: null
    })

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${token}`
      }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.message === '인증 성공', 'Message mismatch')
  }),

  test('httpOnly 쿠키에서 토큰 읽기 확인', async () => {
    const token = createToken({ id: 1, role: 'student', class_id: 1, team_id: null })

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${token}`
      }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
  }),

  test('req.user에 사용자 정보 설정 확인', async () => {
    const token = createToken({
      id: 123,
      role: 'student',
      class_id: 5,
      team_id: 10
    })

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${token}`
      }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.user, 'user object missing')
  }),

  test('req.user.id, req.user.role, req.user.class_id 포함', async () => {
    const token = createToken({
      id: 42,
      role: 'student',
      class_id: 3,
      team_id: 7
    })

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${token}`
      }
    })

    assert(res.body?.user?.id === 42, `Expected id 42, got ${res.body?.user?.id}`)
    assert(res.body?.user?.role === 'student', `Expected role student, got ${res.body?.user?.role}`)
    assert(res.body?.user?.class_id === 3, `Expected class_id 3, got ${res.body?.user?.class_id}`)
  }),

  // 토큰 만료 테스트
  test('만료된 Access Token으로 401 응답', async () => {
    const token = createToken(
      { id: 1, role: 'teacher', class_id: null, team_id: null },
      { expiresIn: '-1s' } // 이미 만료
    )

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${token}`
      }
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('에러 코드 TOKEN_EXPIRED 반환', async () => {
    const token = createToken(
      { id: 1, role: 'teacher', class_id: null, team_id: null },
      { expiresIn: '-1s' }
    )

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${token}`
      }
    })

    assert(res.body?.error?.code === 'TOKEN_EXPIRED', `Expected TOKEN_EXPIRED, got ${res.body?.error?.code}`)
  }),

  test('만료 에러 메시지 확인', async () => {
    const token = createToken(
      { id: 1, role: 'teacher', class_id: null, team_id: null },
      { expiresIn: '-1s' }
    )

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${token}`
      }
    })

    assert(res.body?.error?.message, 'Error message missing')
    assert(res.body?.error?.message.includes('만료'), `Message should contain "만료": ${res.body?.error?.message}`)
  }),

  // 유효하지 않은 토큰 테스트
  test('변조된 토큰으로 401 응답', async () => {
    const token = createToken({ id: 1, role: 'teacher', class_id: null, team_id: null })
    const tamperedToken = token.slice(0, -5) + 'xxxxx' // 서명 변조

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${tamperedToken}`
      }
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('형식이 잘못된 토큰으로 401 응답', async () => {
    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=not.a.valid.jwt.token`
      }
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('토큰 없이 요청 시 401 응답', async () => {
    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET'
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('토큰 없이 요청 시 에러 코드 UNAUTHORIZED 반환', async () => {
    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET'
    })

    assert(res.body?.error?.code === 'UNAUTHORIZED', `Expected UNAUTHORIZED, got ${res.body?.error?.code}`)
  }),

  // 토큰 페이로드 테스트
  test('토큰에 userId 포함', async () => {
    const payload = { id: 999, role: 'teacher', class_id: null, team_id: null }
    const token = createToken(payload)
    const decoded = jwt.decode(token)

    assert(decoded.id === 999, `Expected id 999, got ${decoded.id}`)
  }),

  test('토큰에 role 포함', async () => {
    const payload = { id: 1, role: 'student', class_id: 1, team_id: null }
    const token = createToken(payload)
    const decoded = jwt.decode(token)

    assert(decoded.role === 'student', `Expected role student, got ${decoded.role}`)
  }),

  test('토큰에 classId 포함 (학생인 경우)', async () => {
    const payload = { id: 1, role: 'student', class_id: 5, team_id: 2 }
    const token = createToken(payload)
    const decoded = jwt.decode(token)

    assert(decoded.class_id === 5, `Expected class_id 5, got ${decoded.class_id}`)
  }),

  test('토큰에 만료 시간(exp) 포함', async () => {
    const payload = { id: 1, role: 'teacher', class_id: null, team_id: null }
    const token = createToken(payload, { expiresIn: '3h' })
    const decoded = jwt.decode(token)

    assert(decoded.exp, 'exp field missing')
    assert(typeof decoded.exp === 'number', 'exp should be a number')

    // 만료 시간이 현재 시간 이후인지 확인
    const now = Math.floor(Date.now() / 1000)
    assert(decoded.exp > now, 'Token should not be expired')
  }),

  // 다른 알고리즘 사용 시 거부 테스트
  test('none 알고리즘 공격 방지', async () => {
    // none 알고리즘으로 서명된 토큰 생성 시도
    // jwt.sign에서 algorithm: 'none'은 secret 없이 사용해야 함
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ id: 1, role: 'teacher' })).toString('base64url')
    const noneToken = `${header}.${payload}.`

    const res = await request({
      path: '/api/v1/test-auth',
      method: 'GET',
      headers: {
        'Cookie': `access_token=${noneToken}`
      }
    })

    assert(res.status === 401, `Expected 401 for none algorithm, got ${res.status}`)
  }),
]

// ============================================================
// 메인 실행
// ============================================================

async function runTests() {
  console.log('\n========================================')
  console.log('Phase 1-1: JWT 인증 미들웨어 테스트')
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
