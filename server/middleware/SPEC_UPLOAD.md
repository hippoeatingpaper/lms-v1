# 파일 업로드 백엔드 스펙 (File Upload)

> Multer 설정, MIME 검증 (Magic Bytes), 경로 탈출 방지, 파일 관리의 백엔드 구현 스펙

## 보안 주의사항

1. **MIME 스푸핑 방지**: 확장자가 아닌 파일 첫 바이트(magic bytes)로 실제 타입 검증
2. **경로 탈출 방지**: `path.basename()`으로 경로 구성 요소 제거, `startsWith()`로 검증
3. **직접 서빙 금지**: `uploads/` 폴더는 Express `static` 미들웨어로 절대 서빙하지 않음
4. **인증 필수**: 모든 파일 다운로드는 인증된 API 엔드포인트를 거쳐야 함

## DB Schema

### files — 업로드된 파일 메타데이터
```sql
CREATE TABLE files (
  id             INTEGER PRIMARY KEY,
  filename       TEXT NOT NULL,              -- 저장된 파일명 (타임스탬프_원본명)
  original_name  TEXT NOT NULL,              -- 원본 파일명
  filepath       TEXT NOT NULL,              -- UPLOAD_DIR 기준 상대 경로
  mimetype       TEXT NOT NULL,              -- 실제 MIME 타입 (magic bytes 검증 결과)
  size           INTEGER NOT NULL,           -- 파일 크기 (bytes)

  -- 연결 정보 (하나만 설정)
  class_id       INTEGER REFERENCES classes(id),      -- 반 (권한 검증용)
  post_id        INTEGER REFERENCES posts(id),        -- 게시물 첨부
  submission_id  INTEGER REFERENCES submissions(id),  -- 과제 제출 첨부
  question_id    INTEGER REFERENCES assignment_questions(id),  -- 파일 업로드 질문

  uploader_id    INTEGER REFERENCES users(id),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_files_post ON files(post_id);
CREATE INDEX idx_files_submission ON files(submission_id, question_id);
CREATE INDEX idx_files_class ON files(class_id);
```

## 파일 크기 및 타입 제한

### 허용 MIME 타입
```js
const ALLOWED_MIME = new Set([
  // 문서
  'application/pdf',
  'application/msword',                                                    // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-powerpoint',                                         // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-excel',                                              // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',     // .xlsx

  // 이미지
  'image/jpeg',
  'image/png',

  // 압축
  'application/zip',
  'application/x-zip-compressed',

  // 동영상 (별도 크기 제한)
  'video/mp4',
])
```

### 크기 제한
| 파일 종류 | 최대 크기 | 환경 변수 |
|----------|----------|----------|
| 일반 파일 | 20MB | `MAX_FILE_SIZE` |
| 동영상 (mp4) | 100MB | `MAX_VIDEO_SIZE` |

```js
// 환경 변수 (선택적 오버라이드)
MAX_FILE_SIZE=20971520    // 20MB (기본값)
MAX_VIDEO_SIZE=104857600  // 100MB (기본값)
UPLOAD_DIR=./uploads      // 업로드 디렉터리 (기본값)
```

## API Endpoints

### 파일 업로드 (POST /api/v1/files)

```
POST /api/v1/files
Authorization: 인증 필요
Content-Type: multipart/form-data
Rate Limit: userID당 10회/분

Request (FormData):
- file: File (필수)
- context: 'post' | 'submission' (필수)
- post_id?: number (context=post일 때)
- submission_id?: number (context=submission일 때)
- question_id?: number (파일 업로드 질문일 때)

Response 200:
{
  "file": {
    "id": 1,
    "filename": "1711234567890_보고서.pdf",
    "original_name": "보고서.pdf",
    "mimetype": "application/pdf",
    "size": 1048576,
    "url": "/api/v1/files/1/download"
  }
}

Error 400:
{ "error": { "code": "INVALID_FILE_TYPE", "message": "허용되지 않은 파일 형식입니다." } }
{ "error": { "code": "FILE_TOO_LARGE", "message": "파일 크기가 20MB를 초과합니다." } }
{ "error": { "code": "NO_FILE", "message": "파일이 첨부되지 않았습니다." } }

Error 413:
{ "error": { "code": "FILE_TOO_LARGE", "message": "파일 크기가 제한을 초과합니다." } }
```

