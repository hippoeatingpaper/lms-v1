# Phase 0: 인프라 - 테스트 체크리스트

> 모든 기능의 토대가 되는 서버 설정 테스트

---

## 0-1: 프로젝트 초기화

### 패키지 설정 테스트

- [x] `npm install` 실행 시 에러 없이 완료
- [x] root, server, client 각각의 `package.json` 존재 확인
- [x] 필수 의존성 설치 확인:
  - [x] express
  - [x] sql.js
  - [x] socket.io
  - [x] jsonwebtoken
  - [x] bcryptjs
  - [x] multer
  - [x] dotenv

### 환경 설정 테스트

- [x] `.env.example` 파일 존재 확인
- [x] `.env.example`에 필수 변수 포함 확인:
  - [x] `PORT`
  - [x] `JWT_SECRET`
  - [x] `JWT_REFRESH_SECRET` *(JWT_REFRESH_EXPIRES로 대체 구현됨)*
  - [x] `NODE_ENV`
- [x] `.gitignore`에 민감 파일 제외 확인:
  - [x] `node_modules/`
  - [x] `.env`
  - [x] `data/*.db`
  - [x] `certs/`

> **테스트 완료일**: 2026-04-18
> **비고**: JWT_REFRESH_SECRET은 별도 변수 없이 JWT_REFRESH_EXPIRES로 만료 시간만 설정하는 방식으로 구현됨

---

## 0-2: HTTPS 서버 설정

### 인증서 생성 테스트

- [x] `node scripts/generateCert.js` 실행
- [x] `certs/` 폴더 생성 확인
- [x] `certs/server.key` 파일 생성 확인
- [x] `certs/server.crt` 파일 생성 확인
- [x] 인증서 재생성 시 기존 파일 덮어쓰기 확인

### HTTPS 서버 테스트

- [x] `NODE_ENV=production`에서 HTTPS로 시작 확인
- [x] `NODE_ENV=development`에서 HTTP로 시작 확인
- [x] 브라우저에서 `https://localhost:3000` 접속 (자체 서명 경고 후 접속)
- [ ] HTTP → HTTPS 리다이렉트 동작 확인 (production 환경)

> **테스트 완료일**: 2026-04-18
> **비고**:
> 
> - 실제 구현에서는 `NODE_ENV`가 아닌 `HTTPS_ENABLED` 환경변수로 HTTP/HTTPS 모드 결정
> - HTTP → HTTPS 리다이렉트는 미구현 (HTTPS 모드에서는 HTTPS 서버만 실행됨)

### 디렉터리 자동 생성 테스트

- [x] `data/` 폴더 자동 생성 확인
- [x] `uploads/` 폴더 자동 생성 확인
- [x] `certs/` 폴더 자동 생성 확인

---

## 0-3: sql.js 데이터베이스 래퍼

### 초기화 테스트

- [ ] 서버 시작 시 sql.js 초기화 성공
- [ ] `data/database.db` 파일 생성 확인
- [ ] 기존 DB 파일 존재 시 로드 성공 확인
- [ ] DB 파일 없을 때 새로 생성 확인

### 디바운스 저장 테스트

- [ ] 데이터 변경 후 2초 대기 시 자동 저장
- [ ] 연속 변경 시 마지막 변경 후 2초에 저장 (디바운스)
- [ ] 저장 로그 출력 확인

### 즉시 저장 테스트

- [ ] `saveImmediate()` 호출 시 즉시 저장
- [ ] `criticalTransaction()` 내 작업 후 즉시 저장
- [ ] 트랜잭션 롤백 시 저장되지 않음 확인

### 자동 백업 테스트

- [ ] 설정된 간격(예: 1시간)마다 백업 생성
- [ ] 백업 파일 이름에 타임스탬프 포함
- [ ] `data/backups/` 폴더에 백업 저장
- [ ] 오래된 백업 자동 삭제 (최대 보관 개수 초과 시)

### 크래시 핸들러 테스트

- [ ] `SIGINT` (Ctrl+C) 시 저장 후 종료
- [ ] `SIGTERM` 시 저장 후 종료
- [ ] 예외 발생 시 저장 시도 후 종료

---

## 0-4: 초기 스키마 + 마이그레이션

### 초기 스키마 테스트

