# Classroom System - 구현 계획서

> Claude Code와 함께하는 단계별 구현 가이드

## 사용 방법

### 1. 작업 시작 전

```
"PLAN.md를 읽고 현재 진행 상황을 파악해줘"
```

### 2. 특정 단계 구현 요청

```
"Phase 0-1: HTTPS 서버 설정을 구현해줘"
```

### 3. 작업 완료 후

해당 단계의 `[ ]`를 `[x]`로 변경 요청

---

## Phase 0: 인프라 (서버 기반)

> 모든 기능의 토대가 되는 서버 설정

### 0-1: 프로젝트 초기화

- [x] `package.json` 생성 (root, server, client)
- [x] 백엔드 npm 패키지 설치
- [x] `.env.example` 생성
- [x] `.gitignore` 설정

**참조**: `server/SPEC_SETUP.md` → npm 패키지 목록, 환경변수

**프롬프트**:

```
server/SPEC_SETUP.md를 읽고 Phase 0-1을 구현해줘
```

---

### 0-2: HTTPS 서버 설정

- [x] `scripts/generateCert.js` 생성
- [x] `server/index.js` 기본 구조 (HTTPS/HTTP 분기)
- [x] 필수 디렉터리 자동 생성 (`data/`, `uploads/`, `certs/`)

**참조**: `server/SPEC_SETUP.md` → HTTPS 설정, 인증서 생성 스크립트

**프롬프트**:

```
server/SPEC_SETUP.md를 읽고 Phase 0-2: HTTPS 서버 설정을 구현해줘
```

---

### 0-3: sql.js 데이터베이스 래퍼

- [x] `server/db.js` 생성 (initDatabase, db 객체)
- [x] 디바운스 저장 (debouncedSave)
- [x] 즉시 저장 (saveImmediate, criticalTransaction)
- [x] 자동 백업 (startAutoBackup)
- [x] 크래시 핸들러 (setupCrashHandler)

**참조**: `server/SPEC_DATABASE.md` → DB 래퍼 구현

**프롬프트**:

```
server/SPEC_DATABASE.md를 읽고 Phase 0-3: sql.js 래퍼를 구현해줘
```

---

### 0-4: 초기 스키마 + 마이그레이션

- [x] `server/migrations/schema.js` (초기 테이블 생성)
- [x] `server/migrations/index.js` (마이그레이션 시스템)
- [x] `scripts/migrationStatus.js`
- [x] `scripts/rollbackMigration.js`
- [x] `scripts/restoreMigration.js`

**참조**: `server/SPEC_DATABASE.md` → 초기 스키마, 마이그레이션 시스템

**프롬프트**:

```
server/SPEC_DATABASE.md를 읽고 Phase 0-4: 스키마와 마이그레이션을 구현해줘
```

---

### 0-5: Express 기본 미들웨어

- [x] `server/middleware/errorHandler.js`
- [x] `server/middleware/securityFilter.js` (민감 경로 차단)
- [x] `server/index.js`에 미들웨어 순서대로 적용

**참조**: `server/CLAUDE.md` → Middleware Order, `server/middleware/SPEC_AUTH.md`

**프롬프트**:

```
server/CLAUDE.md의 Middleware Order 섹션을 참고해서 Phase 0-5를 구현해줘
```

---

### 0-6: 교사 계정 CLI

- [x] `scripts/createTeacher.js`
- [x] `scripts/backup.js`
- [x] `scripts/restore.js`

**참조**: `server/SPEC_SETUP.md` → 교사 계정 생성 CLI, 백업 스크립트

**프롬프트**:

```
server/SPEC_SETUP.md를 읽고 Phase 0-6: CLI 스크립트를 구현해줘
```

---

## Phase 1: 인증 시스템

> JWT 기반 인증 + 역할/반 검증 미들웨어

### 1-1: JWT 인증 미들웨어

- [x] `server/middleware/auth.js` - authenticate 함수
- [x] Access Token 검증 (httpOnly 쿠키)
- [x] Token 만료 에러 처리

**참조**: `server/middleware/SPEC_AUTH.md`, `server/CLAUDE.md` → JWT Authentication Pattern

**프롬프트**:

```
server/middleware/SPEC_AUTH.md를 읽고 Phase 1-1: authenticate 미들웨어를 구현해줘
```

---

### 1-2: 역할/반 검증 미들웨어

- [x] `requireRole(...roles)` 미들웨어
- [x] `verifyClassAccess` 미들웨어 (반 소속 확인)
- [x] `verifyTeamAccess` 미들웨어 (팀 소속 확인)

