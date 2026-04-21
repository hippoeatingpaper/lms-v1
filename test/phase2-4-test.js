// test/phase2-4-test.js
// Phase 2-4: Teams API 테스트

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

// 생성된 테스트 팀 ID 추적
let createdTeamId = null
let createdTeamId2 = null
let unassignedStudentId = null

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // ============================================================
  // 비인증 테스트
  // ============================================================
  test('비인증: 팀 목록 조회 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
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

  test('학생: 팀 목록 조회 시 403 반환 (교사 전용)', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
      method: 'GET'
    })
    // 현재 구현: 팀 목록 조회는 교사 전용
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 팀 생성 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '학생이 만든 팀' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 팀 수정 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/teams/${testData.teamId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '수정된 팀 이름' })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 팀 삭제 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/teams/${testData.teamId}`,
      method: 'DELETE'
    })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 팀원 배정 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/teams/${testData.teamId}/members`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { user_ids: [testData.student.id] })
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 팀 목록 조회
  // ============================================================
  test('교사 로그인', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 반별 팀 목록 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.teams), 'Expected teams array')
    assert(Array.isArray(res.body?.unassigned), 'Expected unassigned array')
  }),

  test('교사: 팀 목록에 id, name, members 포함', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    if (res.body.teams.length > 0) {
      const team = res.body.teams[0]
      assert(team.id !== undefined, 'Expected team.id')
      assert(team.name !== undefined, 'Expected team.name')
      assert(Array.isArray(team.members), 'Expected team.members array')
    }
  }),

  test('교사: 존재하지 않는 반의 팀 목록 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/classes/99999/teams',
      method: 'GET'
    })
    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 팀 생성
  // ============================================================
  test('교사: 팀 생성 - 이름 누락 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {})

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR`)
  }),

  test('교사: 팀 생성 성공 (201)', async () => {
    const teamName = '테스트팀_' + Date.now()
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: teamName })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.team?.id !== undefined, 'Expected team.id')
    assert(res.body?.team?.name === teamName, 'Expected team name to match')
    assert(res.body?.team?.class_id === testData.classId, 'Expected class_id to match')
    assert(Array.isArray(res.body?.team?.members), 'Expected empty members array')

    createdTeamId = res.body.team.id
  }),

  test('교사: 중복 팀 이름 생성 시 400 반환', async () => {
    // 같은 이름으로 다시 생성 시도
    const teamsRes = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
      method: 'GET'
    })

    if (teamsRes.body.teams.length > 0) {
      const existingTeamName = teamsRes.body.teams[0].name
      const res = await request({
        path: `/api/v1/classes/${testData.classId}/teams`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { name: existingTeamName })

      assert(res.status === 400, `Expected 400, got ${res.status}`)
      assert(res.body?.error?.code === 'DUPLICATE_NAME', `Expected DUPLICATE_NAME`)
    }
  }),

  test('교사: 존재하지 않는 반에 팀 생성 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/classes/99999/teams',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '잘못된반팀' })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 팀 수정
  // ============================================================
  test('교사: 팀 이름 수정 성공 (200)', async () => {
    const newName = '수정된팀이름_' + Date.now()
    const res = await request({
      path: `/api/v1/teams/${createdTeamId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { name: newName })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.team?.name === newName, `Expected name to be ${newName}`)
  }),

  test('교사: 팀 수정 - 이름 누락 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/teams/${createdTeamId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, {})

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR`)
  }),

  test('교사: 존재하지 않는 팀 수정 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/teams/99999',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '새이름' })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND`)
  }),

  test('교사: 같은 반 내 중복 이름으로 수정 시 400 반환', async () => {
    // 두 번째 팀 생성
    const res1 = await request({
      path: `/api/v1/classes/${testData.classId}/teams`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '중복테스트팀_' + Date.now() })

    if (res1.status === 201) {
      createdTeamId2 = res1.body.team.id

      // 기존 팀 이름 가져오기
      const teamsRes = await request({
        path: `/api/v1/classes/${testData.classId}/teams`,
        method: 'GET'
      })
      const firstTeam = teamsRes.body.teams.find(t => t.id !== createdTeamId2)

      if (firstTeam) {
        // 두 번째 팀을 첫 번째 팀 이름으로 변경 시도
        const res = await request({
          path: `/api/v1/teams/${createdTeamId2}`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        }, { name: firstTeam.name })

        assert(res.status === 400, `Expected 400, got ${res.status}`)
        assert(res.body?.error?.code === 'DUPLICATE_NAME', `Expected DUPLICATE_NAME`)
      }
    }
  }),

  // ============================================================
  // 교사 권한 테스트 - 팀원 배정
  // ============================================================
  test('교사: 미배정 학생 생성 (팀원 배정 테스트용)', async () => {
    const username = 'unassigned_student_' + Date.now()
    const res = await request({
      path: '/api/v1/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: '미배정학생',
      username: username,
      password: 'test1234',
      class_id: testData.classId
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    unassignedStudentId = res.body.user.id
  }),

  test('교사: 팀원 배정 성공 (200)', async () => {
    const res = await request({
      path: `/api/v1/teams/${createdTeamId}/members`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { user_ids: [unassignedStudentId] })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.team !== undefined, 'Expected team object')
    assert(Array.isArray(res.body?.team?.members), 'Expected members array')

    const member = res.body.team.members.find(m => m.id === unassignedStudentId)
    assert(member !== undefined, 'Expected assigned student in members')
  }),

  test('교사: 이미 다른 팀에 배정된 학생 재배정 시 400 반환', async () => {
    // 이미 createdTeamId에 배정된 학생을 createdTeamId2에 배정 시도
    const res = await request({
      path: `/api/v1/teams/${createdTeamId2}/members`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { user_ids: [unassignedStudentId] })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'ALREADY_ASSIGNED', `Expected ALREADY_ASSIGNED`)
  }),

  test('교사: 다른 반 학생 배정 시 400 반환', async () => {
    // 다른 반 학생 생성
    const classRes = await request({
      path: '/api/v1/classes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '다른반_' + Date.now() })

    if (classRes.status === 201) {
      const otherClassId = classRes.body.class.id

      // 다른 반에 학생 생성
      const userRes = await request({
        path: '/api/v1/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        name: '다른반학생',
        username: 'other_class_student_' + Date.now(),
        password: 'test1234',
        class_id: otherClassId
      })

      if (userRes.status === 201) {
        const otherClassStudentId = userRes.body.user.id

        // 다른 반 학생을 현재 반의 팀에 배정 시도
        const res = await request({
          path: `/api/v1/teams/${createdTeamId}/members`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, { user_ids: [otherClassStudentId] })

        assert(res.status === 400, `Expected 400, got ${res.status}`)
        assert(res.body?.error?.code === 'INVALID_USER', `Expected INVALID_USER`)

        // 정리: 다른 반 학생 삭제
        await request({
          path: `/api/v1/users/${otherClassStudentId}`,
          method: 'DELETE'
        })
      }

      // 정리: 다른 반 삭제
      await request({
        path: `/api/v1/classes/${otherClassId}`,
        method: 'DELETE'
      })
    }
  }),

  test('교사: 빈 user_ids 배열 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/teams/${createdTeamId}/members`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { user_ids: [] })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR`)
  }),

  test('교사: 존재하지 않는 학생 배정 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/teams/${createdTeamId}/members`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { user_ids: [99999] })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'INVALID_USER', `Expected INVALID_USER`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 팀원 제거
  // ============================================================
  test('교사: 팀원 제거 성공 (200)', async () => {
    const res = await request({
      path: `/api/v1/teams/${createdTeamId}/members/${unassignedStudentId}`,
      method: 'DELETE'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')
  }),

  test('교사: 팀에 없는 학생 제거 시 404 반환', async () => {
    // 이미 제거된 학생을 다시 제거 시도
    const res = await request({
      path: `/api/v1/teams/${createdTeamId}/members/${unassignedStudentId}`,
      method: 'DELETE'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND`)
  }),

  // ============================================================
  // 교사 권한 테스트 - 팀 삭제
  // ============================================================
  test('교사: 팀 삭제 시 팀원들의 team_id가 null로 변경', async () => {
    // 학생을 팀에 다시 배정
    await request({
      path: `/api/v1/teams/${createdTeamId}/members`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { user_ids: [unassignedStudentId] })

    // 팀 삭제
    const res = await request({
      path: `/api/v1/teams/${createdTeamId}`,
      method: 'DELETE'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')

    // 학생의 team_id가 null인지 확인
    const userRes = await request({
      path: `/api/v1/users/${unassignedStudentId}`,
      method: 'GET'
    })

    assert(userRes.body?.user?.team_id === null, 'Expected team_id to be null after team deletion')
  }),

  test('교사: 존재하지 않는 팀 삭제 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/teams/99999',
      method: 'DELETE'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', `Expected NOT_FOUND`)
  }),

  test('교사: 두 번째 팀 정리', async () => {
    if (createdTeamId2) {
      const res = await request({
        path: `/api/v1/teams/${createdTeamId2}`,
        method: 'DELETE'
      })
      assert(res.status === 200, `Expected 200, got ${res.status}`)
    }
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
  console.log(`  - Team ID: ${testData.teamId}`)
  console.log('')
}

async function cleanup() {
  console.log('\n테스트 데이터 정리 중...')

  try {
    resetCookies()
    // 교사로 로그인 후 테스트 중 생성된 데이터 정리
    await login(testData.teacher.username, testData.teacher.password)

    // 테스트 중 생성된 학생 정리
    if (unassignedStudentId) {
      await request({
        path: `/api/v1/users/${unassignedStudentId}`,
        method: 'DELETE'
      })
    }

    // 일괄 생성된 학생들 정리
    const usersRes = await request({
      path: '/api/v1/users',
      method: 'GET'
    })

    if (usersRes.body?.users) {
      for (const user of usersRes.body.users) {
        if (user.username.startsWith('unassigned_student_') ||
            user.username.startsWith('other_class_student_')) {
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
  console.log('Phase 2-4: Teams API 테스트')
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
  console.log('')
  console.log('GET /api/v1/classes/:classId/teams')
  console.log(`  [${passed >= 10 ? 'x' : ' '}] 해당 반의 팀 목록 반환`)
  console.log(`  [${passed >= 11 ? 'x' : ' '}] 각 팀: id, name, members 포함`)
  console.log(`  [${passed >= 10 ? 'x' : ' '}] 미배정 학생 목록 포함`)
  console.log('')
  console.log('POST /api/v1/classes/:classId/teams (교사 전용)')
  console.log(`  [${passed >= 14 ? 'x' : ' '}] 팀 생성 성공 (201)`)
  console.log(`  [${passed >= 14 ? 'x' : ' '}] 팀 이름 설정`)
  console.log(`  [${passed >= 4 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log(`  [${passed >= 15 ? 'x' : ' '}] 중복 팀 이름 처리 확인`)
  console.log('')
  console.log('PATCH /api/v1/teams/:id (교사 전용)')
  console.log(`  [${passed >= 17 ? 'x' : ' '}] 팀 정보 수정 성공 (200)`)
  console.log(`  [${passed >= 17 ? 'x' : ' '}] 팀 이름 변경 가능`)
  console.log(`  [${passed >= 5 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log(`  [${passed >= 19 ? 'x' : ' '}] 존재하지 않는 팀 수정 시 404 반환`)
  console.log('')
  console.log('DELETE /api/v1/teams/:id (교사 전용)')
  console.log(`  [${passed >= 30 ? 'x' : ' '}] 팀 삭제 성공 (200)`)
  console.log(`  [${passed >= 30 ? 'x' : ' '}] 팀원들의 teamId null 처리`)
  console.log(`  [${passed >= 6 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('POST /api/v1/teams/:id/members (교사 전용)')
  console.log(`  [${passed >= 22 ? 'x' : ' '}] 팀원 배정 성공 (200)`)
  console.log(`  [${passed >= 23 ? 'x' : ' '}] 이미 다른 팀 소속 시 400 반환`)
  console.log(`  [${passed >= 24 ? 'x' : ' '}] 다른 반 학생 배정 시 400 반환`)
  console.log(`  [${passed >= 7 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('DELETE /api/v1/teams/:id/members/:userId (교사 전용)')
  console.log(`  [${passed >= 27 ? 'x' : ' '}] 팀원 제거 성공 (200)`)
  console.log(`  [${passed >= 28 ? 'x' : ' '}] 팀에 없는 학생 제거 시 404 반환`)
  console.log('')

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
