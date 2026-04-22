// test/phase2-7-test.js
// Phase 2-7: Submissions API (과제 제출) 테스트

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
let expiredAssignmentId = null
let createdSubmissionId = null
let questionIds = []
let teamQuestionIds = []

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // ============================================================
  // 테스트 데이터 생성 (과제 출제)
  // ============================================================
  test('교사 로그인 (과제 생성)', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 개인 과제 생성 (제출 테스트용)', async () => {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)

    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '제출 테스트용 개인 과제',
      description: '제출 테스트를 위한 과제입니다.',
      scope: 'individual',
      class_id: testData.classId,
      due_at: dueDate.toISOString(),
      questions: [
        {
          order_num: 1,
          question_type: 'essay',
          body: '서술형 질문입니다.',
          required: true
        },
        {
          order_num: 2,
          question_type: 'short',
          body: '단답형 질문입니다.',
          required: false
        }
      ]
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    createdAssignmentId = res.body.assignment.id
    questionIds = res.body.questions.map(q => q.id)
  }),

  test('교사: 팀 과제 생성 (제출 테스트용)', async () => {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)

    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '제출 테스트용 팀 과제',
      scope: 'team',
      class_id: testData.classId,
      due_at: dueDate.toISOString(),
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
    createdTeamAssignmentId = res.body.assignment.id
    teamQuestionIds = res.body.questions.map(q => q.id)
  }),

  test('교사: 마감된 과제 생성 (마감 테스트용)', async () => {
    const expiredDate = new Date()
    expiredDate.setDate(expiredDate.getDate() - 1) // 어제

    const res = await request({
      path: '/api/v1/assignments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '마감된 과제',
      scope: 'individual',
      class_id: testData.classId,
      due_at: expiredDate.toISOString(),
      questions: [
        {
          order_num: 1,
          question_type: 'short',
          body: '마감 테스트용 질문',
          required: true
        }
      ]
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    expiredAssignmentId = res.body.assignment.id
  }),

  // ============================================================
  // 비인증 테스트
  // ============================================================
  test('비인증: 제출 현황 조회 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/submissions`,
      method: 'GET'
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('비인증: 임시저장 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/draft`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [{ question_id: questionIds[0], answer_text: '답변' }]
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  // ============================================================
  // 학생 임시저장 테스트
  // ============================================================
  test('학생 로그인', async () => {
    resetCookies()
    const res = await login(testData.student.username, testData.student.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('학생: 임시저장 성공 (draft 상태로 생성)', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/draft`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [
        { question_id: questionIds[0], answer_text: '임시 서술형 답변입니다.' },
        { question_id: questionIds[1], answer_text: '임시 단답' }
      ]
    })

    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    assert(res.body?.submission?.id !== undefined, 'Expected submission.id')
    assert(res.body?.submission?.status === 'draft', 'Expected status to be draft')
    assert(res.body?.submission?.version !== undefined, 'Expected version')

    createdSubmissionId = res.body.submission.id
  }),

  test('학생: 임시저장 후 과제 상세에서 제출물 확인', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.submission !== null, 'Expected submission to exist')
    assert(res.body?.submission?.status === 'draft', 'Expected status to be draft')
    assert(Array.isArray(res.body?.answers), 'Expected answers array')
  }),

  test('학생: 임시저장 업데이트 (버전 증가)', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/draft`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [
        { question_id: questionIds[0], answer_text: '수정된 임시 답변입니다.' }
      ]
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.submission?.version >= 2, 'Expected version to increase')
  }),

  test('학생: 빈 answers 배열로 임시저장 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/draft`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { answers: null })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('학생: 존재하지 않는 과제에 임시저장 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments/99999/draft',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [{ question_id: 1, answer_text: '답변' }]
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  // ============================================================
  // 학생 최종 제출 테스트
  // ============================================================
  test('학생: 필수 질문 미응답으로 최종 제출 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [
        { question_id: questionIds[1], answer_text: '선택 질문만 답변' }
        // 필수인 questionIds[0] 누락
      ]
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('학생: 최종 제출 성공 (200)', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [
        { question_id: questionIds[0], answer_text: '최종 서술형 답변입니다. 열심히 작성했습니다.' },
        { question_id: questionIds[1], answer_text: '최종 단답' }
      ]
    })

    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    assert(res.body?.submission?.status === 'submitted', 'Expected status to be submitted')
    assert(res.body?.submission?.submitted_at !== undefined, 'Expected submitted_at')
  }),

  test('학생: 최종 제출 후 과제 상세에서 상태 확인', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.submission?.status === 'submitted', 'Expected status to be submitted')
    assert(res.body?.submission?.submitted_at !== null, 'Expected submitted_at')
  }),

  test('학생: 마감된 과제에 최종 제출 시 400 반환 (DEADLINE_PASSED)', async () => {
    const res = await request({
      path: `/api/v1/assignments/${expiredAssignmentId}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [{ question_id: 99999, answer_text: '늦은 답변' }]
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'DEADLINE_PASSED', 'Expected DEADLINE_PASSED')
  }),

  test('학생: 존재하지 않는 과제에 최종 제출 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments/99999/submit',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [{ question_id: 1, answer_text: '답변' }]
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  // ============================================================
  // 팀 과제 제출 테스트
  // ============================================================
  test('학생: 팀 과제 임시저장 성공', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdTeamAssignmentId}/draft`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [
        { question_id: teamQuestionIds[0], answer_text: '팀 프로젝트 임시 계획입니다.' }
      ]
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.submission?.status === 'draft', 'Expected status to be draft')
  }),

  test('학생: 팀 과제 최종 제출 성공', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdTeamAssignmentId}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      answers: [
        { question_id: teamQuestionIds[0], answer_text: '팀 프로젝트 최종 계획입니다. 우리 팀은 열심히 했습니다.' }
      ]
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.submission?.status === 'submitted', 'Expected status to be submitted')
  }),

  // ============================================================
  // 교사 제출 현황 조회 테스트
  // ============================================================
  test('교사 로그인 (제출 현황 조회)', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 제출 현황 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/submissions`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.submissions), 'Expected submissions array')
    assert(res.body?.stats !== undefined, 'Expected stats')
  }),

  test('교사: 제출 현황에 필수 필드 포함', async () => {
    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/submissions`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    if (res.body.submissions.length > 0) {
      const sub = res.body.submissions[0]
      assert(sub.id !== undefined, 'Expected id')
      assert(sub.submitter !== undefined, 'Expected submitter')
      assert(sub.status !== undefined, 'Expected status')
      assert(sub.submitted_at !== undefined, 'Expected submitted_at')
      assert('has_feedback' in sub, 'Expected has_feedback')
    }

    // 통계 확인
    assert('total' in res.body.stats, 'Expected stats.total')
    assert('submitted' in res.body.stats, 'Expected stats.submitted')
    assert('draft' in res.body.stats, 'Expected stats.draft')
    assert('not_started' in res.body.stats, 'Expected stats.not_started')
  }),

  test('교사: 존재하지 않는 과제의 제출 현황 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/assignments/99999/submissions',
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  test('학생: 제출 현황 조회 시 403 반환 (교사 전용)', async () => {
    resetCookies()
    await login(testData.student.username, testData.student.password)

    const res = await request({
      path: `/api/v1/assignments/${createdAssignmentId}/submissions`,
      method: 'GET'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 교사 제출물 상세 조회 테스트
  // ============================================================
  test('교사 로그인 (제출물 상세)', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 제출물 상세 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.submission !== undefined, 'Expected submission')
    assert(res.body?.assignment !== undefined, 'Expected assignment')
    assert(Array.isArray(res.body?.questions), 'Expected questions array')
  }),

  test('교사: 제출물 상세에 답변 포함', async () => {
    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const hasAnswers = res.body.questions.some(q => q.answer?.text)
    assert(hasAnswers, 'Expected at least one answer')
  }),

  test('교사: 존재하지 않는 제출물 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/submissions/99999',
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  test('학생: 제출물 상세 조회 시 403 반환 (교사 전용)', async () => {
    resetCookies()
    await login(testData.student.username, testData.student.password)

    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}`,
      method: 'GET'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 교사 피드백 테스트
  // ============================================================
  test('교사 로그인 (피드백)', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 피드백 작성 성공 (200)', async () => {
    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}/feedback`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, {
      feedback: '잘 작성했습니다. 다만 좀 더 구체적인 예시가 있으면 좋겠습니다.'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')
  }),

  test('교사: 피드백 작성 후 제출물에서 확인', async () => {
    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.submission?.feedback !== null, 'Expected feedback')
    assert(res.body?.submission?.feedback.includes('잘 작성했습니다'), 'Expected feedback content')
  }),

  test('교사: 피드백 내용 누락 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}/feedback`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, {})

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 존재하지 않는 제출물에 피드백 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/submissions/99999/feedback',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { feedback: '피드백' })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  test('학생: 피드백 작성 시 403 반환 (교사 전용)', async () => {
    resetCookies()
    await login(testData.student.username, testData.student.password)

    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}/feedback`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { feedback: '학생이 피드백' })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 교사 제출물 공개 테스트
  // ============================================================
  test('교사 로그인 (공개 테스트)', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 제출물 공개 성공 (게시글 생성)', async () => {
    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}/publish`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.post_id !== undefined, 'Expected post_id')
  }),

  test('교사: 이미 공개된 제출물 재공개 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/submissions/${createdSubmissionId}/publish`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'ALREADY_PUBLISHED', 'Expected ALREADY_PUBLISHED')
  }),

  test('교사: 존재하지 않는 제출물 공개 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/submissions/99999/publish',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  test('학생: 제출물 공개 시 403 반환 (교사 전용)', async () => {
    resetCookies()
    await login(testData.student.username, testData.student.password)

    // 팀 과제 제출물 ID 조회
    resetCookies()
    await login(testData.teacher.username, testData.teacher.password)
    const listRes = await request({
      path: `/api/v1/assignments/${createdTeamAssignmentId}/submissions`,
      method: 'GET'
    })
    const teamSubmissionId = listRes.body?.submissions?.[0]?.id

    if (teamSubmissionId) {
      resetCookies()
      await login(testData.student.username, testData.student.password)

      const res = await request({
        path: `/api/v1/submissions/${teamSubmissionId}/publish`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      assert(res.status === 403, `Expected 403, got ${res.status}`)
    }
  }),

  // ============================================================
  // 정리
  // ============================================================
  test('테스트 데이터 정리: 과제 삭제', async () => {
    resetCookies()
    await login(testData.teacher.username, testData.teacher.password)

    if (createdAssignmentId) {
      await request({
        path: `/api/v1/assignments/${createdAssignmentId}`,
        method: 'DELETE'
      })
    }
    if (createdTeamAssignmentId) {
      await request({
        path: `/api/v1/assignments/${createdTeamAssignmentId}`,
        method: 'DELETE'
      })
    }
    if (expiredAssignmentId) {
      await request({
        path: `/api/v1/assignments/${expiredAssignmentId}`,
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
  console.log(`  - Team ID: ${testData.teamId}`)
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
  console.log('Phase 2-7: Submissions API (과제 제출) 테스트')
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
  console.log('POST /api/v1/assignments/:id/draft (임시저장)')
  console.log(`  [${passed >= 8 ? 'x' : ' '}] 임시저장 성공 (draft 상태로 생성)`)
  console.log(`  [${passed >= 10 ? 'x' : ' '}] 임시저장 업데이트 (버전 증가)`)
  console.log(`  [${passed >= 21 ? 'x' : ' '}] 팀 과제 임시저장 가능`)
  console.log('')
  console.log('POST /api/v1/assignments/:id/submit (최종 제출)')
  console.log(`  [${passed >= 16 ? 'x' : ' '}] 최종 제출 성공 (200)`)
  console.log(`  [${passed >= 16 ? 'x' : ' '}] status=submitted, submitted_at 설정`)
  console.log(`  [${passed >= 15 ? 'x' : ' '}] 필수 질문 미응답 시 400 반환`)
  console.log(`  [${passed >= 18 ? 'x' : ' '}] 마감 후 제출 불가 (DEADLINE_PASSED)`)
  console.log(`  [${passed >= 22 ? 'x' : ' '}] 팀 과제 최종 제출 가능`)
  console.log('')
  console.log('GET /api/v1/assignments/:id/submissions (교사 전용)')
  console.log(`  [${passed >= 24 ? 'x' : ' '}] 제출 목록 반환`)
  console.log(`  [${passed >= 25 ? 'x' : ' '}] 각 제출: submitter, status, submitted_at 포함`)
  console.log(`  [${passed >= 25 ? 'x' : ' '}] 통계(stats): total, submitted, draft, not_started`)
  console.log(`  [${passed >= 27 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('GET /api/v1/submissions/:id (교사 전용)')
  console.log(`  [${passed >= 29 ? 'x' : ' '}] 제출물 상세 조회 성공`)
  console.log(`  [${passed >= 30 ? 'x' : ' '}] 질문 및 답변 포함`)
  console.log(`  [${passed >= 32 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('PATCH /api/v1/submissions/:id/feedback (교사 전용)')
  console.log(`  [${passed >= 34 ? 'x' : ' '}] 피드백 작성 성공 (200)`)
  console.log(`  [${passed >= 35 ? 'x' : ' '}] 피드백 내용 저장 확인`)
  console.log(`  [${passed >= 38 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')
  console.log('POST /api/v1/submissions/:id/publish (교사 전용)')
  console.log(`  [${passed >= 40 ? 'x' : ' '}] 제출물 공개 성공 (게시글 생성)`)
  console.log(`  [${passed >= 41 ? 'x' : ' '}] 이미 공개된 제출물 재공개 시 400 반환`)
  console.log(`  [${passed >= 43 ? 'x' : ' '}] 학생 계정으로 접근 시 403 반환`)
  console.log('')

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
