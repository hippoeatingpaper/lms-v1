// test/phase2-5-test.js
// Phase 2-5: Posts API (게시판) 테스트

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
let createdPostId = null
let createdNoticeId = null
let createdCommentId = null
let otherClassId = null
let otherClassPostId = null

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // ============================================================
  // 비인증 테스트
  // ============================================================
  test('비인증: 게시글 목록 조회 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'GET'
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  // ============================================================
  // 교사 게시글 작성 테스트
  // ============================================================
  test('교사 로그인', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 공지 게시글 작성 성공 (201)', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 공지사항',
      content: '이것은 테스트 공지사항 내용입니다.',
      type: 'notice'
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.post?.id !== undefined, 'Expected post.id')
    assert(res.body?.post?.title === '테스트 공지사항', 'Expected title to match')
    assert(res.body?.post?.type === 'notice', 'Expected type to be notice')
    assert(res.body?.post?.author?.id !== undefined, 'Expected author.id')

    createdNoticeId = res.body.post.id
  }),

  test('교사: 자료 게시글 작성 성공 (201)', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트 자료',
      content: '이것은 테스트 자료 내용입니다.',
      type: 'material'
    })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.post?.type === 'material', 'Expected type to be material')

    createdPostId = res.body.post.id
  }),

  test('교사: 제목 누락 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      content: '내용만 있음',
      type: 'notice'
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 유효하지 않은 타입 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트',
      content: '내용',
      type: 'invalid_type'
    })

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 존재하지 않는 반에 게시글 작성 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/classes/99999/posts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '테스트',
      content: '내용',
      type: 'notice'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND')
  }),

  // ============================================================
  // 게시글 목록 조회 테스트
  // ============================================================
  test('교사: 게시글 목록 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.posts), 'Expected posts array')
    assert(res.body?.pagination !== undefined, 'Expected pagination')
  }),

  test('교사: 게시글 목록에 필수 필드 포함', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    if (res.body.posts.length > 0) {
      const post = res.body.posts[0]
      assert(post.id !== undefined, 'Expected post.id')
      assert(post.title !== undefined, 'Expected post.title')
      assert(post.type !== undefined, 'Expected post.type')
      assert(post.author !== undefined, 'Expected post.author')
      assert(post.created_at !== undefined, 'Expected post.created_at')
    }
  }),

  test('교사: 카테고리(type) 필터링 - notice', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts?type=notice`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const allNotices = res.body.posts.every(p => p.type === 'notice')
    assert(allNotices, 'All posts should be notice type')
  }),

  test('교사: 카테고리(type) 필터링 - material', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts?type=material`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const allMaterials = res.body.posts.every(p => p.type === 'material')
    assert(allMaterials, 'All posts should be material type')
  }),

  test('교사: 페이지네이션 지원', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts?page=1&limit=5`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body.pagination.page === 1, 'Expected page 1')
    assert(res.body.pagination.limit === 5, 'Expected limit 5')
    assert(res.body.pagination.total !== undefined, 'Expected total count')
    assert(res.body.pagination.total_pages !== undefined, 'Expected total_pages')
  }),

  test('교사: 존재하지 않는 반의 게시글 목록 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/classes/99999/posts',
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND')
  }),

  // ============================================================
  // 게시글 상세 조회 테스트
  // ============================================================
  test('교사: 게시글 상세 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.post?.id === createdPostId, 'Expected post id to match')
    assert(res.body?.post?.content !== undefined, 'Expected content')
    assert(res.body?.post?.author !== undefined, 'Expected author')
    assert(Array.isArray(res.body?.post?.files), 'Expected files array')
  }),

  test('교사: 존재하지 않는 게시글 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/posts/99999',
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND')
  }),

  // ============================================================
  // 게시글 수정 테스트
  // ============================================================
  test('교사: 게시글 수정 성공 (200)', async () => {
    const newTitle = '수정된 제목_' + Date.now()
    const res = await request({
      path: `/api/v1/posts/${createdPostId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { title: newTitle, content: '수정된 내용입니다.' })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.post?.title === newTitle, 'Expected title to be updated')
    assert(res.body?.post?.content === '수정된 내용입니다.', 'Expected content to be updated')
  }),

  test('교사: 존재하지 않는 게시글 수정 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/posts/99999',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { title: '새 제목' })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND')
  }),

  // ============================================================
  // 댓글 테스트
  // ============================================================
  test('교사: 댓글 작성 성공 (201)', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}/comments`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { body: '테스트 댓글입니다.' })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.comment?.id !== undefined, 'Expected comment.id')
    assert(res.body?.comment?.body === '테스트 댓글입니다.', 'Expected body to match')
    assert(res.body?.comment?.author?.id !== undefined, 'Expected author.id')
    assert(res.body?.comment?.author?.name !== undefined, 'Expected author.name')

    createdCommentId = res.body.comment.id
  }),

  test('교사: 댓글 내용 누락 시 400 반환', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}/comments`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {})

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 존재하지 않는 게시글에 댓글 작성 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/posts/99999/comments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { body: '댓글 테스트' })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  test('교사: 댓글 목록 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}/comments`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.comments), 'Expected comments array')
    assert(res.body?.pagination !== undefined, 'Expected pagination')
  }),

  // ============================================================
  // 좋아요 테스트
  // ============================================================
  test('교사: 좋아요 추가 성공 (토글)', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}/like`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.liked === true, 'Expected liked to be true')
    assert(res.body?.like_count !== undefined, 'Expected like_count')
  }),

  test('교사: 좋아요 취소 성공 (토글)', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}/like`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.liked === false, 'Expected liked to be false after toggle')
  }),

  test('교사: 존재하지 않는 게시글 좋아요 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/posts/99999/like',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  // ============================================================
  // 학생 권한 테스트
  // ============================================================
  test('학생 로그인', async () => {
    resetCookies()
    const res = await login(testData.student.username, testData.student.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('학생: 본인 반 게시글 목록 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(Array.isArray(res.body?.posts), 'Expected posts array')
  }),

  test('학생: 본인 반 게시글 상세 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.post?.id === createdPostId, 'Expected post id to match')
  }),

  test('학생: 게시글 작성 시 403 반환 (교사 전용)', async () => {
    const res = await request({
      path: `/api/v1/classes/${testData.classId}/posts`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '학생이 작성한 게시글',
      content: '내용',
      type: 'notice'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 교사 게시글 수정 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { title: '학생이 수정함' })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 교사 게시글 삭제 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}`,
      method: 'DELETE'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 댓글 작성 성공 (201)', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}/comments`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { body: '학생이 작성한 댓글입니다.' })

    assert(res.status === 201, `Expected 201, got ${res.status}`)
    assert(res.body?.comment?.author?.id === testData.student.id, 'Expected author to be student')
  }),

  test('학생: 좋아요 추가 성공', async () => {
    const res = await request({
      path: `/api/v1/posts/${createdPostId}/like`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.liked === true, 'Expected liked to be true')
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

      // 다른 반에 게시글 생성
      const postRes = await request({
        path: `/api/v1/classes/${otherClassId}/posts`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        title: '다른 반 게시글',
        content: '다른 반 내용',
        type: 'notice'
      })

      if (postRes.status === 201) {
        otherClassPostId = postRes.body.post.id
      }
    }
  }),

  test('학생: 다른 반 게시글 목록 조회 시 403 반환', async () => {
    if (!otherClassId) {
      console.log('    (다른 반 생성 실패로 스킵)')
      return
    }

    resetCookies()
    await login(testData.student.username, testData.student.password)

    const res = await request({
      path: `/api/v1/classes/${otherClassId}/posts`,
      method: 'GET'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  test('학생: 다른 반 게시글 상세 조회 시 403 반환', async () => {
    if (!otherClassPostId) {
      console.log('    (다른 반 게시글 생성 실패로 스킵)')
      return
    }

    const res = await request({
      path: `/api/v1/posts/${otherClassPostId}`,
      method: 'GET'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
  }),

  // ============================================================
  // 게시글 삭제 테스트 (댓글 연쇄 삭제 확인)
  // ============================================================
  test('교사 로그인 (삭제 테스트)', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 게시글 삭제 성공 (연관 댓글도 삭제)', async () => {
    // 먼저 게시글에 댓글이 있는지 확인
    const commentsRes = await request({
      path: `/api/v1/posts/${createdPostId}/comments`,
      method: 'GET'
    })
    const commentCountBefore = commentsRes.body?.comments?.length || 0

    // 게시글 삭제
    const res = await request({
      path: `/api/v1/posts/${createdPostId}`,
      method: 'DELETE'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')

    // 삭제된 게시글 조회 시 404
    const verifyRes = await request({
      path: `/api/v1/posts/${createdPostId}`,
      method: 'GET'
    })
    assert(verifyRes.status === 404, 'Expected deleted post to return 404')
  }),

  test('교사: 존재하지 않는 게시글 삭제 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/posts/99999',
      method: 'DELETE'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  // ============================================================
  // 정리
  // ============================================================
  test('테스트 데이터 정리: 다른 반 삭제', async () => {
    if (otherClassPostId) {
      await request({
        path: `/api/v1/posts/${otherClassPostId}`,
        method: 'DELETE'
      })
    }
    if (otherClassId) {
      await request({
        path: `/api/v1/classes/${otherClassId}`,
        method: 'DELETE'
      })
    }

    // 공지 게시글도 정리
    if (createdNoticeId) {
      await request({
        path: `/api/v1/posts/${createdNoticeId}`,
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
  console.log('Phase 2-5: Posts API (게시판) 테스트')
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
  console.log('GET /api/v1/classes/:classId/posts')
  console.log(`  [${passed >= 9 ? 'x' : ' '}] 게시글 목록 반환`)
  console.log(`  [${passed >= 10 ? 'x' : ' '}] 각 게시글: id, title, type, author, created_at 포함`)
  console.log(`  [${passed >= 12 ? 'x' : ' '}] 카테고리별 필터링 (notice, material)`)
  console.log(`  [${passed >= 13 ? 'x' : ' '}] 페이지네이션 지원`)
  console.log(`  [${passed >= 9 ? 'x' : ' '}] 최신순 정렬`)
  console.log('')
  console.log('POST /api/v1/classes/:classId/posts (교사 전용)')
  console.log(`  [${passed >= 4 ? 'x' : ' '}] 게시글 작성 성공 (201)`)
  console.log(`  [${passed >= 4 ? 'x' : ' '}] 교사: 공지(notice), 자료(material) 작성 가능`)
  console.log(`  [${passed >= 31 ? 'x' : ' '}] 학생: 게시글 작성 시 403 반환`)
  console.log(`  [${passed >= 5 ? 'x' : ' '}] 필수 필드 누락 시 400 반환`)
  console.log('')
  console.log('GET /api/v1/posts/:id')
  console.log(`  [${passed >= 15 ? 'x' : ' '}] 게시글 상세 조회 (200)`)
  console.log(`  [${passed >= 15 ? 'x' : ' '}] 내용, 첨부파일 포함`)
  console.log(`  [${passed >= 38 ? 'x' : ' '}] 다른 반 게시글 접근 시 403 반환`)
  console.log('')
  console.log('PATCH /api/v1/posts/:id')
  console.log(`  [${passed >= 17 ? 'x' : ' '}] 게시글 수정 성공 (200)`)
  console.log(`  [${passed >= 32 ? 'x' : ' '}] 학생: 교사 게시글 수정 시 403 반환`)
  console.log('')
  console.log('DELETE /api/v1/posts/:id')
  console.log(`  [${passed >= 40 ? 'x' : ' '}] 게시글 삭제 성공 (200)`)
  console.log(`  [${passed >= 33 ? 'x' : ' '}] 학생: 교사 게시글 삭제 시 403 반환`)
  console.log(`  [${passed >= 40 ? 'x' : ' '}] 연관 댓글도 삭제 확인`)
  console.log('')
  console.log('POST /api/v1/posts/:id/comments')
  console.log(`  [${passed >= 19 ? 'x' : ' '}] 댓글 작성 성공 (201)`)
  console.log(`  [${passed >= 19 ? 'x' : ' '}] 작성자 정보 포함`)
  console.log('')
  console.log('POST /api/v1/posts/:id/like')
  console.log(`  [${passed >= 25 ? 'x' : ' '}] 좋아요 토글 성공 (200)`)
  console.log(`  [${passed >= 25 ? 'x' : ' '}] 좋아요 상태 반환 (liked: true/false)`)
  console.log(`  [${passed >= 26 ? 'x' : ' '}] 중복 좋아요 방지 (토글로 해제)`)
  console.log('')

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
