// test/phase2-8-test.js
// Phase 2-8: Files API (파일 업로드) 테스트

import http from 'http'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

// Multipart form-data 요청 헬퍼
function multipartRequest(options, fields, fileField) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
    const headers = {
      ...options.headers,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    }

    if (Object.keys(cookies).length > 0) {
      const cookieStr = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
      headers['Cookie'] = cookieStr
    }

    let body = ''

    // 일반 필드 추가
    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\n`
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`
      body += `${value}\r\n`
    }

    // 파일 필드 추가
    if (fileField) {
      body += `--${boundary}\r\n`
      body += `Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\n`
      body += `Content-Type: ${fileField.contentType}\r\n\r\n`
    }

    const bodyStart = Buffer.from(body, 'utf-8')
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')

    let totalLength = bodyStart.length + bodyEnd.length
    if (fileField) {
      totalLength += fileField.content.length
    }

    headers['Content-Length'] = totalLength

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
    req.write(bodyStart)
    if (fileField) {
      req.write(fileField.content)
    }
    req.write(bodyEnd)
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

// 테스트용 파일 생성
function createTestFile(type) {
  switch (type) {
    case 'pdf':
      // 간단한 PDF 시그니처
      return {
        content: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
        filename: 'test.pdf',
        contentType: 'application/pdf'
      }
    case 'png':
      // PNG 시그니처
      return {
        content: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]),
        filename: 'test.png',
        contentType: 'image/png'
      }
    case 'jpg':
      // JPEG 시그니처
      return {
        content: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]),
        filename: 'test.jpg',
        contentType: 'image/jpeg'
      }
    case 'zip':
      // ZIP 시그니처
      return {
        content: Buffer.from([0x50, 0x4B, 0x03, 0x04]),
        filename: 'test.zip',
        contentType: 'application/zip'
      }
    case 'txt':
      // 텍스트 파일 (허용되지 않음)
      return {
        content: Buffer.from('This is a text file'),
        filename: 'test.txt',
        contentType: 'text/plain'
      }
    case 'exe':
      // EXE 시그니처 (허용되지 않음)
      return {
        content: Buffer.from([0x4D, 0x5A]),
        filename: 'test.exe',
        contentType: 'application/x-msdownload'
      }
    case 'js':
      // JavaScript (허용되지 않음)
      return {
        content: Buffer.from('console.log("hello");'),
        filename: 'test.js',
        contentType: 'application/javascript'
      }
    default:
      return {
        content: Buffer.from('test content'),
        filename: 'test.dat',
        contentType: 'application/octet-stream'
      }
  }
}

// 생성된 테스트 데이터 ID 추적
let uploadedFileId = null
let uploadedFileId2 = null
let otherClassFileId = null

// ============================================================
// 테스트 케이스
// ============================================================

