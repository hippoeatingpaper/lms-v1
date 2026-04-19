// test/phase0-5-test.js
// Phase 0-5: Express 기본 미들웨어 테스트

import http from 'http'

const PORT = process.env.PORT || 3000
const HOST = 'localhost'

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

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // 에러 핸들러 테스트
  test('404 - 존재하지 않는 API 라우트', async () => {
    const res = await request({ path: '/api/v1/nonexistent', method: 'GET' })
    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  test('404 - 에러 응답 형식 { error: { code, message } }', async () => {
    const res = await request({ path: '/api/v1/nonexistent', method: 'GET' })
    assert(res.body?.error?.code, 'Missing error.code')
    assert(res.body?.error?.message, 'Missing error.message')
  }),

  test('404 - NOT_FOUND 코드 확인', async () => {
    const res = await request({ path: '/api/v1/something', method: 'GET' })
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND, got ${res.body?.error?.code}`)
  }),

  // 보안 필터 테스트
  test('보안 필터 - /.env 접근 차단 (403)', async () => {
    const res = await request({ path: '/.env', method: 'GET' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('보안 필터 - /.git/ 접근 차단 (403)', async () => {
    const res = await request({ path: '/.git/config', method: 'GET' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('보안 필터 - /node_modules/ 접근 차단 (403)', async () => {
    const res = await request({ path: '/node_modules/express/package.json', method: 'GET' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('보안 필터 - /data/ 접근 차단 (403)', async () => {
    const res = await request({ path: '/data/database.db', method: 'GET' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('보안 필터 - /certs/ 접근 차단 (403)', async () => {
    const res = await request({ path: '/certs/key.pem', method: 'GET' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('보안 필터 - .pem 파일 접근 차단 (403)', async () => {
    const res = await request({ path: '/some/path/cert.pem', method: 'GET' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('보안 필터 - 일반 API 경로 정상 접근', async () => {
    const res = await request({ path: '/api/v1/health', method: 'GET' })
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.status === 'ok', 'Health check failed')
  }),

  // 미들웨어 테스트
  test('JSON 파싱 - express.json() 동작', async () => {
    const res = await request(
      {
        path: '/api/v1/health',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { test: 'data' }
    )
    // POST /api/v1/health는 404지만, JSON 파싱이 되어야 함
    // 여기서는 서버가 에러 없이 응답하면 성공
    assert(res.status !== 500, 'JSON parsing failed')
  }),

  test('CORS - 허용된 origin 헤더 확인', async () => {
    const res = await request({
      path: '/api/v1/health',
      method: 'OPTIONS',
      headers: {
        'Origin': `http://localhost:${PORT}`,
        'Access-Control-Request-Method': 'GET'
      }
    })
    // CORS preflight 또는 일반 응답
    const allowOrigin = res.headers['access-control-allow-origin']
    assert(allowOrigin, 'Missing Access-Control-Allow-Origin header')
  }),

  test('CORS - credentials 허용 확인', async () => {
    const res = await request({
      path: '/api/v1/health',
      method: 'GET',
      headers: { 'Origin': `http://localhost:${PORT}` }
    })
    const allowCredentials = res.headers['access-control-allow-credentials']
    assert(allowCredentials === 'true', 'Credentials not allowed')
  }),

  test('URL 인코딩 - express.urlencoded() 동작', async () => {
    const res = await request(
      {
        path: '/api/v1/health',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    )
    // POST /api/v1/health는 404지만, URL 인코딩 파싱이 되어야 함
    assert(res.status !== 500, 'URL encoding parsing failed')
  }),

  test('에러 핸들러 - 서버 에러 발생 시 500 응답', async () => {
    const res = await request({ path: '/api/v1/test-error', method: 'GET' })
    assert(res.status === 500, `Expected 500, got ${res.status}`)
  }),

  test('에러 핸들러 - 에러 응답에 code 포함', async () => {
    const res = await request({ path: '/api/v1/test-error', method: 'GET' })
    assert(res.body?.error?.code, 'Missing error.code in 500 response')
  }),

  test('에러 핸들러 - 에러 응답에 message 포함', async () => {
    const res = await request({ path: '/api/v1/test-error', method: 'GET' })
    assert(res.body?.error?.message, 'Missing error.message in 500 response')
  }),

  test('에러 핸들러 - development 환경에서 스택 트레이스 표시', async () => {
    const res = await request({ path: '/api/v1/test-error', method: 'GET' })
    // development 환경에서는 stack 필드가 있어야 함
    assert(res.body?.error?.stack, 'Missing stack trace in development mode')
  }),
]

// ============================================================
// 메인 실행
// ============================================================

async function runTests() {
  console.log('\n========================================')
  console.log('Phase 0-5: Express 기본 미들웨어 테스트')
  console.log('========================================\n')

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
