# Classroom System - Claude Code Context

> 교사 노트북 기반 실시간 수업 관리 플랫폼

## Quick Facts

- **규모**: 교사 1명, 최대 6개 반, 반당 30명(180명)
- **접속**: 같은 WiFi에서 `https://192.168.x.x:3000`
- **인증**: JWT(3시간) + Refresh Token, httpOnly 쿠키

## Tech Stack

| Backend                     | Frontend                       |
| --------------------------- | ------------------------------ |
| Node.js + Express           | React + Vite + TypeScript      |
| sql.js (WebAssembly SQLite) | TipTap + Yjs (공동편집)            |
| Socket.IO + y-protocols     | Zustand + Tailwind CSS         |
| JWT + bcryptjs              | Socket.IO Client + y-websocket |

## Project Structure

```
classroom-system/
├── CLAUDE.md              ← 전체 개요 (현재 파일)
├── server/
│   ├── CLAUDE.md          ← 백엔드 규칙
│   ├── SPEC_SETUP.md      ← HTTPS, 환경변수, CLI
│   ├── SPEC_DATABASE.md   ← sql.js 래퍼, 저장 전략, 마이그레이션
│   ├── index.js, db.js
│   ├── routes/, middleware/, sockets/, migrations/
│   └── uploads/
├── client/
│   ├── CLAUDE.md          ← 프론트엔드 규칙, UI 패턴
│   └── src/
│       ├── components/ui.tsx  ← 공통 컴포넌트
│       ├── pages/, stores/, hooks/, lib/
│       └── vite.config.ts
├── scripts/               ← CLI 스크립트
├── data/                  ← database.db
└── certs/                 ← HTTPS 인증서
```

## Implementation Order

```
0단계: HTTPS + 민감경로차단 + 에러핸들러 + DB래퍼
       → server/SPEC_SETUP.md + server/SPEC_DATABASE.md + server/middleware/SPEC_AUTH.md

1단계: JWT 인증 + 역할/반 미들웨어
       → server/middleware/SPEC_AUTH.md

2단계: REST API (auth → classes → posts → assignments → submissions)
       → server/CLAUDE.md + 각 routes/SPEC_*.md

3단계: React 프론트엔드
       → client/CLAUDE.md + 각 pages/SPEC_*.md

4단계: 실시간 (Socket.IO → Yjs 공동편집)
       → server/sockets/SPEC_REALTIME.md + server/sockets/SPEC_COLLAB.md

5단계: 관리 기능 (반/팀/학생)
       → server/routes/SPEC_ADMIN.md + client/src/pages/SPEC_ADMIN.md

6단계: PWA + 테스트
```

## Document Reference Guide

| 작업                     | 참조 문서                                               |
| ---------------------- | --------------------------------------------------- |
| 서버 설정 (HTTPS, 환경변수)    | `server/SPEC_SETUP.md`                              |
| 데이터베이스 (sql.js, 저장 전략) | `server/SPEC_DATABASE.md`                           |
| 인증/보안                  | `server/middleware/SPEC_AUTH.md`                    |
| 파일 업로드                 | `server/middleware/SPEC_UPLOAD.md`                  |
| UI 컴포넌트                | `client/CLAUDE.md` + `client/src/components/ui.tsx` |

## Feature Specs (핵심 기능 상세)

| 기능              | 백엔드 스펙                              | 프론트엔드 스펙                               |
| --------------- | ----------------------------------- | -------------------------------------- |
| **서버 설정**       | `server/SPEC_SETUP.md`              | -                                      |
| **데이터베이스**      | `server/SPEC_DATABASE.md`           | -                                      |
| **인증/보안**       | `server/middleware/SPEC_AUTH.md`    | `client/src/lib/SPEC_AUTH.md`          |
| **파일 업로드**      | `server/middleware/SPEC_UPLOAD.md`  | `client/src/hooks/SPEC_UPLOAD.md`      |
| **반/팀/학생 관리**   | `server/routes/SPEC_ADMIN.md`       | `client/src/pages/SPEC_ADMIN.md`       |
| **게시판 (공지/자료)** | `server/routes/SPEC_POSTS.md`       | `client/src/pages/SPEC_POSTS.md`       |
| **과제 출제/제출**    | `server/routes/SPEC_ASSIGNMENTS.md` | `client/src/pages/SPEC_ASSIGNMENTS.md` |
| **공동 문서 편집**    | `server/sockets/SPEC_COLLAB.md`     | `client/src/pages/SPEC_COLLAB.md`      |
| **실시간 알림**      | `server/sockets/SPEC_REALTIME.md`   | `client/src/pages/SPEC_REALTIME.md`    |

> 핵심 기능 구현 시 해당 SPEC 파일을 반드시 참조하세요.

## Key Decisions (Already Made)

- 파일: 일반 20MB, 동영상 100MB, 타임스탬프 prefix
- 팀: 반 내 1팀만 소속, 팀원 누구나 제출 가능
- 저장: 디바운스 2초, 중요작업(제출/피드백)은 즉시 저장
- API: `/api/v1/...` prefix, 에러는 `{ error: { code, message } }`
- HTTPS: mkcert 자체 서명 인증서, 프로덕션 필수
- DB: sql.js (WebAssembly SQLite, 빌드 도구 불필요)

## Commands

```bash
node scripts/generateCert.js   # HTTPS 인증서 생성
node scripts/createTeacher.js  # 교사 계정 생성
npm run dev                    # 개발 서버
npm run build && npm start     # 프로덕션
npm run backup                 # DB + uploads 백업
npm run migrate:status         # 마이그레이션 상태 확인
```
