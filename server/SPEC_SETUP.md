# 서버 설정 스펙 (HTTPS, 환경변수, CLI)

> HTTPS 설정, 환경변수, 필수 디렉터리, 교사 계정 CLI, npm 패키지 목록

## HTTPS 설정 (mkcert 사용)

### 왜 HTTPS가 필요한가?

- HTTP 환경에서는 httpOnly 쿠키라도 **네트워크 스니핑**(Wireshark 등)으로 세션 탈취 가능
- 같은 WiFi에 연결된 학생이 다른 학생의 세션을 가로챌 수 있음
- mkcert를 사용하여 로컬 인증서를 생성하고 HTTPS로 서버 실행

### mkcert 설치

```bash
# Windows (관리자 권한 PowerShell)
choco install mkcert
# 또는 Scoop 사용
scoop bucket add extras
scoop install mkcert

# Mac
brew install mkcert

# 로컬 CA 설치 (교사 PC에서 1회만 실행)
mkcert -install
```

### 인증서 생성 스크립트

```js
// scripts/generateCert.js
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const CERT_DIR = './certs'

// 로컬 IP 주소 자동 감지
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '192.168.1.100' // 기본값
}

function generateCert() {
  // 인증서 디렉터리 생성
  fs.mkdirSync(CERT_DIR, { recursive: true })

  const localIP = process.env.SERVER_IP || getLocalIP()
  console.log(`📍 감지된 IP: ${localIP}`)

  // mkcert 설치 확인
  try {
    execSync('mkcert -version', { stdio: 'ignore' })
  } catch {
    console.error('❌ mkcert가 설치되어 있지 않습니다.')
    console.error('   설치 방법: choco install mkcert (Windows)')
    console.error('              brew install mkcert (Mac)')
    process.exit(1)
  }

  // 인증서 생성
  const certPath = path.join(CERT_DIR, 'cert.pem')
  const keyPath = path.join(CERT_DIR, 'key.pem')

  console.log('🔐 인증서 생성 중...')
  execSync(
    `mkcert -cert-file "${certPath}" -key-file "${keyPath}" localhost ${localIP} 127.0.0.1`,
    { stdio: 'inherit' }
  )

  console.log('')
  console.log('✅ 인증서 생성 완료!')
  console.log(`   인증서: ${certPath}`)
  console.log(`   개인키: ${keyPath}`)
  console.log('')
  console.log('📋 다음 단계:')
  console.log('   1. .env 파일에 HTTPS_ENABLED=true 설정')
  console.log(`   2. .env 파일에 SERVER_IP=${localIP} 확인`)
  console.log('   3. npm start로 서버 실행')
  console.log(`   4. 학생들에게 https://${localIP}:3000 주소 안내`)
}

generateCert()
```

### 서버 HTTPS 설정

```js
// server/index.js — HTTPS 서버 설정
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'

const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true'
const CERT_DIR = './certs'

let httpServer

if (HTTPS_ENABLED) {
  const certPath = path.resolve(CERT_DIR, 'cert.pem')
  const keyPath = path.resolve(CERT_DIR, 'key.pem')

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error('❌ 인증서 파일이 없습니다. 먼저 다음 명령을 실행하세요:')
    console.error('   node scripts/generateCert.js')
    process.exit(1)
  }

  const options = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  }

  httpServer = https.createServer(options, app)
  console.log('🔒 HTTPS 모드로 서버 실행')
} else {
  httpServer = http.createServer(app)
  console.log('⚠️  HTTP 모드로 서버 실행 (개발 환경 전용)')
}

const PORT = process.env.PORT || 3000
const SERVER_IP = process.env.SERVER_IP || 'localhost'

httpServer.listen(PORT, '0.0.0.0', () => {
  const protocol = HTTPS_ENABLED ? 'https' : 'http'
  console.log(`🚀 서버 실행: ${protocol}://${SERVER_IP}:${PORT}`)
})
```

### 학생 기기 접속 안내

1. 학생들이 처음 접속 시 "연결이 비공개가 아닙니다" 경고 표시
2. "고급" → "안전하지 않음 계속" (Chrome) 또는 "위험을 감수하고 계속" (Firefox) 클릭
3. 이후 같은 주소로 접속 시 경고 없이 정상 접속
4. **암호화는 정상 작동** (경고는 인증서 신뢰 문제일 뿐, 트래픽은 암호화됨)

## 환경 변수 (.env)

### .env.example

```bash
# 서버 설정
PORT=3000
NODE_ENV=development
SERVER_IP=192.168.1.100