- [ ] 서버 시작 시 테이블 자동 생성
- [ ] `users` 테이블 생성 확인
- [ ] `classes` 테이블 생성 확인
- [ ] `teams` 테이블 생성 확인
- [ ] `posts` 테이블 생성 확인
- [ ] `assignments` 테이블 생성 확인
- [ ] `submissions` 테이블 생성 확인
- [ ] `files` 테이블 생성 확인
- [ ] `notifications` 테이블 생성 확인
- [ ] `migrations` 테이블 생성 확인

### 마이그레이션 시스템 테스트

- [ ] `npm run migrate:status` 명령 실행
- [ ] 적용된 마이그레이션 목록 표시
- [ ] 미적용 마이그레이션 목록 표시
- [ ] 새 마이그레이션 자동 적용 확인

### 롤백 테스트

- [ ] `node scripts/rollbackMigration.js` 실행
- [ ] 마지막 마이그레이션 롤백 확인
- [ ] 롤백 후 스키마 변경 확인

### 복원 테스트

- [ ] `node scripts/restoreMigration.js` 실행
- [ ] 백업에서 마이그레이션 상태 복원 확인

---

## 0-5: Express 기본 미들웨어

### 에러 핸들러 테스트

- [ ] 존재하지 않는 라우트 접근 시 404 응답
- [ ] 서버 에러 발생 시 500 응답
- [ ] 에러 응답 형식 확인: `{ error: { code, message } }`
- [ ] production 환경에서 스택 트레이스 숨김
- [ ] development 환경에서 스택 트레이스 표시

### 보안 필터 테스트

- [ ] `/.env` 접근 차단 (403)
- [ ] `/.git/` 접근 차단 (403)
- [ ] `/data/` 접근 차단 (403)
- [ ] `/certs/` 접근 차단 (403)
- [ ] `/node_modules/` 접근 차단 (403)
- [ ] 일반 API 경로 정상 접근

### 미들웨어 순서 테스트

- [ ] JSON 파싱 동작 확인 (`express.json()`)
- [ ] URL 인코딩 파싱 동작 확인 (`express.urlencoded()`)
- [ ] 정적 파일 서빙 동작 확인 (`express.static()`)
- [ ] CORS 설정 동작 확인

---

## 0-6: 교사 계정 CLI

### 교사 계정 생성 테스트

- [ ] `node scripts/createTeacher.js` 실행
- [ ] 대화형 입력 (ID, 이름, 비밀번호) 동작
- [ ] 비밀번호 해싱 확인 (bcrypt)
- [ ] `users` 테이블에 role='teacher' 저장 확인
- [ ] 중복 ID 생성 시 에러 메시지 표시

### 백업 스크립트 테스트

- [ ] `node scripts/backup.js` 실행
- [ ] 데이터베이스 백업 파일 생성
- [ ] `uploads/` 폴더 백업
- [ ] 백업 파일명에 타임스탬프 포함
- [ ] 백업 완료 메시지 출력

### 복원 스크립트 테스트

- [ ] `node scripts/restore.js` 실행
- [ ] 백업 파일 목록 표시
- [ ] 선택한 백업에서 복원
- [ ] 복원 후 데이터 무결성 확인
- [ ] 복원 완료 메시지 출력

---

## 통합 테스트

### 서버 시작 플로우

```bash
# 테스트 순서
1. npm install
2. node scripts/generateCert.js
3. cp .env.example .env (+ 환경변수 설정)
4. node scripts/createTeacher.js
5. npm run dev
```

- [ ] 위 순서대로 실행 시 에러 없음
- [ ] 서버 시작 로그에 포트 번호 표시
- [ ] 서버 시작 로그에 DB 초기화 완료 표시
- [ ] 브라우저에서 서버 접속 가능

### 환경별 동작

- [ ] `NODE_ENV=development`: HTTP, 상세 로그
- [ ] `NODE_ENV=production`: HTTPS, 간소 로그

---

## 주의사항

1. **인증서**: 자체 서명 인증서는 브라우저에서 보안 경고 발생 (정상)
2. **sql.js**: WebAssembly 초기화에 시간 소요 가능
3. **포트 충돌**: 3000 포트 사용 중이면 다른 포트 설정 필요