const tests = [
  // ============================================================
  // 비인증 테스트
  // ============================================================
  test('비인증: 파일 업로드 시 401 반환', async () => {
    resetCookies()
    const file = createTestFile('pdf')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  test('비인증: 파일 정보 조회 시 401 반환', async () => {
    resetCookies()
    const res = await request({
      path: '/api/v1/files/1',
      method: 'GET'
    })
    assert(res.status === 401, `Expected 401, got ${res.status}`)
  }),

  // ============================================================
  // 교사 파일 업로드 테스트
  // ============================================================
  test('교사 로그인', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: PDF 파일 업로드 성공', async () => {
    const file = createTestFile('pdf')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )

    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    assert(res.body?.file?.id !== undefined, 'Expected file.id')
    assert(res.body?.file?.original_name === 'test.pdf', 'Expected original_name')
    assert(res.body?.file?.size !== undefined, 'Expected size')
    assert(res.body?.file?.url !== undefined, 'Expected url')

    uploadedFileId = res.body.file.id
  }),

  test('교사: PNG 이미지 업로드 성공', async () => {
    const file = createTestFile('png')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.file?.id !== undefined, 'Expected file.id')

    uploadedFileId2 = res.body.file.id
  }),

  test('교사: JPEG 이미지 업로드 성공', async () => {
    const file = createTestFile('jpg')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.file?.id !== undefined, 'Expected file.id')
  }),

  test('교사: ZIP 파일 업로드 성공', async () => {
    const file = createTestFile('zip')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.file?.id !== undefined, 'Expected file.id')
  }),

  test('교사: 파일 없이 업로드 시 400 반환', async () => {
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      null
    )

    assert(res.status === 400, `Expected 400, got ${res.status}`)
  }),

  test('교사: context 없이 업로드 시 400 반환', async () => {
    const file = createTestFile('pdf')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      {},
      { name: 'file', ...file }
    )

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  test('교사: 유효하지 않은 context 시 400 반환', async () => {
    const file = createTestFile('pdf')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'invalid' },
      { name: 'file', ...file }
    )

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR')
  }),

  // ============================================================
  // MIME 타입 검증 테스트
  // ============================================================
  test('교사: 텍스트 파일 업로드 거부 (400)', async () => {
    const file = createTestFile('txt')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'INVALID_FILE_TYPE', 'Expected INVALID_FILE_TYPE')
  }),

  test('교사: JavaScript 파일 업로드 거부 (400)', async () => {
    const file = createTestFile('js')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )

    assert(res.status === 400, `Expected 400, got ${res.status}`)
    assert(res.body?.error?.code === 'INVALID_FILE_TYPE', 'Expected INVALID_FILE_TYPE')
  }),

  // ============================================================
  // 파일 정보 조회 테스트
  // ============================================================
  test('교사: 파일 정보 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/files/${uploadedFileId}`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.file?.id === uploadedFileId, 'Expected file id to match')
    assert(res.body?.file?.original_name !== undefined, 'Expected original_name')
    assert(res.body?.file?.mimetype !== undefined, 'Expected mimetype')
    assert(res.body?.file?.size !== undefined, 'Expected size')
    assert(res.body?.file?.uploader !== undefined, 'Expected uploader')
    assert(res.body?.file?.url !== undefined, 'Expected url')
  }),

  test('교사: 존재하지 않는 파일 조회 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/files/99999',
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
    assert(res.body?.error?.code === 'NOT_FOUND', 'Expected NOT_FOUND')
  }),

  // ============================================================
  // 파일 다운로드 테스트
  // ============================================================
  test('교사: 파일 다운로드 성공 (200)', async () => {
    const res = await request({
      path: `/api/v1/files/${uploadedFileId}/download`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.headers['content-disposition'] !== undefined, 'Expected Content-Disposition header')
  }),

  test('교사: 존재하지 않는 파일 다운로드 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/files/99999/download',
      method: 'GET'
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

  test('학생: 파일 업로드 성공 (general context)', async () => {
    const file = createTestFile('pdf')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.file?.id !== undefined, 'Expected file.id')
  }),

  test('학생: 본인 반 파일 정보 조회 성공', async () => {
    const res = await request({
      path: `/api/v1/files/${uploadedFileId}`,
      method: 'GET'
    })

    // 교사가 업로드한 파일은 class_id가 null이므로 접근 가능
    assert(res.status === 200, `Expected 200, got ${res.status}`)
  }),

  test('학생: 파일 다운로드 성공', async () => {
    const res = await request({
      path: `/api/v1/files/${uploadedFileId}/download`,
      method: 'GET'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
  }),

  // ============================================================
  // 파일 삭제 테스트
  // ============================================================
  test('학생: 다른 사용자 파일 삭제 시 403 반환', async () => {
    const res = await request({
      path: `/api/v1/files/${uploadedFileId}`,
      method: 'DELETE'
    })

    assert(res.status === 403, `Expected 403, got ${res.status}`)
    assert(res.body?.error?.code === 'FORBIDDEN', 'Expected FORBIDDEN')
  }),

  test('교사 로그인 (삭제 테스트)', async () => {
    resetCookies()
    const res = await login(testData.teacher.username, testData.teacher.password)
    assert(res.status === 200, `Login failed: ${res.status}`)
  }),

  test('교사: 파일 삭제 성공 (200)', async () => {
    const res = await request({
      path: `/api/v1/files/${uploadedFileId}`,
      method: 'DELETE'
    })

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.body?.ok === true, 'Expected ok: true')
  }),

  test('교사: 삭제된 파일 조회 시 404 반환', async () => {
    const res = await request({
      path: `/api/v1/files/${uploadedFileId}`,
      method: 'GET'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  test('교사: 존재하지 않는 파일 삭제 시 404 반환', async () => {
    const res = await request({
      path: '/api/v1/files/99999',
      method: 'DELETE'
    })

    assert(res.status === 404, `Expected 404, got ${res.status}`)
  }),

  // ============================================================
  // 타임스탬프 파일명 테스트
  // ============================================================
  test('교사: 업로드 시 타임스탬프 prefix 파일명 확인', async () => {
    const file = createTestFile('pdf')
    const res = await multipartRequest(
      { path: '/api/v1/files', method: 'POST' },
      { context: 'general' },
      { name: 'file', ...file }
    )

    assert(res.status === 200, `Expected 200, got ${res.status}`)
    // 파일명이 타임스탬프_원본파일명 형식인지 확인
    const filename = res.body?.file?.filename
    assert(filename !== undefined, 'Expected filename')
    const hasTimestamp = /^\d+_/.test(filename)
    assert(hasTimestamp, 'Expected filename to have timestamp prefix')

    // 정리
    if (res.body?.file?.id) {
      await request({
        path: `/api/v1/files/${res.body.file.id}`,
        method: 'DELETE'
      })
    }
  }),

  // ============================================================
  // 정리
  // ============================================================
  test('테스트 데이터 정리: 남은 파일 삭제', async () => {
    if (uploadedFileId2) {
      await request({
        path: `/api/v1/files/${uploadedFileId2}`,
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
  console.log('Phase 2-8: Files API (파일 업로드) 테스트')
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
  console.log('POST /api/v1/files (파일 업로드)')
  console.log(`  [${passed >= 4 ? 'x' : ' '}] 파일 업로드 성공`)
  console.log(`  [${passed >= 4 ? 'x' : ' '}] 파일 정보 반환 (id, original_name, size, url)`)
  console.log(`  [${passed >= 27 ? 'x' : ' '}] 타임스탬프 prefix 파일명 확인`)
  console.log(`  [${passed >= 12 ? 'x' : ' '}] 허용되지 않은 MIME 타입 거부 (400)`)
  console.log('')
  console.log('GET /api/v1/files/:id (파일 정보 조회)')
  console.log(`  [${passed >= 13 ? 'x' : ' '}] 파일 정보 조회 성공`)
  console.log(`  [${passed >= 14 ? 'x' : ' '}] 존재하지 않는 파일 시 404 반환`)
  console.log('')
  console.log('GET /api/v1/files/:id/download (파일 다운로드)')
  console.log(`  [${passed >= 15 ? 'x' : ' '}] 파일 다운로드 성공 (200)`)
  console.log(`  [${passed >= 15 ? 'x' : ' '}] Content-Disposition 헤더 설정`)
  console.log(`  [${passed >= 16 ? 'x' : ' '}] 존재하지 않는 파일 시 404 반환`)
  console.log('')
  console.log('DELETE /api/v1/files/:id (파일 삭제)')
  console.log(`  [${passed >= 23 ? 'x' : ' '}] 파일 삭제 성공 (200)`)
  console.log(`  [${passed >= 24 ? 'x' : ' '}] DB 레코드 삭제 확인`)
  console.log(`  [${passed >= 21 ? 'x' : ' '}] 작성자 또는 교사만 삭제 가능`)
  console.log('')
  console.log('MIME 타입 검증')
  console.log(`  [${passed >= 5 ? 'x' : ' '}] 이미지 (jpg, png) 허용`)
  console.log(`  [${passed >= 4 ? 'x' : ' '}] 문서 (pdf) 허용`)
  console.log(`  [${passed >= 7 ? 'x' : ' '}] 압축 (zip) 허용`)
  console.log(`  [${passed >= 12 ? 'x' : ' '}] 스크립트 (js) 거부`)
  console.log('')

  process.exit(failed > 0 ? 1 : 0)
}

runTests()