# HTTPS (프로덕션에서는 반드시 true)
HTTPS_ENABLED=true

# JWT 인증
JWT_SECRET=최소32자이상의랜덤문자열을여기에입력하세요_abc123xyz789
JWT_ACCESS_EXPIRES=3h
JWT_REFRESH_EXPIRES=7d

# 파일 업로드
MAX_FILE_SIZE=20971520
MAX_VIDEO_SIZE=104857600
UPLOAD_DIR=./uploads

# 데이터베이스
DB_PATH=./data/database.db

# 백업
BACKUP_PASSWORD=백업암호화비밀번호
```

### 환경 변수 설명

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | 3000 | 서버 포트 |
| `NODE_ENV` | development | 환경 (development / production) |
| `SERVER_IP` | localhost | 교사 노트북 IP (CORS 및 인증서용) |
| `HTTPS_ENABLED` | false | HTTPS 활성화 (프로덕션: true) |
| `JWT_SECRET` | - | **필수**, 32자 이상 랜덤 문자열 |
| `JWT_ACCESS_EXPIRES` | 3h | Access Token 만료 시간 |
| `JWT_REFRESH_EXPIRES` | 7d | Refresh Token 만료 시간 |
| `MAX_FILE_SIZE` | 20971520 | 일반 파일 최대 크기 (20MB) |
| `MAX_VIDEO_SIZE` | 104857600 | 동영상 최대 크기 (100MB) |
| `UPLOAD_DIR` | ./uploads | 업로드 파일 저장 경로 |
| `DB_PATH` | ./data/database.db | SQLite DB 파일 경로 |
| `BACKUP_PASSWORD` | - | 백업 암호화 비밀번호 |

### JWT_SECRET 생성 방법

```bash
# Node.js로 랜덤 문자열 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 필수 디렉터리 자동 생성

```js
// server/index.js — 서버 시작 전 가장 먼저 실행
import fs from 'fs'
import path from 'path'

// 환경 변수 기본값
const DB_PATH = process.env.DB_PATH || './data/database.db'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// 필수 디렉터리 자동 생성
function ensureDirectories() {
  const dbDir = path.dirname(path.resolve(DB_PATH))
  const uploadDir = path.resolve(UPLOAD_DIR)

  fs.mkdirSync(dbDir, { recursive: true })
  fs.mkdirSync(uploadDir, { recursive: true })

  console.log(`[init] DB 디렉터리 확인/생성: ${dbDir}`)
  console.log(`[init] 업로드 디렉터리 확인/생성: ${uploadDir}`)
}

// 서버 시작 전 반드시 호출
ensureDirectories()
```

## 교사 계정 생성 CLI

### scripts/createTeacher.js

```js
// scripts/createTeacher.js
import readline from 'readline'
import bcrypt from 'bcryptjs'  // Windows 호환성을 위해 bcryptjs 사용
import { initDatabase, db, saveDatabase } from '../server/db.js'
import { createInitialSchema } from '../server/migrations/schema.js'

const args = process.argv.slice(2)
const forceMode = args.includes('--force')
const addMode = args.includes('--add')

async function main() {
  // DB 초기화 (sql.js는 초기화가 비동기)
  await initDatabase()
  createInitialSchema()

  // 기존 교사 계정 확인
  const existingTeachers = db.all("SELECT * FROM users WHERE role = 'teacher'")

  if (existingTeachers.length > 0 && !forceMode && !addMode) {
    console.error('⚠️  이미 교사 계정이 존재합니다.')
    console.error(`   현재 ${existingTeachers.length}개의 교사 계정이 등록되어 있습니다.`)
    console.error('')
    console.error('   옵션:')
    console.error('   --force : 기존 교사 계정을 삭제하고 새로 생성')
    console.error('   --add   : 추가 교사 계정 생성 (기존 유지)')
    process.exit(1)
  }

  if (forceMode && existingTeachers.length > 0) {
    console.log(`⚠️  기존 교사 계정 ${existingTeachers.length}개를 삭제합니다...`)
    db.run("DELETE FROM users WHERE role = 'teacher'", [])
    console.log('✅ 기존 교사 계정 삭제 완료')
  }

  // 대화형 입력으로 새 교사 계정 생성
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q) => new Promise(resolve => rl.question(q, resolve))

  const name = await ask('이름: ')
  const username = await ask('아이디: ')
  const password = await ask('비밀번호: ')
  rl.close()

  // 비밀번호 해시
  const passwordHash = await bcrypt.hash(password, 10)

  // DB 작업
  db.run(
    'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, username, passwordHash, 'teacher']
  )

  // 즉시 저장 (스크립트 종료 전)
  saveDatabase()
  console.log(`✅ 교사 계정 생성 완료: ${username}`)
}

main().catch(err => {
  console.error('❌ 오류:', err.message)
  process.exit(1)
})
```