### 과제 제출용 파일 업로드

```
POST /api/v1/submissions/:submissionId/files
Authorization: 인증 필요 (제출자 본인 또는 팀원)
Content-Type: multipart/form-data

Request (FormData):
- file: File (필수)
- question_id: number (파일 업로드 질문 ID)

Response 200:
{
  "file": {
    "id": 2,
    "filename": "1711234567890_사진.jpg",
    "original_name": "사진.jpg",
    "mimetype": "image/jpeg",
    "size": 524288,
    "url": "/api/v1/files/2/download"
  }
}
```

### 파일 다운로드 (GET /api/v1/files/:fileId/download)

```
GET /api/v1/files/:fileId/download
Authorization: 인증 필요 (반 소속 검증)

Response 200:
Content-Disposition: attachment; filename="원본파일명.pdf"
Content-Type: application/pdf
(파일 바이너리)

Error 403:
{ "error": { "code": "FORBIDDEN", "message": "해당 파일에 접근 권한이 없습니다." } }

Error 404:
{ "error": { "code": "NOT_FOUND", "message": "파일을 찾을 수 없습니다." } }
```

### 파일 삭제 (DELETE /api/v1/files/:fileId)

```
DELETE /api/v1/files/:fileId
Authorization: 인증 필요 (업로더 본인 또는 교사)

Response 200:
{ "ok": true }

Error 403:
{ "error": { "code": "FORBIDDEN", "message": "삭제 권한이 없습니다." } }
```

## 미들웨어 구현

### Multer 설정

```js
// server/middleware/upload.js
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// 업로드 디렉터리 확인/생성
fs.mkdirSync(path.resolve(UPLOAD_DIR), { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(UPLOAD_DIR))
  },
  filename: (req, file, cb) => {
    // 원본 파일명에서 경로 구성 요소 완전 제거
    const safeName = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    const timestamp = Date.now()
    cb(null, `${timestamp}_${safeName}`)
  },
})

// Multer 인스턴스 (일반 파일용)
export const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024, // 20MB
  },
})

// Multer 인스턴스 (동영상용)
export const uploadVideo = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_VIDEO_SIZE) || 100 * 1024 * 1024, // 100MB
  },
})
```

### MIME 타입 검증 (Magic Bytes)

```js
// server/middleware/upload.js
import { fileTypeFromBuffer } from 'file-type'
import fs from 'fs/promises'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-excel',
  'image/jpeg',
  'image/png',
  'video/mp4',
])

// 파일 크기 제한 (MIME별 분기)
const MAX_FILE_SIZE = {
  default: parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024,
  'video/mp4': parseInt(process.env.MAX_VIDEO_SIZE) || 100 * 1024 * 1024,
}

function getMaxFileSize(mimeType) {
  return MAX_FILE_SIZE[mimeType] || MAX_FILE_SIZE.default
}

/**
 * 파일 타입 검증 미들웨어
 * Multer 이후에 적용 (req.file 필요)
 */
export async function validateFileType(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      error: { code: 'NO_FILE', message: '파일이 첨부되지 않았습니다.' }
    })
  }

  try {
    // 파일 첫 바이트 읽어서 실제 타입 확인
    const buffer = await fs.readFile(req.file.path)
    const detected = await fileTypeFromBuffer(buffer)

    // 감지된 MIME 타입 확인
    const actualMime = detected?.mime || req.file.mimetype

    if (!ALLOWED_MIME.has(actualMime)) {
      // 검증 실패 시 업로드된 파일 삭제
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(400).json({
        error: { code: 'INVALID_FILE_TYPE', message: '허용되지 않은 파일 형식입니다.' }
      })
    }

    // MIME별 크기 제한 검증
    const maxSize = getMaxFileSize(actualMime)
    if (req.file.size > maxSize) {
      await fs.unlink(req.file.path).catch(() => {})
      const maxMB = Math.round(maxSize / 1024 / 1024)
      return res.status(400).json({
        error: { code: 'FILE_TOO_LARGE', message: `파일 크기가 ${maxMB}MB를 초과합니다.` }
      })
    }

    // 검증된 MIME 타입 저장 (DB 저장용)
    req.file.detectedMime = actualMime
    next()
  } catch (err) {
    // 에러 발생 시 파일 삭제
    await fs.unlink(req.file.path).catch(() => {})
    next(err)
  }
}
```

