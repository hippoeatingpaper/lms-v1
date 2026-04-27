// server/middleware/upload.js
// Multer 설정 + MIME 검증 (Magic Bytes) + 경로 탈출 방지

import multer from 'multer'
import path from 'path'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { fileTypeFromBuffer } from 'file-type'

// 환경 변수 (절대 경로로 변환)
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads')
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024  // 20MB
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE) || 100 * 1024 * 1024  // 100MB

// 업로드 디렉터리 확인/생성
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// ============================================================
// 허용 MIME 타입
// ============================================================

const ALLOWED_MIME = new Set([
  // 문서
  'application/pdf',
  'application/msword',                                                      // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-powerpoint',                                           // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-excel',                                                // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx

  // 이미지
  'image/jpeg',
  'image/png',

  // 압축
  'application/zip',
  'application/x-zip-compressed',

  // 동영상 (별도 크기 제한)
  'video/mp4',
])

// MIME별 크기 제한
const MAX_SIZE_BY_MIME = {
  'video/mp4': MAX_VIDEO_SIZE,
}

function getMaxFileSize(mimeType) {
  return MAX_SIZE_BY_MIME[mimeType] || MAX_FILE_SIZE
}

// ============================================================
// Multer 스토리지 설정
// ============================================================

/**
 * 파일명 디코딩 (Latin-1 → UTF-8)
 * multer는 파일명을 Latin-1로 디코딩하므로, UTF-8 한글이 깨짐
 */
function decodeFilename(filename) {
  try {
    return Buffer.from(filename, 'latin1').toString('utf8')
  } catch {
    return filename
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    // Latin-1 → UTF-8 디코딩
    const decodedName = decodeFilename(file.originalname)
    // 원본 파일명에서 경로 구성 요소 완전 제거 + 안전한 문자만 허용
    const safeName = path.basename(decodedName)
      .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
    const timestamp = Date.now()
    // 디코딩된 원본 파일명을 file 객체에 저장 (DB 저장용)
    file.decodedOriginalname = decodedName
    cb(null, `${timestamp}_${safeName}`)
  },
})

// ============================================================
// Multer 인스턴스
// ============================================================

/**
 * 일반 파일용 Multer (20MB 제한)
 */
export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
})

/**
 * 동영상용 Multer (100MB 제한)
 */
export const uploadVideo = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
  },
})

// ============================================================
// MIME 타입 검증 미들웨어 (Magic Bytes)
// ============================================================

/**
 * 파일 타입 검증 미들웨어
 * Multer 이후에 적용 (req.file 필요)
 *
 * - 파일 첫 바이트(magic bytes)로 실제 타입 확인
 * - MIME별 크기 제한 검증
 * - 검증 실패 시 파일 삭제
 */
export async function validateFileType(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      error: { code: 'NO_FILE', message: '파일이 첨부되지 않았습니다.' }
    })
  }

  try {
    // 파일 첫 바이트 읽어서 실제 타입 확인
    const buffer = await fsPromises.readFile(req.file.path)
    const detected = await fileTypeFromBuffer(buffer)

    // 감지된 MIME 타입 (감지 실패 시 multer가 준 mimetype 사용)
    const actualMime = detected?.mime || req.file.mimetype

    // MIME 타입 검증
    if (!ALLOWED_MIME.has(actualMime)) {
      // 검증 실패 시 업로드된 파일 삭제
      await fsPromises.unlink(req.file.path).catch(() => {})
      return res.status(400).json({
        error: { code: 'INVALID_FILE_TYPE', message: '허용되지 않은 파일 형식입니다.' }
      })
    }

    // MIME별 크기 제한 검증
    const maxSize = getMaxFileSize(actualMime)
    if (req.file.size > maxSize) {
      await fsPromises.unlink(req.file.path).catch(() => {})
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
    await fsPromises.unlink(req.file.path).catch(() => {})
    next(err)
  }
}

// ============================================================
// 경로 탈출 방지
// ============================================================

/**
 * 파일 경로가 UPLOAD_DIR 내에 있는지 검증
 * @param {string} filepath - 검증할 파일 경로
 * @returns {boolean} UPLOAD_DIR 내에 있으면 true
 */
export function validateFilePath(filepath) {
  const safePath = path.resolve(filepath)
  const uploadDir = path.resolve(UPLOAD_DIR)
  return safePath.startsWith(uploadDir + path.sep) || safePath === uploadDir
}

// UPLOAD_DIR export (다른 모듈에서 사용)
export { UPLOAD_DIR }