### 사용법

```bash
# 기본 (교사 계정이 없을 때)
node scripts/createTeacher.js

# 기존 교사 계정 삭제 후 새로 생성
node scripts/createTeacher.js --force

# 추가 교사 계정 생성 (기존 유지)
node scripts/createTeacher.js --add
```

## 백업 스크립트

### scripts/backup.js

```js
// scripts/backup.js — DB + uploads 백업 (AES 암호화)
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import crypto from 'crypto'

const DB_PATH = process.env.DB_PATH || './data/database.db'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const BACKUP_DIR = './backups'
const PASSWORD = process.env.BACKUP_PASSWORD

if (!PASSWORD) {
  console.error('❌ BACKUP_PASSWORD 환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

async function backup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const backupName = `backup_${timestamp}`
  const zipPath = path.join(BACKUP_DIR, `${backupName}.zip`)
  const encPath = path.join(BACKUP_DIR, `${backupName}.zip.enc`)

  // ZIP 압축
  const output = fs.createWriteStream(zipPath)
  const archive = archiver('zip', { zlib: { level: 9 } })

  archive.pipe(output)
  archive.file(path.resolve(DB_PATH), { name: 'database.db' })
  archive.directory(path.resolve(UPLOAD_DIR), 'uploads')
  await archive.finalize()

  // AES 암호화
  const key = crypto.scryptSync(PASSWORD, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

  const input = fs.createReadStream(zipPath)
  const encrypted = fs.createWriteStream(encPath)

  encrypted.write(iv)
  input.pipe(cipher).pipe(encrypted)

  await new Promise(resolve => encrypted.on('finish', resolve))

  // 원본 ZIP 삭제
  fs.unlinkSync(zipPath)

  console.log(`✅ 백업 완료: ${encPath}`)
}

backup().catch(err => {
  console.error('❌ 백업 실패:', err.message)
  process.exit(1)
})
```

### scripts/restore.js

```js
// scripts/restore.js — 백업 복원
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import AdmZip from 'adm-zip'

const DB_PATH = process.env.DB_PATH || './data/database.db'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const PASSWORD = process.env.BACKUP_PASSWORD
const backupFile = process.argv[2]

if (!backupFile || !fs.existsSync(backupFile)) {
  console.error('사용법: node scripts/restore.js <백업파일.zip.enc>')
  process.exit(1)
}

if (!PASSWORD) {
  console.error('❌ BACKUP_PASSWORD 환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

async function restore() {
  // 복호화
  const key = crypto.scryptSync(PASSWORD, 'salt', 32)
  const encrypted = fs.readFileSync(backupFile)
  const iv = encrypted.slice(0, 16)
  const data = encrypted.slice(16)

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])

  // ZIP 압축 해제
  const zip = new AdmZip(decrypted)

  // DB 복원
  const dbEntry = zip.getEntry('database.db')
  if (dbEntry) {
    fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true })
    fs.writeFileSync(path.resolve(DB_PATH), zip.readFile(dbEntry))
    console.log('✅ DB 복원 완료')
  }

  // uploads 복원
  zip.getEntries()
    .filter(e => e.entryName.startsWith('uploads/'))
    .forEach(entry => {
      const targetPath = path.resolve(entry.entryName)
      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true })
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        fs.writeFileSync(targetPath, zip.readFile(entry))
      }
    })

  console.log('✅ 파일 복원 완료')
}

restore().catch(err => {
  console.error('❌ 복원 실패:', err.message)
  process.exit(1)
})
```