**참조**: `server/middleware/SPEC_AUTH.md`

**프롬프트**:

```
server/middleware/SPEC_AUTH.md를 읽고 Phase 1-2: 역할/반 검증 미들웨어를 구현해줘
```

---

### 1-3: Rate Limiting

- [x] `server/middleware/rateLimit.js`
- [x] 로그인 시도 제한 (15분 5회)
- [x] 일반 API 제한 (1분 100회)

**참조**: `server/CLAUDE.md` → Rate Limiting

**프롬프트**:

```
server/CLAUDE.md의 Rate Limiting 섹션을 참고해서 Phase 1-3을 구현해줘
```

---

## Phase 2: REST API

> 핵심 비즈니스 로직 API

### 2-1: Auth API

- [x] `server/routes/auth.js`
- [x] `POST /api/v1/auth/login` (로그인)
- [x] `POST /api/v1/auth/logout` (로그아웃)
- [x] `POST /api/v1/auth/refresh` (토큰 갱신)
- [x] `GET /api/v1/auth/me` (내 정보)

**참조**: `server/middleware/SPEC_AUTH.md`, `server/CLAUDE.md` → Cookie Settings

**프롬프트**:

```
server/middleware/SPEC_AUTH.md를 읽고 Phase 2-1: Auth API를 구현해줘
```

---

### 2-2: Classes API

- [x] `server/routes/classes.js`
- [x] `GET /api/v1/classes` (반 목록)
- [x] `POST /api/v1/classes` (반 생성 - 교사)
- [x] `GET /api/v1/classes/:id` (반 상세)
- [x] `PATCH /api/v1/classes/:id` (반 수정)
- [x] `DELETE /api/v1/classes/:id` (반 삭제)

**참조**: `server/routes/SPEC_ADMIN.md`

**프롬프트**:

```
server/routes/SPEC_ADMIN.md를 읽고 Phase 2-2: Classes API를 구현해줘
```

---

### 2-3: Users API (학생 관리)

- [x] `server/routes/users.js`
- [x] `GET /api/v1/users` (학생 목록 - class_id 필터 지원)
- [x] `GET /api/v1/users/:id` (학생 상세)
- [x] `POST /api/v1/users` (학생 생성)
- [x] `POST /api/v1/users/bulk` (학생 일괄 생성)
- [x] `PATCH /api/v1/users/:id` (학생 정보 수정)
- [x] `DELETE /api/v1/users/:id` (학생 삭제)
- [x] `POST /api/v1/users/:id/reset-password` (비밀번호 초기화)

**참조**: `server/routes/SPEC_ADMIN.md`

**프롬프트**:

```
server/routes/SPEC_ADMIN.md를 읽고 Phase 2-3: Users API를 구현해줘
```

---

### 2-4: Teams API

- [x] `server/routes/teams.js`
- [x] `GET /api/v1/classes/:classId/teams` (팀 목록)
- [x] `POST /api/v1/classes/:classId/teams` (팀 생성)
- [x] `PATCH /api/v1/teams/:id` (팀 수정)
- [x] `DELETE /api/v1/teams/:id` (팀 삭제)
- [x] `POST /api/v1/teams/:id/members` (팀원 배정)
- [x] `DELETE /api/v1/teams/:id/members/:userId` (팀원 제거)

**참조**: `server/routes/SPEC_ADMIN.md`

**프롬프트**:

```
server/routes/SPEC_ADMIN.md를 읽고 Phase 2-4: Teams API를 구현해줘
```

---

### 2-5: Posts API (게시판)

- [x] `server/routes/posts.js`
- [x] `GET /api/v1/classes/:classId/posts` (게시글 목록)
- [x] `POST /api/v1/classes/:classId/posts` (게시글 작성)
- [x] `GET /api/v1/posts/:id` (게시글 상세)
- [x] `PATCH /api/v1/posts/:id` (게시글 수정)
- [x] `DELETE /api/v1/posts/:id` (게시글 삭제)
- [x] `GET /api/v1/posts/:id/comments` (댓글 목록)
- [x] `POST /api/v1/posts/:id/comments` (댓글 작성)
- [x] `DELETE /api/v1/comments/:id` (댓글 삭제)
- [x] `POST /api/v1/posts/:id/like` (좋아요 토글)

**참조**: `server/routes/SPEC_POSTS.md`

**프롬프트**:

```
server/routes/SPEC_POSTS.md를 읽고 Phase 2-5: Posts API를 구현해줘
```

---

### 2-6: Assignments API (과제 출제)

- [x] `server/routes/assignments.js`
- [x] `GET /api/v1/classes/:classId/assignments` (과제 목록)
- [x] `POST /api/v1/classes/:classId/assignments` (과제 출제)
- [x] `GET /api/v1/assignments/:id` (과제 상세)
- [x] `PUT /api/v1/assignments/:id` (과제 수정)
- [x] `DELETE /api/v1/assignments/:id` (과제 삭제)

**참조**: `server/routes/SPEC_ASSIGNMENTS.md`

**프롬프트**:

```
server/routes/SPEC_ASSIGNMENTS.md를 읽고 Phase 2-6: Assignments API를 구현해줘
```

---

### 2-7: Submissions API (과제 제출)

- [x] `server/routes/submissions.js`
- [x] `GET /api/v1/assignments/:id/submissions` (제출 목록 - 교사)
- [x] `POST /api/v1/assignments/:id/draft` (임시저장 - 학생)
- [x] `POST /api/v1/assignments/:id/submit` (최종 제출 - 학생)
- [x] `GET /api/v1/submissions/:id` (제출물 상세 - 교사)
- [x] `PATCH /api/v1/submissions/:id/feedback` (피드백 - 교사)
- [x] `POST /api/v1/submissions/:id/publish` (제출물 공개 - 교사)

**참조**: `server/routes/SPEC_ASSIGNMENTS.md`

**프롬프트**:

```
server/routes/SPEC_ASSIGNMENTS.md를 읽고 Phase 2-7: Submissions API를 구현해줘
```

---

### 2-8: Files API (파일 업로드)

- [x] `server/middleware/upload.js` (Multer + MIME 검증)
- [x] `server/routes/files.js`
- [x] `POST /api/v1/files` (파일 업로드)
- [x] `GET /api/v1/files/:id/download` (파일 다운로드)
- [x] `GET /api/v1/files/:id` (파일 정보 조회)
- [x] `DELETE /api/v1/files/:id` (파일 삭제)
- [x] `POST /api/v1/submissions/:id/files` (제출물 파일 업로드)
- [x] `GET /api/v1/posts/:postId/files` (게시물 첨부파일 목록)
- [x] `GET /api/v1/submissions/:submissionId/files` (제출물 첨부파일 목록)

**참조**: `server/middleware/SPEC_UPLOAD.md`

**프롬프트**:

```
server/middleware/SPEC_UPLOAD.md를 읽고 Phase 2-8: Files API를 구현해줘
```

---

## Phase 3: React 프론트엔드

> 기본 UI 구조 + 라우팅 + 상태관리

### 3-1: Vite + React 초기화

- [x] `client/` 프로젝트 생성
- [x] TypeScript 설정
- [x] Tailwind CSS 설정
- [x] Vite 프록시 설정 (`vite.config.ts`)

**참조**: `client/CLAUDE.md` → Vite Config

**프롬프트**:

```
client/CLAUDE.md를 읽고 Phase 3-1: Vite + React 초기화를 구현해줘
```

---

### 3-2: 공통 컴포넌트

- [x] `client/src/components/ui.tsx` 확장/검토
- [x] Badge, Button, Input, Card, Modal, Toast 확인

**참조**: `client/CLAUDE.md` → Component Usage, `client/src/components/ui.tsx`

**프롬프트**:

```
client/src/components/ui.tsx를 읽고 누락된 컴포넌트가 있는지 확인해줘
```

---

### 3-3: 상태 관리 (Zustand)

- [x] `client/src/stores/authStore.ts`
- [x] `client/src/stores/connectionStore.ts`
- [x] `client/src/lib/api.ts` (API 유틸리티)

**참조**: `client/CLAUDE.md` → State Management, API Calls

**프롬프트**:

```
client/CLAUDE.md를 읽고 Phase 3-3: Zustand 스토어를 구현해줘
```

---

### 3-4: 라우팅 + 레이아웃

- [x] `client/src/App.tsx` (라우터 설정)
- [x] `client/src/layouts/TeacherLayout.tsx` (사이드바)
- [x] `client/src/layouts/StudentLayout.tsx` (하단 네비게이션)
- [x] 인증 가드 (ProtectedRoute)

**참조**: `client/CLAUDE.md` → Layout Patterns

**프롬프트**:

```
client/CLAUDE.md를 읽고 Phase 3-4: 라우팅과 레이아웃을 구현해줘
```