### 경로 탈출 방지

```js
// server/middleware/upload.js

/**
 * 파일 경로가 UPLOAD_DIR 내에 있는지 검증
 */
export function validateFilePath(filepath) {
  const safePath = path.resolve(filepath)
  const uploadDir = path.resolve(UPLOAD_DIR)
  return safePath.startsWith(uploadDir)
}
```

## 핵심 로직

### 파일 업로드 처리

```js
// server/routes/files.js
import { Router } from 'express'
import path from 'path'
import { db, saveImmediate } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import { upload, validateFileType, validateFilePath } from '../middleware/upload.js'
import { uploadLimiter } from '../middleware/rateLimit.js'

const router = Router()
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// 파일 업로드
router.post('/',
  authenticate,
  uploadLimiter,
  upload.single('file'),
  validateFileType,
  (req, res) => {
    const { context, post_id, submission_id, question_id } = req.body
    const file = req.file

    // 상대 경로로 저장 (UPLOAD_DIR 기준)
    const relativePath = path.relative(path.resolve(UPLOAD_DIR), file.path)

    // DB에 파일 정보 저장
    const { lastInsertRowid } = db.run(
      `INSERT INTO files (
        filename, original_name, filepath, mimetype, size,
        class_id, post_id, submission_id, question_id, uploader_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        file.filename,
        file.originalname,
        relativePath,
        file.detectedMime,
        file.size,
        req.user.class_id,
        post_id || null,
        submission_id || null,
        question_id || null,
        req.user.id,
      ]
    )

    // 파일-DB 불일치 방지: 즉시 저장
    saveImmediate('file_upload')

    res.json({
      file: {
        id: lastInsertRowid,
        filename: file.filename,
        original_name: file.originalname,
        mimetype: file.detectedMime,
        size: file.size,
        url: `/api/v1/files/${lastInsertRowid}/download`,
      }
    })
  }
)
```

### 파일 다운로드 처리

```js
// server/routes/files.js
import fs from 'fs'

router.get('/:fileId/download', authenticate, (req, res) => {
  const { fileId } = req.params

  const file = db.get('SELECT * FROM files WHERE id = ?', [fileId])
  if (!file) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '파일을 찾을 수 없습니다.' }
    })
  }

  // 권한 검증: 교사는 모든 파일, 학생은 자신의 반 파일만
  const isTeacher = req.user.role === 'teacher'
  const isSameClass = file.class_id === null || file.class_id === req.user.class_id

  if (!isTeacher && !isSameClass) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '해당 파일에 접근 권한이 없습니다.' }
    })
  }

  // 경로 탈출 방지
  const absolutePath = path.resolve(UPLOAD_DIR, file.filepath)
  if (!validateFilePath(absolutePath)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '잘못된 파일 경로입니다.' }
    })
  }

  // 파일 존재 확인
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '파일이 존재하지 않습니다.' }
    })
  }

  // 파일 다운로드
  res.download(absolutePath, file.original_name)
})
```

### 파일 삭제 처리

```js
// server/routes/files.js
import fs from 'fs/promises'

router.delete('/:fileId', authenticate, async (req, res) => {
  const { fileId } = req.params

  const file = db.get('SELECT * FROM files WHERE id = ?', [fileId])
  if (!file) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '파일을 찾을 수 없습니다.' }
    })
  }

  // 권한 검증: 업로더 본인 또는 교사
  const isTeacher = req.user.role === 'teacher'
  const isUploader = file.uploader_id === req.user.id

  if (!isTeacher && !isUploader) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '삭제 권한이 없습니다.' }
    })
  }

  // 실제 파일 삭제
  const absolutePath = path.resolve(UPLOAD_DIR, file.filepath)
  if (validateFilePath(absolutePath)) {
    await fs.unlink(absolutePath).catch(() => {})
  }

  // DB에서 삭제
  db.run('DELETE FROM files WHERE id = ?', [fileId])
  saveImmediate('file_delete')

  res.json({ ok: true })
})