## npm 패키지 목록

### 백엔드 (server/)

```bash
npm install \
  express \
  cors \
  cookie-parser \
  sql.js \
  jsonwebtoken \
  bcryptjs \
  multer \
  file-type \
  socket.io \
  ws \
  yjs \
  y-protocols \
  lib0 \
  express-rate-limit \
  archiver \
  adm-zip \
  dotenv
```

| 패키지 | 용도 |
|--------|------|
| `express` | 웹 프레임워크 |
| `cors` | CORS 설정 |
| `cookie-parser` | 쿠키 파싱 |
| `sql.js` | SQLite (WebAssembly, 빌드 도구 불필요) |
| `jsonwebtoken` | JWT 생성/검증 |
| `bcryptjs` | 비밀번호 해시 (빌드 도구 불필요) |
| `multer` | 파일 업로드 |
| `file-type` | MIME 타입 검증 |
| `socket.io` | 실시간 통신 (댓글, 좋아요, 공지) |
| `ws` | WebSocket (Yjs용) |
| `yjs` | CRDT 문서 엔진 |
| `y-protocols` | Yjs 동기화 프로토콜 |
| `lib0` | Yjs 인코딩/디코딩 |
| `express-rate-limit` | Rate Limiting |
| `archiver` | 백업 압축 |
| `adm-zip` | 백업 복원 |
| `dotenv` | 환경 변수 로드 |

> **참고**: `y-websocket` 대신 `y-protocols`를 직접 사용합니다.
> `y-websocket`의 `setupWSConnection`은 LevelDB persistence가 내장되어 SQLite와 충돌

> **참고**: `better-sqlite3` 대신 `sql.js`를 사용합니다.
> Windows에서 빌드 도구 없이 `npm install`만으로 설치 가능

### 프론트엔드 (client/)

```bash
npm install \
  react \
  react-dom \
  react-router-dom \
  zustand \
  socket.io-client \
  yjs \
  y-websocket \
  @tiptap/react \
  @tiptap/starter-kit \
  @tiptap/extension-collaboration \
  @tiptap/extension-collaboration-cursor \
  lucide-react

npm install -D \
  vite \
  @vitejs/plugin-react \
  typescript \
  @types/react \
  @types/react-dom \
  tailwindcss \
  postcss \
  autoprefixer \
  vite-plugin-pwa
```

| 패키지 | 용도 |
|--------|------|
| `react`, `react-dom` | UI 프레임워크 |
| `react-router-dom` | 라우팅 |
| `zustand` | 상태 관리 |
| `socket.io-client` | 실시간 통신 |
| `yjs`, `y-websocket` | 공동 편집 |
| `@tiptap/*` | 에디터 |
| `lucide-react` | 아이콘 |
| `vite` | 빌드 도구 |
| `tailwindcss` | 스타일링 |
| `vite-plugin-pwa` | PWA 지원 |

## package.json 스크립트

```json
{
  "scripts": {
    "dev": "node server/index.js",
    "start": "NODE_ENV=production node server/index.js",
    "build": "cd client && npm run build",
    "backup": "node scripts/backup.js",
    "restore": "node scripts/restore.js",
    "create-teacher": "node scripts/createTeacher.js",
    "generate-cert": "node scripts/generateCert.js",
    "migrate:status": "node scripts/migrationStatus.js",
    "migrate:rollback": "node scripts/rollbackMigration.js",
    "migrate:restore": "node scripts/restoreMigration.js"
  }
}
```

## 서버 시작 체크리스트

- [ ] `.env` 파일 생성 (`.env.example` 복사)
- [ ] `JWT_SECRET` 설정 (32자 이상 랜덤 문자열)
- [ ] `SERVER_IP` 확인 (`ipconfig` 또는 `ifconfig`)
- [ ] mkcert 설치 및 로컬 CA 등록 (`mkcert -install`)
- [ ] 인증서 생성 (`node scripts/generateCert.js`)
- [ ] `HTTPS_ENABLED=true` 설정
- [ ] 교사 계정 생성 (`node scripts/createTeacher.js`)
- [ ] 서버 시작 (`npm start`)
- [ ] 학생들에게 `https://{SERVER_IP}:3000` 안내