---

### 3-5: 로그인 페이지

- [x] `client/src/pages/Login.tsx`
- [x] 로그인 폼
- [x] 에러 처리 (잘못된 자격 증명, Rate Limit)
- [x] 로그인 성공 시 리다이렉트

**참조**: `client/src/lib/SPEC_AUTH.md`

**프롬프트**:

```
client/src/lib/SPEC_AUTH.md를 읽고 Phase 3-5: 로그인 페이지를 구현해줘
```

---

### 3-6: 대시보드

- [x] `client/src/pages/Dashboard.tsx`
- [x] 교사: 반 목록 + 통계 카드
- [x] 학생: 반 홈 (공지, 최근 과제)

**프롬프트**:

```
Phase 3-6: 대시보드 페이지를 구현해줘. 교사는 반 목록, 학생은 반 홈을 보여줘
```

---

### 3-7: 반/팀/학생 관리 (교사)

- [x] `client/src/pages/AdminClasses.tsx`
- [x] `client/src/pages/AdminUsers.tsx`
- [x] `client/src/pages/AdminTeams.tsx`

**참조**: `client/src/pages/SPEC_ADMIN.md`

**프롬프트**:

```
client/src/pages/SPEC_ADMIN.md를 읽고 Phase 3-7: 관리 페이지를 구현해줘
```

---

### 3-8: 게시판 (공지/자료)

- [x] `client/src/pages/Board.tsx` (목록)
- [x] `client/src/pages/PostDetail.tsx` (상세)
- [x] `client/src/pages/PostForm.tsx` (작성/수정)

**참조**: `client/src/pages/SPEC_POSTS.md`

**프롬프트**:

```
client/src/pages/SPEC_POSTS.md를 읽고 Phase 3-8: 게시판 페이지를 구현해줘
```

---

### 3-9: 과제 목록/상세

- [x] `client/src/pages/AssignmentList.tsx`
- [x] `client/src/pages/AssignmentDetail.tsx`
- [x] `client/src/pages/AssignmentForm.tsx` (출제 - 교사)

**참조**: `client/src/pages/SPEC_ASSIGNMENTS.md`

**프롬프트**:

```
client/src/pages/SPEC_ASSIGNMENTS.md를 읽고 Phase 3-9: 과제 페이지를 구현해줘
```

---

### 3-10: 과제 제출/피드백

- [x] `client/src/pages/AssignmentDetail.tsx` (학생 제출 - 기존 구현에 포함)
- [x] `client/src/pages/SubmissionList.tsx` (교사 - 제출 현황)
- [x] `client/src/pages/SubmissionDetail.tsx` (교사 - 피드백)

**참조**: `client/src/pages/SPEC_ASSIGNMENTS.md`

**프롬프트**:

```
client/src/pages/SPEC_ASSIGNMENTS.md를 읽고 Phase 3-10: 제출/피드백 페이지를 구현해줘
```

---

### 3-11: 파일 업로드 훅

- [x] `client/src/hooks/useFileUpload.ts`
- [x] XHR 기반 진행률 표시
- [x] 업로드 취소 기능

**참조**: `client/src/hooks/SPEC_UPLOAD.md`

**프롬프트**:

```
client/src/hooks/SPEC_UPLOAD.md를 읽고 Phase 3-11: 파일 업로드 훅을 구현해줘
```

---

## Phase 4: 실시간 기능

> Socket.IO + Yjs 공동 편집

### 4-1: Socket.IO 서버 설정

- [ ] `server/sockets/index.js`
- [ ] 인증된 소켓 연결
- [ ] Room 관리 (class, team, user)

**참조**: `server/sockets/SPEC_REALTIME.md`, `server/CLAUDE.md` → Socket.IO Rooms

**프롬프트**:

```
server/sockets/SPEC_REALTIME.md를 읽고 Phase 4-1: Socket.IO 서버를 구현해줘
```

---

### 4-2: 실시간 알림

- [ ] 알림 이벤트 발송 (새 공지, 과제, 피드백)
- [ ] 알림 API (`GET /api/v1/notifications`)

**참조**: `server/sockets/SPEC_REALTIME.md`

**프롬프트**:

```
server/sockets/SPEC_REALTIME.md를 읽고 Phase 4-2: 실시간 알림을 구현해줘
```

---

### 4-3: Socket.IO 클라이언트

- [ ] `client/src/lib/socket.ts`
- [ ] 연결 상태 관리
- [ ] 알림 수신 + Toast 표시

