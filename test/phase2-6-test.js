// test/phase2-6-test.js
// Phase 2-6: Assignments API (과제 출제) 테스트

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

// 생성된 테스트 데이터 ID 추적
let createdAssignmentId = null
let createdTeamAssignmentId = null
let otherClassId = null
let otherClassAssignmentId = null

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // ============================================================
  // 비인증 테스트
  // ============================================================
  test('비인증: 과제 목록 조회 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/assignments`,
      method: 'GET'
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('비인증: 과제 출제 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 과제',
      scope: 'individual',
      class_id: testData.classId,
      questions: [{ question_type: 'essay', body: '질문1' }]
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  // ============================================================
  // 교사 과제 출제 테스트
  // ============================================================
  test('교사 로그인', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 개인 과제 출제 성공 (201)', async () => {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)

    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 개인 과제',
      description: '이것은 테스트 개인 과제입니다.',
      scope: 'individual',
      class_id: testData.classId,
      due_at: dueDate.toISOString(),
      questions: [
        {
          order_num: 1,
          question_type: 'essay',
          body: '환경 문제의 원인을 서술하시오.',
          required: true
        },
        {
          order_num: 2,
          question_type: 'short',
          body: '가장 심각한 환경 문제는 무엇인가요?',
          required: true
        }
      ]
    })

    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`)
    assert(res.body?.assignment?.id !== undefined, 'Expected assignment.id')
    assert(res.body?.assignment?.title === '테스트 개인 과제', 'Expected title to match')
    assert(res.body?.assignment?.scope === 'individual', 'Expected scope to be individual')
    assert(res.body?.assignment?.author?.id !== undefined, 'Expected author.id')
    assert(Array.isArray(res.body?.questions), 'Expected questions array')
    assert(res.body?.questions?.length === 2, 'Expected 2 questions')

    createdAssignmentId = res.body.assignment.id
  }),

  test('교사: 팀 과제 출제 성공 (201)', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 팀 과제',
      description: '팀 협업 과제입니다.',
      scope: 'team',
      class_id: testData.classId,
      questions: [
        {
          order_num: 1,
          question_type: 'essay',
          body: '팀 프로젝트 계획을 작성하시오.',
          required: true
        }
      ]
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.assignment?.scope === 'team', 'Expected scope to be team')

    createdTeamAssignmentId = res.body.assignment.id
  }),

  test('교사: 객관식 질문 포함 과제 출제 성공', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '객관식 포함 과제',
      scope: 'individual',
      class_id: testData.classId,
      questions: [
        {
          order_num: 1,
          question_type: 'multiple_choice',
          body: '가장 심각한 문제는?',
          options: ['대기오염', '수질오염', '토양오염'],
          required: true
        }
      ]
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.questions?.[0]?.question_type === 'multiple_choice', 'Expected multiple_choice type')
    assert(Array.isArray(res.body?.questions?.[0]?.options), 'Expected options array')

    // 정리를 위해 삭제
    await request({
      path: `/api/v1/assignments/${res.body.assignment.id}`,
      method: 'DELETE'
    })
  }),

  test('교사: 제목 누락 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      scope: 'individual',
      class_id: testData.classId,
      questions: [{ question_type: 'essay', body: '질문' }]
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 질문 누락 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 과제',
      scope: 'individual',
      class_id: testData.classId,
      questions: []
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 유효하지 않은 scope 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 과제',
      scope: 'invalid_scope',
      class_id: testData.classId,
      questions: [{ question_type: 'essay', body: '질문' }]
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 존재하지 않는 반에 과제 출제 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 과제',
      scope: 'individual',
      class_id: 99999,
      questions: [{ question_type: 'essay', body: '질문' }]
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 유효하지 않은 질문 타입 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 과제',
      scope: 'individual',
      class_id: testData.classId,
      questions: [{ question_type: 'invalid_type', body: '질문' }]
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 객관식 선택지 부족 시 400 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 과제',
      scope: 'individual',
      class_id: testData.classId,
      questions: [{
        question_type: 'multiple_choice',
        body: '질문',
        options: ['선택지1']  // 최소 2개 필요
      }]
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  // ============================================================
  // 과제 목록 조회 테스트
  // ============================================================
  test('교사: 과제 목록 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/assignments`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.assignments), 'Expected assignments array')
    assert(res.body?.pagination !== undefined, 'Expected pagination')
  }),

  test('교사: 과제 목록에 필수 필드 포함', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/assignments`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    if (res.body.assignments.length > 0) {
      const assignment = res.body.assignments[0]
      assert(assignment.id !== undefined, 'Expected id')
      assert(assignment.title !== undefined, 'Expected title')
      assert(assignment.scope !== undefined, 'Expected scope')
      assert(assignment.author !== undefined, 'Expected author')
      assert(assignment.created_at !== undefined, 'Expected created_at')
    }
  }),

  test('교사: scope 필터링 - individual', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/assignments?scope=individual`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const allIndividual = res.body.assignments.every(a => a.scope === 'individual')
    assert(allIndividual, 'All assignments should be individual scope')
  }),

  test('교사: scope 필터링 - team', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/assignments?scope=team`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const allTeam = res.body.assignments.every(a => a.scope === 'team')
    assert(allTeam, 'All assignments should be team scope')
  }),

  test('교사: 페이지네이션 지원', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/assignments?page=1&limit=5`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body.pagination.page === 1, 'Expected page 1')
    assert(res.body.pagination.limit === 5, 'Expected limit 5')
    assert(res.body.pagination.total !== undefined, 'Expected total count')
    assert(res.body.pagination.total_pages !== undefined, 'Expected total_pages')
  }),

  test('교사: 존재하지 않는 반의 과제 목록 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/classes/99999/assignments',
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND')
  }),

  // ============================================================
  // 과제 상세 조회 테스트
  // ============================================================
  test('교사: 과제 상세 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.assignment?.id === createdAssignmentId, 'Expected assignment id to match')
    assert(res.body?.assignment?.title !== undefined, 'Expected title')
    assert(res.body?.assignment?.description !== undefined, 'Expected description')
    assert(res.body?.assignment?.author !== undefined, 'Expected author')
    assert(Array.isArray(res.body?.questions), 'Expected questions array')
  }),

  test('교사: 존재하지 않는 과제 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments/99999',
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND')
  }),

  // ============================================================
  // 과제 수정 테스트
  // ============================================================
  test('교사: 과제 제목 수정 성공 (200)', async () => {
    const newTitle = '수정된 과제 제목_' + Date.now()
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { title: newTitle })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.assignment?.title === newTitle, 'Expected title to be updated')
  }),

  test('교사: 과제 마감일 연장 성공', async () => {
    const newDueDate = new Date()
    newDueDate.setDate(newDueDate.getDate() + 14)

    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { due_at: newDueDate.toISOString() })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.assignment?.due_at !== null, 'Expected due_at to be updated')
  }),

  test('교사: 과제 설명 수정 성공', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { description: '수정된 설명입니다.' })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.assignment?.description === '수정된 설명입니다.', 'Expected description to be updated')
  }),

  test('교사: 존재하지 않는 과제 수정 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments/99999',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { title: '새 제목' })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND')
  }),

  test('교사: 빈 제목으로 수정 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { title: '   ' })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  // ============================================================
  // 학생 권한 테스트
  // ============================================================
  test('학생 로그인', async () => {
    resetCookies()
    const res = await login(testData.student.username, testData.student.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('학생: 본인 반 과제 목록 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/assignments`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.assignments), 'Expected assignments array')
  }),

  test('학생: 과제 목록에 제출 상태(submission_status) 포함', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/assignments`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    if (res.body.assignments.length > 0) {
      const assignment = res.body.assignments[0]
      assert('submission_status' in assignment, 'Expected submission_status field for student')
    }
  }),

  test('학생: 본인 반 과제 상세 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.assignment?.id === createdAssignmentId, 'Expected assignment id to match')
    // 학생은 submission과 answers 필드가 포함됨
    assert('submission' in res.body, 'Expected submission field for student')
    assert('answers' in res.body, 'Expected answers field for student')
  }),

  test('학생: 과제 출제 시 403 반환 (교사 전용)', async () => {
    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '학생이 출제한 과제',
      scope: 'individual',
      class_id: testData.classId,
      questions: [{ question_type: 'essay', body: '질문' }]
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 과제 수정 시 403 반환 (교사 전용)', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { title: '학생이 수정함' })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 과제 삭제 시 403 반환 (교사 전용)', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'DELETE'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 다른 반 접근 권한 테스트
  // ============================================================
  test('다른 반 생성 (접근 권한 테스트용)', async () => {
    resetCookies()
    await login(testData.teacher.username, testData.teacher.password)

    const classRes = await request({
      path: '/api/v1/classes',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: '다른반_' + Date.now() })

    if (classRes.status === 201) {
      otherClassId = classRes.body.class.id

      // 다른 반에 과제 생성
      const assignmentRes = await request({
        path: '/api/v1/assignments',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        title: '다른 반 과제',
        scope: 'individual',
        class_id: otherClassId,
        questions: [{ question_type: 'essay', body: '다른 반 질문' }]
      })

      if (assignmentRes.status === 201) {
        otherClassAssignmentId = assignmentRes.body.assignment.id
      }
    }
  }),

  test('학생: 다른 반 과제 목록 조회 시 403 반환', async () => {
    if (!otherClassId) {
      console.log('    (다른 반 생성 실패로 스킵)')
      return
    }

    resetCookies()
    await login(testData.student.username, testData.student.password)

    const res = await request({
      path: `/api/v1/classes/${otherClassId}/assignments`,
      method: 'GET'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 다른 반 과제 상세 조회 시 403 반환', async () => {
    if (!otherClassAssignmentId) {
      console.log('    (다른 반 과제 생성 실패로 스킵)')
      return
    }

    const res = await request({
      path: `/api/v1/assignments/${otherClassAssignmentId}`,
      method: 'GET'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 과제 삭제 테스트
  // ============================================================
  test('교사 로그인 (삭제 테스트)', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 과제 삭제 성공 (200)', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'DELETE'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')

    // 삭제된 과제 조회 시 404
    const verifyRes = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'GET'
    })
    assert(verifyRes.status === 404, 'Expected deleted assignment to return 404')
  }),

  test('교사: 팀 과제 삭제 성공', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdTeamAssignmentId}`,
      method: 'DELETE'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')
  }),

  test('교사: 존재하지 않는 과제 삭제 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments/99999',
      method: 'DELETE'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  // ============================================================
  // 정리
  // ============================================================
  test('테스트 데이터 정리: 다른 반 삭제', async () => {
    if (otherClassAssignmentId) {
      await request({
        path: `/api/v1/assignments/${otherClassAssignmentId}`,
        method: 'DELETE'
      })
    }
    if (otherClassId) {
      await request({
        path: `/api/v1/classes/${otherClassId}`,
        method: 'DELETE'
      })
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
  console.log('')
}

async function cleanup() {
  console.log('\n테스트 데이터 정리 중...')

  try {
    resetCookies()
    // 기본 테스트 데이터 정리
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
  console.log('Phase 2-6: Assignments API (과제 출제) 테스트')
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
  console.log('GET /api/v1/classes/:classId/assignments')
  console.log(`  [${passed >= 14 ? 'x' : ' '}] 과제 목록 반환`)
  console.log(`  [${passed >= 15 ? 'x' : ' '}] 각 과제: id, title, scope, author 포함`)
  console.log(`  [${passed >= 17 ? 'x' : ' '}] scope별 필터링 (individual/team)`)
  console.log(`  [${passed >= 18 ? 'x' : ' '}] 페이지네이션 지원`)
  console.log(`  [${passed >= 30 ? 'x' : ' '}] 학생: 제출 상태 포함`)
  console.log('')
  console.log('POST /api/v1/assignments (교사 전용)')
  console.log(`  [${passed >= 4 ? 'x' : ' '}] 과제 출제 성공 (201)`)
  console.log(`  [${passed >= 5 ? 'x' : ' '}] 개인/팀 과제 타입 설정`)
  console.log(`  [${passed >= 4 ? 'x' : ' '}] 마감일 설정`)
  console.log(`  [${passed >= 6 ? 'x' : ' '}] 객관식 질문 포함 가능`)
  console.log(`  [${passed >= 33 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('GET /api/v1/assignments/:id')
  console.log(`  [${passed >= 20 ? 'x' : ' '}] 과제 상세 조회 (200)`)
  console.log(`  [${passed >= 20 ? 'x' : ' '}] 설명, 질문 목록 포함`)
  console.log(`  [${passed >= 31 ? 'x' : ' '}] 학생: 자신의 제출 정보 포함`)
  console.log(`  [${passed >= 39 ? 'x' : ' '}] 다른 반 과제 접근 시 403 반환`)
  console.log('')
  console.log('PUT /api/v1/assignments/:id (교사 전용)')
  console.log(`  [${passed >= 22 ? 'x' : ' '}] 과제 수정 성공 (200)`)
  console.log(`  [${passed >= 23 ? 'x' : ' '}] 마감일 연장 가능`)
  console.log(`  [${passed >= 34 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('DELETE /api/v1/assignments/:id (교사 전용)')
  console.log(`  [${passed >= 41 ? 'x' : ' '}] 과제 삭제 성공 (200)`)
  console.log(`  [${passed >= 35 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
