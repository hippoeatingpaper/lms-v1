// test/phase2-1-test.js
// Phase 2-1: Auth API 테스트

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

// 테스트 데이터
let testData = null
let cookies = {}

// HTTP 요청 헬퍼 (쿠키 지원)
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    // 쿠키 헤더 설정
    const headers = { ...options.headers }
    if (Object.keys(cookies).length > 0) {
      const cookieStr = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
      headers['Cookie'] = cookieStr
    }

    const req = http.request({
      hostname: HOST,
      port: PORT,
      ...options,
      headers
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        // Set-Cookie 파싱
        const setCookies = res.headers['set-cookie'] || []
        setCookies.forEach(cookie => {
          const parts = cookie.split(';')
          const [nameValue] = parts
          const eqIdx = nameValue.indexOf('=')
          if (eqIdx === -1) return

          const name = nameValue.substring(0, eqIdx).trim()
          const value = nameValue.substring(eqIdx + 1).trim()

          const lowerCookie = cookie.toLowerCase()
          if (value === '' || lowerCookie.includes('max-age=0') || lowerCookie.includes('expires=thu, 01 jan 1970')) {
            delete cookies[name]
          } else {
            cookies[name] = value
          }
        })

        try {
          const json = data ? JSON.parse(data) : null
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
            raw: data,
            setCookies
          })
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
            setCookies
          })
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

// 쿠키 초기화
function resetCookies() {
  cookies = {}
}

// 로그인 헬퍼 (쿠키 유지)
async function login(username, password) {
  const res = await request({
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username, password })
  return res
}

// ============================================================
// 테스트 케이스 (순서 최적화 - 로그인 횟수 최소화)
// ============================================================