**참조**: `client/src/pages/SPEC_REALTIME.md`, `client/CLAUDE.md` → Socket.IO Client

**프롬프트**:

```
client/src/pages/SPEC_REALTIME.md를 읽고 Phase 4-3: Socket.IO 클라이언트를 구현해줘
```

---

### 4-4: Yjs 서버 (공동 편집)

- [ ] `server/sockets/yjs.js`
- [ ] y-protocols 직접 사용 (y-websocket의 setupWSConnection 대신)
- [ ] SQLite persistence (ydoc_state 저장)

**참조**: `server/sockets/SPEC_COLLAB.md`

**프롬프트**:

```
server/sockets/SPEC_COLLAB.md를 읽고 Phase 4-4: Yjs 서버를 구현해줘
```

---

### 4-5: TipTap 에디터 (공동 편집)

- [ ] `client/src/pages/DocEditor.tsx`
- [ ] `client/src/lib/yjs.ts`
- [ ] TipTap + Collaboration Extension
- [ ] 커서 위치 공유

**참조**: `client/src/pages/SPEC_COLLAB.md`

**프롬프트**:

```
client/src/pages/SPEC_COLLAB.md를 읽고 Phase 4-5: TipTap 에디터를 구현해줘
```

---

## Phase 5: 고급 기능

> 팀 과제 제출, 오프라인 배너, PWA

### 5-1: 팀 과제 제출 로직

- [ ] 팀원 누구나 제출 가능
- [ ] 제출 충돌 방지 (version 필드)
- [ ] 팀 제출 현황 조회

**참조**: `server/routes/SPEC_ASSIGNMENTS.md` (팀 제출 섹션)

**프롬프트**:

```
server/routes/SPEC_ASSIGNMENTS.md의 팀 제출 섹션을 읽고 Phase 5-1을 구현해줘
```

---

### 5-2: 오프라인 배너

- [ ] `client/src/components/OfflineBanner.tsx`
- [ ] `client/src/hooks/useOnlineStatus.ts`
- [ ] 연결 끊김 시 UI 피드백

**프롬프트**:

```
Phase 5-2: 오프라인 배너를 구현해줘. 네트워크 연결이 끊기면 상단에 배너 표시
```

---

### 5-3: PWA 설정

- [ ] `vite-plugin-pwa` 설정
- [ ] `manifest.json`
- [ ] Service Worker (기본 캐싱)

**프롬프트**:

```
Phase 5-3: PWA 설정을 구현해줘. vite-plugin-pwa 사용
```

---

## Phase 6: 테스트 및 마무리

### 6-1: API 테스트

- [ ] 인증 플로우 테스트
- [ ] 과제 제출 플로우 테스트
- [ ] 파일 업로드 테스트

### 6-2: UI/UX 검토

- [ ] 모바일 반응형 확인
- [ ] 에러 메시지 사용자 친화적 확인
- [ ] 로딩 상태 표시 확인

### 6-3: 배포 준비

- [ ] 프로덕션 빌드 테스트
- [ ] 환경변수 체크리스트 확인
- [ ] 백업/복원 테스트

---

## 진행 상황 요약

| Phase | 설명          | 진행률   |
| ----- | ----------- | ----- |
| 0     | 인프라         | 6/6 ✅ |
| 1     | 인증 시스템      | 3/3 ✅ |
| 2     | REST API    | 8/8 ✅ |
| 3     | React 프론트엔드 | 11/11 ✅ |
| 4     | 실시간 기능      | 0/5   |
| 5     | 고급 기능       | 0/3   |
| 6     | 테스트 및 마무리   | 0/3   |

**전체**: 28/39 단계 완료

---

## Claude Code 사용 팁

### 컨텍스트 절약

1. **한 번에 하나의 Phase만 요청** - "Phase 0-1을 구현해줘"
2. **SPEC 파일 참조 명시** - Claude가 필요한 파일만 읽음
3. **탐색은 Explore 에이전트 사용** - "Explore 에이전트로 현재 라우트 구조 파악해줘"

### 새 대화 시작 시

```
"PLAN.md를 읽고 현재 진행 상황을 파악해줘"
```

### 작업 완료 표시

```
"Phase 0-1이 완료되었어. PLAN.md에서 해당 체크박스를 체크해줘"
```

### 문제 발생 시

```
"현재 Phase 0-3에서 sql.js 초기화 에러가 발생해. server/db.js를 확인해줘"
```
