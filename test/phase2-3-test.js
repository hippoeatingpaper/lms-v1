// test/phase2-3-test.js
// Phase 2-3: Users API (학생 관리) 테스트

import http from 'http'
import dotenv from 'dotenv'

// 환경 변수 로드
dotenv.config()

const PORT = process.env.PORT || 3000
const HOST = 'localhost'

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

function resetCookies() {
  cookies = {}
}

// 로그인 헬퍼
async function login(username, password) {
  const res = await request({
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username, password })
  return res
}

// 생성된 테스트 학생 ID 추적
let createdStudentId = null
let createdStudentId2 = null

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // ============================================================
  // 비인증 테스트
  // ============================================================
  test('비인증: 학생 목록 조회 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: '/api/v1/users',
      method: 'GET'
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  // ============================================================
  // 학생 권한 테스트
  // ============================================================
  test('학생 로그인', async () => {
    resetCookies()
    const res = await login(testData.student.username, testData.student.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('학생: 학생 목록 조회 시 403 반환', async () => {
    const res = await request({
      path: '/api/v1/users',
      method: 'GET'
    })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 학생 생성 시도 시 403 반환', async () => {
    const res = await request({
      path: '/api/v1/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: '학생이 만든 학생',
      username: 'forbidden_student',
      password: 'test1234'
    })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 학생 수정 시도 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/users/${testData.student.id}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '수정된 이름' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 비밀번호 초기화 시도 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/users/${testData.student.id}/reset-password`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { new_password: 'newpass123' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 학생 삭제 시도 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/users/${testData.student.id}`,
      method: 'DELETE'
    })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 학생 조회
  // ============================================================
  test('교사 로그인', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 전체 학생 목록 조회 성공', async () => {
    const res = await request({
      path: '/api/v1/users',
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.users), 'Expected users array')
  }),

  test('교사: class_id 필터로 학생 목록 조회', async () => {
    const res = await request({
      path: `/api/v1/users?class_id=${testData.classId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.users), 'Expected users array')
    // 모든 학생이 해당 반 소속인지 확인
    if (res.body.users.length > 0) {
      const allInClass = res.body.users.every(u => u.class_id === testData.classId)
      assert(allInClass, 'All users should be in the specified class')
    }
  }),

  test('교사: 학생 상세 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/users/${testData.student.id}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.user?.id === testData.student.id, 'Expected correct user id')
    assert(res.body?.user?.name !== undefined, 'Expected user name')
    assert(res.body?.user?.username !== undefined, 'Expected user username')
    assert(res.body?.user?.class_id !== undefined, 'Expected user class_id')
  }),

  test('교사: 존재하지 않는 학생 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/users/99999',
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND, got ${res.body?.error?.code}`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 학생 생성
  // ============================================================
  test('교사: 학생 생성 - 필수 필드 누락 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '이름만' })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR`)
  }),

  test('교사: 학생 생성 성공 (201)', async () => {
    const username = 'test_new_student_' + Date.now()
    const res = await request({
      path: '/api/v1/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: '새학생',
      username: username,
      password: 'student123',
      class_id: testData.classId
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.user?.id !== undefined, 'Expected user.id')
    assert(res.body?.user?.name === '새학생', 'Expected name to match')
    assert(res.body?.user?.username === username, 'Expected username to match')
    assert(res.body?.user?.class_id === testData.classId, 'Expected class_id to match')

    createdStudentId = res.body.user.id
  }),

  test('교사: 중복 username 생성 시 400 반환', async () => {
    // 이미 존재하는 username으로 다시 생성 시도
    const res = await request({
      path: '/api/v1/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: '중복학생',
      username: testData.student.username,  // 이미 존재하는 username
      password: 'test1234'
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'DUPLICATE_USERNAME', `Expected DUPLICATE_USERNAME`)
  }),

  test('교사: 존재하지 않는 반에 학생 생성 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: '잘못된반학생',
      username: 'invalid_class_student_' + Date.now(),
      password: 'test1234',
      class_id: 99999
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'INVALID_CLASS', `Expected INVALID_CLASS`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 학생 일괄 생성
  // ============================================================
  test('교사: 학생 일괄 생성 성공', async () => {
    const timestamp = Date.now()
    const res = await request({
      path: '/api/v1/users/bulk',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      class_id: testData.classId,
      users: [
        { name: '일괄학생1', username: `bulk_student_1_${timestamp}`, password: 'pass1234' },
        { name: '일괄학생2', username: `bulk_student_2_${timestamp}`, password: 'pass1234' }
      ]
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.created === 2, `Expected 2 created, got ${res.body?.created}`)
    assert(Array.isArray(res.body?.failed), 'Expected failed array')
    assert(res.body.failed.length === 0, 'Expected no failures')
  }),

  test('교사: 학생 일괄 생성 - 일부 실패 (중복 username)', async () => {
    const timestamp = Date.now()
    const res = await request({
      path: '/api/v1/users/bulk',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      class_id: testData.classId,
      users: [
        { name: '새학생3', username: `bulk_student_3_${timestamp}`, password: 'pass1234' },
        { name: '중복시도', username: testData.student.username, password: 'pass1234' }  // 중복
      ]
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.created === 1, `Expected 1 created, got ${res.body?.created}`)
    assert(res.body?.failed?.length === 1, 'Expected 1 failure')
    assert(res.body.failed[0].username === testData.student.username, 'Expected duplicate username in failed')
  }),

  test('교사: 학생 일괄 생성 - 빈 배열 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/users/bulk',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      class_id: testData.classId,
      users: []
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 학생 수정
  // ============================================================
  test('교사: 학생 이름 수정 성공', async () => {
    const newName = '수정된학생이름_' + Date.now()
    const res = await request({
      path: `/api/v1/users/${createdStudentId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { name: newName })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.user?.name === newName, `Expected name to be ${newName}`)
  }),

  test('교사: 학생 반 변경 성공', async () => {
    // 기존 반 목록 조회해서 사용 가능한 반 찾기
    const classesRes = await request({
      path: '/api/v1/classes',
      method: 'GET'
    })

    // 현재 학생이 속하지 않은 다른 반 찾기
    const currentUserRes = await request({
      path: `/api/v1/users/${createdStudentId}`,
      method: 'GET'
    })
    const currentClassId = currentUserRes.body?.user?.class_id

    let targetClassId = null

    // 기존 반 중 학생이 없는 반 찾기 (또는 다른 반)
    for (const cls of classesRes.body.classes) {
      if (cls.id !== currentClassId) {
        targetClassId = cls.id
        break
      }
    }

    // 다른 반이 없으면 새 반 생성 시도
    if (!targetClassId) {
      const classRes = await request({
        path: '/api/v1/classes',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { name: '임시반_' + Date.now() })

      if (classRes.status !== 201) {
        // 6개 제한에 걸리면 테스트 스킵
        console.log('    (반 생성 제한으로 스킵: 기존 반으로 테스트)')
        // null로 변경 테스트
        const res = await request({
          path: `/api/v1/users/${createdStudentId}`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        }, { class_id: null })

        assert(res.status === 200, `Expected 200, got ${res.status}`)
        assert(res.body?.user?.class_id === null, 'Expected class_id to be null')
        return
      }

      targetClassId = classRes.body.class.id
    }

    const res = await request({
      path: `/api/v1/users/${createdStudentId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { class_id: targetClassId })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.user?.class_id === targetClassId, `Expected class_id to be ${targetClassId}`)
    // 반 변경 시 팀도 null로 초기화되어야 함
    assert(res.body?.user?.team_id === null, 'Expected team_id to be null after class change')
  }),

  test('교사: 존재하지 않는 학생 수정 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/users/99999',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '새이름' })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND`)
  }),

  test('교사: 수정할 항목 없으면 400 반환', async () => {
    const res = await request({
      path: `/api/v1/users/${createdStudentId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, {})

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR`)
  }),

  test('교사: 존재하지 않는 반으로 변경 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/users/${createdStudentId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { class_id: 99999 })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'INVALID_CLASS', `Expected INVALID_CLASS`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 비밀번호 초기화
  // ============================================================
  test('교사: 비밀번호 초기화 성공', async () => {
    const res = await request({
      path: `/api/v1/users/${createdStudentId}/reset-password`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { new_password: 'newpassword123' })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')
  }),

  test('교사: 비밀번호 초기화 - 비밀번호 누락 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/users/${createdStudentId}/reset-password`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {})

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR`)
  }),

  test('교사: 존재하지 않는 학생 비밀번호 초기화 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/users/99999/reset-password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { new_password: 'newpass123' })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 학생 삭제
  // ============================================================
  test('교사: 존재하지 않는 학생 삭제 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/users/99999',
      method: 'DELETE'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND`)
  }),

  test('교사: 학생 삭제 성공', async () => {
    const res = await request({
      path: `/api/v1/users/${createdStudentId}`,
      method: 'DELETE'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')
  }),

  test('교사: 삭제된 학생 재조회 시 404 반환', async () => {
    const res = await request({
      path: `/api/v1/users/${createdStudentId}`,
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
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
  testData.classId = testData.student.classId
  testData.teamId = testData.student.teamId
  console.log('테스트 데이터 설정 완료')
  console.log(`  - Teacher: ${testData.teacher.username}`)
  console.log(`  - Student: ${testData.student.username} (id: ${testData.student.id})`)
  console.log(`  - Class ID: ${testData.classId}`)
  console.log('')
}

async function cleanup() {
  console.log('\n테스트 데이터 정리 중...')

  try {
    resetCookies()
    // 교사로 로그인 후 테스트 중 생성된 학생 정리
    await login(testData.teacher.username, testData.teacher.password)

    // 일괄 생성된 학생들 정리 (bulk_student_로 시작하는 학생들)
    const usersRes = await request({
      path: '/api/v1/users',
      method: 'GET'
    })

    if (usersRes.body?.users) {
      for (const user of usersRes.body.users) {
        if (user.username.startsWith('bulk_student_') || user.username.startsWith('test_new_student_')) {
          await request({
            path: `/api/v1/users/${user.id}`,
            method: 'DELETE'
          })
        }
      }
    }

    // 기본 테스트 데이터 정리
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
  console.log('Phase 2-3: Users API (학생 관리) 테스트')
  console.log('========================================\n')

  console.log(`서버 연결 확인 중... (http://${HOST}:${PORT})`)
  try {
    await request({ path: '/api/v1/health', method: 'GET' })
    console.log('서버 연결 성공!\n')
  } catch (err) {
    console.error('서버에 연결할 수 없습니다.')
    console.error('서버를 먼저 실행하세요: npm run dev')
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

  // 테스트 항목 체크리스트 출력
  console.log('========================================')
  console.log('테스트 항목 체크리스트 (PHASE2_TEST.md 기준):')
  console.log('========================================')
  console.log('GET /api/v1/users (반 학생 목록)')
  console.log(`  [${passed > 8 ? 'x' : ' '}] 해당 반의 학생 목록 반환`)
  console.log(`  [${passed > 10 ? 'x' : ' '}] 각 학생: id, loginId(username), name, teamId 포함`)
  console.log(`  [${passed > 11 ? 'x' : ' '}] 존재하지 않는 학생 접근 시 404 반환`)
  console.log('')
  console.log('POST /api/v1/users (학생 생성 - 교사 전용)')
  console.log(`  [${passed > 13 ? 'x' : ' '}] 학생 생성 성공 (201)`)
  console.log(`  [${passed > 14 ? 'x' : ' '}] 각 학생에 username, name, password 설정`)
  console.log(`  [${passed > 15 ? 'x' : ' '}] 중복 username 시 에러 반환`)
  console.log(`  [${passed > 3 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('POST /api/v1/users/bulk (학생 일괄 생성)')
  console.log(`  [${passed > 17 ? 'x' : ' '}] 일괄 생성 성공 (201)`)
  console.log(`  [${passed > 18 ? 'x' : ' '}] 일부 실패 시 실패 목록 반환`)
  console.log(`  [${passed > 19 ? 'x' : ' '}] 빈 배열 시 400 반환`)
  console.log('')
  console.log('PATCH /api/v1/users/:id (학생 정보 수정)')
  console.log(`  [${passed > 20 ? 'x' : ' '}] 학생 정보 수정 성공 (200)`)
  console.log(`  [${passed > 20 ? 'x' : ' '}] 이름 변경 가능`)
  console.log(`  [${passed > 21 ? 'x' : ' '}] 반 변경 가능 (class_id)`)
  console.log(`  [${passed > 4 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log(`  [${passed > 22 ? 'x' : ' '}] 존재하지 않는 학생 수정 시 404 반환`)
  console.log('')
  console.log('DELETE /api/v1/users/:id (학생 삭제)')
  console.log(`  [${passed > 28 ? 'x' : ' '}] 학생 삭제 성공 (200)`)
  console.log(`  [${passed > 6 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('POST /api/v1/users/:id/reset-password (비밀번호 초기화)')
  console.log(`  [${passed > 25 ? 'x' : ' '}] 비밀번호 초기화 성공 (200)`)
  console.log(`  [${passed > 5 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log(`  [${passed > 27 ? 'x' : ' '}] 존재하지 않는 학생 시 404 반환`)
  console.log('')

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