const tests = [
  // ============================================================
  // POST /api/v1/auth/login - 실패 케이스 (별도 username 사용)
  // ============================================================
  test('로그인: 빈 요청 바디로 로그인 실패 (400)', async () => {
    resetCookies()
    const res = await request({
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {})

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR, got ${res.body?.error?.code}`)
  }),

  test('로그인: 잘못된 아이디로 로그인 실패 (401)', async () => {
    resetCookies()
    const res = await request({
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'nonexistent_user_xyz', password: 'password' })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
    assert(res.body?.error?.code === 'INVALID_CREDENTIALS', `Expected INVALID_CREDENTIALS, got ${res.body?.error?.code}`)
  }),

  test('로그인: 잘못된 비밀번호로 로그인 실패 (401)', async () => {
    resetCookies()
    const res = await request({
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: testData.student.username, password: 'wrong_password_xyz' })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  // ============================================================
  // 토큰 갱신 실패 케이스 (로그인 불필요)
  // ============================================================
  test('토큰 갱신: Refresh Token 없이 요청 시 실패 (401)', async () => {
    resetCookies()
    const res = await request({
      path: '/api/v1/auth/refresh',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('토큰 갱신: 유효하지 않은 Refresh Token으로 갱신 실패 (401)', async () => {
    resetCookies()
    cookies['refresh_token'] = 'invalid.token.here'

    const res = await request({
      path: '/api/v1/auth/refresh',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('토큰 갱신: 만료된 Refresh Token으로 갱신 실패 (401)', async () => {
    resetCookies()
    const expiredToken = jwt.sign({ id: 1 }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '-1s'
    })
    cookies['refresh_token'] = expiredToken

    const res = await request({
      path: '/api/v1/auth/refresh',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
    assert(res.body?.error?.code === 'TOKEN_EXPIRED', `Expected TOKEN_EXPIRED, got ${res.body?.error?.code}`)
  }),

  // ============================================================
  // /me 비인증 케이스
  // ============================================================
  test('/me: 비인증 요청 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: '/api/v1/auth/me',
      method: 'GET'
    })

    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  // ============================================================
  // 교사 로그인 → 성공 테스트들 (한 번의 로그인으로 여러 테스트)
  // ============================================================
  test('교사 로그인: 올바른 자격 증명으로 로그인 성공', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.message === '로그인 성공', `Expected success message`)
    assert(res.body?.user?.id !== undefined, 'Expected user.id')
    assert(res.body?.user?.name !== undefined, 'Expected user.name')
    assert(res.body?.user?.role === 'teacher', `Expected role teacher`)
  }),

  test('교사 로그인: Access Token 쿠키 설정됨', async () => {
    // 이전 테스트에서 쿠키가 설정되어 있어야 함
    assert(cookies['access_token'], 'Expected access_token cookie')
  }),

  test('교사 로그인: Refresh Token 쿠키 설정됨', async () => {
    assert(cookies['refresh_token'], 'Expected refresh_token cookie')
  }),

  test('/me: 교사 정보 조회 성공', async () => {
    const res = await request({
      path: '/api/v1/auth/me',
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.user?.id !== undefined, 'Expected user.id')
    assert(res.body?.user?.role === 'teacher', `Expected role teacher`)
  }),

  test('토큰 갱신: 유효한 Refresh Token으로 갱신 성공', async () => {
    const res = await request({
      path: '/api/v1/auth/refresh',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.message === '토큰 갱신 성공', `Expected success message`)
    assert(cookies['access_token'], 'Expected access_token after refresh')
    assert(res.body?.user?.id !== undefined, 'Expected user info in response')
  }),

  test('로그아웃: 성공 및 쿠키 삭제', async () => {
    // 로그아웃 전 쿠키 확인
    assert(cookies['access_token'], 'access_token should exist before logout')

    const res = await request({
      path: '/api/v1/auth/logout',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')
    assert(!cookies['access_token'], 'access_token should be cleared')
  }),

  test('로그아웃 후: /me 접근 불가 (401)', async () => {
    const res = await request({
      path: '/api/v1/auth/me',
      method: 'GET'
    })

    assert(res.status === 401, `Expected 401 after logout, got ${res.status}`)
  }),

  // ============================================================
  // 학생 로그인 테스트
  // ============================================================
  test('학생 로그인 및 /me 조회', async () => {
    resetCookies()
    const loginRes = await login(testData.student.username, testData.student.password)
    assert(loginRes.status === 200, `Login failed: ${loginRes.status}`)

    const meRes = await request({
      path: '/api/v1/auth/me',
      method: 'GET'
    })

    assert(meRes.status === 200, `Expected 200, got ${meRes.status}`)
    assert(meRes.body?.user?.role === 'student', `Expected role student`)
    assert(meRes.body?.user?.class_id !== undefined, 'Expected class_id')
  }),
]

// ============================================================
// 테스트 데이터 설정
// ============================================================

async function setup() {
  console.log('테스트 데이터 설정 중...')

  const res = await request({
    path: '/api/v1/test-auth-setup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })

  if (res.status !== 200) {
    throw new Error(`테스트 데이터 설정 실패: ${res.raw}`)
  }

  testData = res.body.data
  console.log('테스트 데이터 설정 완료')
  console.log(`  - Teacher: ${testData.teacher.username}`)
  console.log(`  - Student: ${testData.student.username}`)
  console.log('')
}

async function cleanup() {
  console.log('\n테스트 데이터 정리 중...')

  try {
    resetCookies()
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

// ============================================================
// 메인 실행
// ============================================================

async function runTests() {
  console.log('\n========================================')
  console.log('Phase 2-1: Auth API 테스트')
  console.log('========================================\n')

  if (!JWT_SECRET) {
    console.error('JWT_SECRET 환경 변수가 설정되지 않았습니다.')
    process.exit(1)
  }

  console.log(`서버 연결 확인 중... (http://${HOST}:${PORT})`)
  try {
    await request({ path: '/api/v1/health', method: 'GET' })
    console.log('서버 연결 성공!\n')
  } catch (err) {
    console.error('서버에 연결할 수 없습니다.')
    process.exit(1)
  }

  try {
    await setup()
  } catch (err) {
    console.error('테스트 데이터 설정 실패:', err.message)
    process.exit(1)
  }

  console.log('테스트 실행 중...\n')

  for (const t of tests) {
    await t()
  }

  await cleanup()

  console.log('\n========================================')
  console.log(`결과: ${passed} 통과, ${failed} 실패`)
  console.log('========================================\n')

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