export default router
```

### 과제 제출용 파일 업로드

```js
// server/routes/submissions.js
import { upload, uploadVideo, validateFileType } from '../middleware/upload.js'

// 파일 업로드 질문 응답
router.post('/:submissionId/files',
  authenticate,
  // 동영상 허용을 위해 uploadVideo 사용
  uploadVideo.single('file'),
  validateFileType,
  async (req, res) => {
    const { submissionId } = req.params
    const { question_id } = req.body

    // 제출물 확인
    const submission = db.get('SELECT * FROM submissions WHERE id = ?', [submissionId])
    if (!submission) {
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: '제출물을 찾을 수 없습니다.' }
      })
    }

    // 권한 검증: 제출자 본인 또는 팀원
    const isSubmitter = submission.submitter_id === req.user.id
    const isTeamMember = submission.team_id && submission.team_id === req.user.team_id

    if (!isSubmitter && !isTeamMember) {
      await fs.unlink(req.file.path).catch(() => {})
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: '파일 업로드 권한이 없습니다.' }
      })
    }

    // 기존 파일 삭제 (덮어쓰기)
    const existingFile = db.get(
      'SELECT * FROM files WHERE submission_id = ? AND question_id = ?',
      [submissionId, question_id]
    )

    if (existingFile) {
      const oldPath = path.resolve(UPLOAD_DIR, existingFile.filepath)
      await fs.unlink(oldPath).catch(() => {})
      db.run('DELETE FROM files WHERE id = ?', [existingFile.id])
    }

    // 새 파일 저장
    const relativePath = path.relative(
      path.resolve(UPLOAD_DIR),
      req.file.path
    )

    const { lastInsertRowid } = db.run(
      `INSERT INTO files (
        filename, original_name, filepath, mimetype, size,
        class_id, submission_id, question_id, uploader_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.file.filename,
        req.file.originalname,
        relativePath,
        req.file.detectedMime,
        req.file.size,
        req.user.class_id,
        submissionId,
        question_id,
        req.user.id,
      ]
    )

    saveImmediate('submission_file_upload')

    res.json({
      file: {
        id: lastInsertRowid,
        filename: req.file.filename,
        original_name: req.file.originalname,
        mimetype: req.file.detectedMime,
        size: req.file.size,
        url: `/api/v1/files/${lastInsertRowid}/download`,
      }
    })
  }
)
```

## Rate Limiting

```js
// server/middleware/rateLimit.js
import rateLimit from 'express-rate-limit'

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 10,              // 사용자당 10회
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '파일 업로드 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
    }
  },
})
```

## 라우터 등록

```js
// server/index.js
import fileRouter from './routes/files.js'

// uploads 폴더 직접 서빙 금지
// app.use('/uploads', express.static('uploads'))  // ← 절대 금지!

// 파일은 오직 인증된 API를 통해서만 제공
app.use('/api/v1/files', authenticate, fileRouter)
```

## 보안 체크리스트

- [ ] `file-type` 패키지로 magic bytes 검증
- [ ] `path.basename()`으로 경로 구성 요소 제거
- [ ] 타임스탬프 prefix로 파일명 충돌 방지
- [ ] `uploads/` 폴더 직접 서빙 금지 (`express.static` 사용 금지)
- [ ] 모든 다운로드는 인증된 API 엔드포인트 경유
- [ ] 경로 탈출 방지 (`startsWith` 검증)
- [ ] DB에는 상대 경로만 저장
- [ ] 파일 업로드 완료 시 `saveImmediate()` 호출
- [ ] Rate Limiting 적용 (userID당 10회/분)
- [ ] 반 소속 검증 (학생은 자신의 반 파일만)
