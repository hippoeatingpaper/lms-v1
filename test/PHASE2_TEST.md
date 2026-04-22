# Phase 2: REST API - 테스트 체크리스트

> 핵심 비즈니스 로직 API 테스트

---

## 2-1: Auth API

### POST /api/v1/auth/login

- [x] 올바른 자격 증명으로 로그인 성공 (200)
- [x] Access Token 쿠키 설정 확인
- [x] Refresh Token 쿠키 설정 확인
- [x] 응답에 사용자 정보 포함 (id, name, role)
- [x] 잘못된 아이디로 로그인 실패 (401)
- [x] 잘못된 비밀번호로 로그인 실패 (401)
- [x] 빈 요청 바디로 로그인 실패 (400)

### POST /api/v1/auth/logout

- [x] 로그아웃 성공 (200)
- [x] Access Token 쿠키 삭제 확인
- [x] Refresh Token 쿠키 삭제 확인
- [x] 로그아웃 후 인증 필요 API 접근 불가

### POST /api/v1/auth/refresh

- [x] 유효한 Refresh Token으로 갱신 성공 (200)
- [x] 새 Access Token 발급 확인
- [x] 만료된 Refresh Token으로 갱신 실패 (401)
- [x] 유효하지 않은 Refresh Token으로 갱신 실패 (401)

### GET /api/v1/auth/me

- [x] 인증된 사용자 정보 반환 (200)
- [x] 교사: id, name, role='teacher' 포함
- [x] 학생: id, name, role='student', class_id, team_id 포함
- [x] 비인증 요청 시 401 반환

> **테스트 완료일**: 2026-04-19
> **테스트 방법**: `node test/phase2-1-test.js` (15개 테스트 모두 통과)
> **비고**:
> 
> - httpOnly 쿠키 설정으로 JavaScript 접근 불가
> - Refresh Token Rotation 적용 (갱신 시 새 토큰 발급)
> - loginLimiter 적용 (username당 5회/15분 제한)

---

## 2-2: Classes API

### GET /api/v1/classes

- [x] 교사: 전체 반 목록 반환
- [ ] 학생: 자신의 반만 반환 (현재 교사 전용 구현) → 현재 구현 불필요 
- [x] 각 반 정보에 id, name 포함
- [x] 학생 수 통계 포함 (stats.student_count)

### POST /api/v1/classes (교사 전용)

- [x] 반 생성 성공 (201)
- [x] 생성된 반 정보 반환
- [x] 필수 필드 누락 시 400 반환
- [x] 학생 계정으로 접근 시 403 반환
- [x] 중복 반 이름 처리 확인

### GET /api/v1/classes/:id

- [x] 반 상세 정보 반환 (200)
- [ ] 소속 학생 목록 포함 (미구현) → Phase 2-3에서 별도 API 제공 예정 
- [ ] 팀 목록 포함 (미구현) → Phase 2-4에서 별도 API 제공 예정 
- [x] 존재하지 않는 반 접근 시 404 반환
- [ ] 학생: 다른 반 접근 시 403 반환 (현재 교사 전용) → Phase 3-6에서 프론트엔드 대시보드 구현 시 결정 가능 

### PUT/PATCH /api/v1/classes/:id (교사 전용)

- [x] 반 정보 수정 성공 (200) - PATCH 사용
- [x] 수정된 반 정보 반환
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 반 수정 시 404 반환

### DELETE /api/v1/classes/:id (교사 전용)

- [x] 반 삭제 성공 (200)
- [x] 연관 데이터 처리 확인 (학생이 있으면 삭제 불가)
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 반 삭제 시 404 반환

> **테스트 완료일**: 2026-04-19
> **테스트 방법**: `node test/phase2-2-test.js` (20개 테스트 모두 통과)
> **비고**:
> 
> - 현재 Classes API는 교사 전용으로 구현됨 (requireTeacher 미들웨어)
> - 학생 접근 기능은 추후 필요시 구현 가능
> - 반 수정은 PUT 대신 PATCH 메서드 사용
> - 반 삭제 시 학생이 배정된 반은 삭제 불가 (HAS_STUDENTS 에러)

---

## 2-3: Users API (학생 관리)

### GET /api/v1/users (학생 목록)

- [x] 전체 학생 목록 반환 (교사 전용)
- [x] class_id 쿼리 파라미터로 반별 필터링
- [x] 각 학생: id, username, name, class_id, team_id, class_name, team_name 포함
- [x] 학생 계정으로 접근 시 403 반환

### GET /api/v1/users/:userId (학생 상세)

- [x] 학생 상세 정보 반환 (200)
- [x] 존재하지 않는 학생 조회 시 404 반환

### POST /api/v1/users (학생 생성 - 교사 전용)

- [x] 학생 생성 성공 (201)
- [x] name, username, password 필수 필드 검증
- [x] class_id로 반 배정 가능 (선택)
- [x] 중복 username 시 400 (DUPLICATE_USERNAME)
- [x] 존재하지 않는 반에 배정 시 400 (INVALID_CLASS)
- [x] 학생 계정으로 접근 시 403 반환

### POST /api/v1/users/bulk (학생 일괄 생성 - 교사 전용)

- [x] 학생 일괄 생성 성공 (201)
- [x] 배열 형태로 다수 학생 생성
- [x] 생성 성공/실패 카운트 반환
- [x] 일부 실패 시 실패 목록과 이유 반환
- [x] 빈 배열 시 400 반환

### PATCH /api/v1/users/:userId (학생 정보 수정 - 교사 전용)

- [x] 학생 정보 수정 성공 (200)
- [x] 이름 변경 가능 (name)
- [x] 반 변경 가능 (class_id)
- [x] 반 변경 시 팀 자동 해제 (team_id = null)
- [x] 팀 변경 가능 (team_id) - 같은 반 소속 팀만
- [x] 수정할 항목 없으면 400 반환
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 학생 수정 시 404 반환
- [x] 존재하지 않는 반/팀으로 변경 시 400 반환

### DELETE /api/v1/users/:userId (학생 삭제 - 교사 전용)

- [x] 학생 삭제 성공 (200)
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 학생 삭제 시 404 반환
- [x] 교사 계정은 삭제 불가 (role 검증)

### POST /api/v1/users/:userId/reset-password (비밀번호 초기화 - 교사 전용)

- [x] 비밀번호 초기화 성공 (200)
- [x] new_password 필수 필드 검증
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 학생 시 404 반환

> **테스트 완료일**: 2026-04-19
> **테스트 방법**: `node test/phase2-3-test.js` (30개 테스트 모두 통과)
> **비고**:
>
> - 모든 엔드포인트는 교사 전용 (requireTeacher 미들웨어)
> - class_id 필터로 반별 학생 조회 가능
> - 일괄 생성 시 트랜잭션으로 처리
> - 비밀번호 초기화 시 new_password 직접 지정 방식

---

## 2-4: Teams API

### GET /api/v1/classes/:classId/teams

- [x] 해당 반의 팀 목록 반환
- [x] 각 팀: id, name, members 포함
- [x] 미배정 학생 목록 포함 (unassigned)

### POST /api/v1/classes/:classId/teams (교사 전용)

- [x] 팀 생성 성공 (201)
- [x] 팀 이름 설정
- [x] 학생 계정으로 접근 시 403 반환
- [x] 중복 팀 이름 처리 확인 (DUPLICATE_NAME)

### PATCH /api/v1/teams/:id (교사 전용)

- [x] 팀 정보 수정 성공 (200)
- [x] 팀 이름 변경 가능
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 팀 수정 시 404 반환
- [x] 같은 반 내 중복 이름으로 수정 시 400 반환

### DELETE /api/v1/teams/:id (교사 전용)

- [x] 팀 삭제 성공 (200)
- [x] 팀원들의 team_id null 처리
- [x] 학생 계정으로 접근 시 403 반환

### POST /api/v1/teams/:id/members (교사 전용)

- [x] 팀원 배정 성공 (200)
- [x] 이미 다른 팀에 배정된 학생 재배정 시 400 반환 (ALREADY_ASSIGNED)
- [x] 다른 반 학생 배정 시 400 반환 (INVALID_USER)
- [x] 학생 계정으로 접근 시 403 반환

### DELETE /api/v1/teams/:id/members/:userId (교사 전용)

- [x] 팀원 제거 성공 (200)
- [x] 팀에 없는 학생 제거 시 404 반환

> **테스트 완료일**: 2026-04-20
> **테스트 방법**: `node test/phase2-4-test.js` (30개 테스트 모두 통과)
> **비고**:
>
> - 모든 엔드포인트는 교사 전용 (requireTeacher 미들웨어)
> - 팀 수정은 PUT 대신 PATCH 메서드 사용
> - 팀 삭제 시 소속 학생들의 team_id가 NULL로 자동 변경됨
> - criticalTransaction으로 팀 배정/삭제 작업의 원자성 보장

---

## 2-5: Posts API (게시판)

### GET /api/v1/classes/:classId/posts

- [x] 게시글 목록 반환
- [x] 각 게시글: id, title, type, author, created_at 포함
- [x] 카테고리별 필터링 (notice, material)
- [x] 페이지네이션 지원
- [x] 최신순 정렬

### POST /api/v1/classes/:classId/posts (교사 전용)

- [x] 게시글 작성 성공 (201)
- [x] 교사: 공지(notice), 자료(material) 작성 가능
- [x] 학생: 게시글 작성 시 403 반환 (교사 전용)
- [x] 첨부파일 연결 가능 (file_ids 파라미터)
- [x] 필수 필드 누락 시 400 반환
- [x] 유효하지 않은 타입 시 400 반환

### GET /api/v1/posts/:id

- [x] 게시글 상세 조회 (200)
- [x] 내용, 첨부파일 포함
- [x] 좋아요 정보 포함 (like_count, liked_by_me)
- [x] 다른 반 게시글 접근 시 403 반환

### PATCH /api/v1/posts/:id

- [x] 게시글 수정 성공 (200)
- [x] 교사: 모든 게시글 수정 가능
- [x] 학생: 본인 글만 수정 가능 (교사 글 수정 시 403)
- [x] 존재하지 않는 게시글 수정 시 404 반환

### DELETE /api/v1/posts/:id

- [x] 게시글 삭제 성공 (200)
- [x] 교사: 모든 게시글 삭제 가능
- [x] 학생: 본인 글만 삭제 가능 (교사 글 삭제 시 403)
- [x] 연관 댓글도 삭제 확인 (CASCADE)
- [x] 존재하지 않는 게시글 삭제 시 404 반환

### POST /api/v1/posts/:id/comments

- [x] 댓글 작성 성공 (201)
- [x] 작성자 정보 포함 (author.id, author.name)
- [x] 댓글 내용 누락 시 400 반환
- [x] 존재하지 않는 게시글에 댓글 작성 시 404 반환

### GET /api/v1/posts/:postId/comments

- [x] 댓글 목록 조회 성공
- [x] 페이지네이션 지원

### POST /api/v1/posts/:id/like

- [x] 좋아요 토글 성공 (200)
- [x] 좋아요 상태 반환 (liked: true/false)
- [x] 중복 좋아요 방지 (토글로 해제)
- [x] 존재하지 않는 게시글 좋아요 시 404 반환

> **테스트 완료일**: 2026-04-21
> **테스트 방법**: `node test/phase2-5-test.js` (39개 테스트 모두 통과)
> **비고**:
>
> - 게시글 작성/수정/삭제는 교사 전용 (requireTeacher 미들웨어)
> - 댓글과 좋아요는 교사/학생 모두 사용 가능
> - 학생은 본인 반 게시글만 조회 가능
> - 교사는 모든 게시글 수정/삭제 가능

---

## 2-6: Assignments API (과제 출제)

### GET /api/v1/classes/:classId/assignments

- [x] 과제 목록 반환
- [x] 각 과제: id, title, scope, due_at, author 포함
- [x] scope별 필터링 (individual/team)
- [x] 페이지네이션 지원
- [x] 학생: 제출 상태(submission_status) 포함

### POST /api/v1/assignments (교사 전용)

- [x] 과제 출제 성공 (201)
- [x] 개인/팀 과제 타입(scope) 설정
- [x] 마감일(due_at) 설정
- [x] 다양한 질문 타입 지원 (essay, short, multiple_choice, file)
- [x] 객관식 질문 옵션 설정 가능
- [x] 학생 계정으로 접근 시 403 반환
- [x] 필수 필드 누락 시 400 반환 (title, scope, questions)
- [x] 유효하지 않은 질문 타입 시 400 반환

### GET /api/v1/assignments/:id

- [x] 과제 상세 조회 (200)
- [x] 설명(description), 질문 목록(questions) 포함
- [x] 학생: 자신의 제출 정보(submission, answers) 포함
- [x] 다른 반 과제 접근 시 403 반환

### PUT /api/v1/assignments/:id (교사 전용)

- [x] 과제 수정 성공 (200)
- [x] 마감일 연장 가능
- [x] 제목, 설명 수정 가능
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 과제 수정 시 404 반환

### DELETE /api/v1/assignments/:id (교사 전용)

- [x] 과제 삭제 성공 (200)
- [x] 연관 제출물(submissions), 응답(answers), 질문(questions) 처리 확인
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 과제 삭제 시 404 반환

> **테스트 완료일**: 2026-04-22
> **테스트 방법**: `node test/phase2-6-test.js` (40개 테스트 모두 통과)
> **비고**:
>
> - POST /api/v1/assignments (교사 전용) - 과제 출제
> - 질문 타입: essay(서술형), short(단답형), multiple_choice(객관식), file(파일)
> - 과제 유형(scope): individual(개인), team(팀)
> - class_id가 null이면 전체 반 대상 과제
> - criticalTransaction으로 과제/질문 생성의 원자성 보장

---

## 2-7: Submissions API (과제 제출)

### POST /api/v1/assignments/:id/draft (임시저장 - 학생)

- [x] 임시저장 성공 (200, draft 상태로 생성)
- [x] 임시저장 업데이트 (버전 증가)
- [x] 팀 과제 임시저장 가능
- [x] 빈 answers 배열 시 400 반환
- [x] 존재하지 않는 과제에 임시저장 시 404 반환

### POST /api/v1/assignments/:id/submit (최종 제출 - 학생)

- [x] 최종 제출 성공 (200)
- [x] status=submitted, submitted_at 설정
- [x] 필수 질문 미응답 시 400 반환
- [x] 마감 후 제출 불가 (DEADLINE_PASSED)
- [x] 팀 과제 최종 제출 가능
- [x] 존재하지 않는 과제에 제출 시 404 반환

### GET /api/v1/assignments/:id/submissions (교사 전용)

- [x] 제출 목록 반환
- [x] 각 제출: submitter, status, submitted_at, has_feedback 포함
- [x] 통계(stats): total, submitted, draft, not_started
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 과제 조회 시 404 반환

### GET /api/v1/submissions/:id (교사 전용)

- [x] 제출물 상세 조회 성공 (200)
- [x] 질문 및 답변 포함
- [x] 팀원 정보 포함 (팀 과제인 경우)
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 제출물 조회 시 404 반환

### PATCH /api/v1/submissions/:id/feedback (교사 전용)

- [x] 피드백 작성 성공 (200)
- [x] 피드백 내용 저장 확인
- [x] 즉시 저장 확인 (criticalTransaction)
- [x] 피드백 내용 누락 시 400 반환
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 제출물에 피드백 시 404 반환

### POST /api/v1/submissions/:id/publish (교사 전용)

- [x] 제출물 공개 성공 (게시글 생성, post_id 반환)
- [x] 이미 공개된 제출물 재공개 시 400 반환 (ALREADY_PUBLISHED)
- [x] 학생 계정으로 접근 시 403 반환
- [x] 존재하지 않는 제출물 공개 시 404 반환

> **테스트 완료일**: 2026-04-22
> **테스트 방법**: `node test/phase2-7-test.js` (41개 테스트 모두 통과)
> **비고**:
>
> - POST /api/v1/assignments/:id/draft - 임시저장 (debouncedSave 사용)
> - POST /api/v1/assignments/:id/submit - 최종 제출 (criticalTransaction 사용)
> - 학생은 과제 상세 조회(GET /api/v1/assignments/:id)에서 본인/팀 제출물 확인 가능
> - 팀 과제: 같은 팀원 누구나 제출 가능, 팀 제출물 공유
> - 피드백/공개는 criticalTransaction으로 즉시 저장

---

## 2-8: Files API (파일 업로드)

### POST /api/v1/files

- [ ] 파일 업로드 성공 (201)
- [ ] 파일 정보 반환 (id, originalName, size)
- [ ] 타임스탬프 prefix 파일명 확인
- [ ] 일반 파일 20MB 제한 확인
- [ ] 동영상 100MB 제한 확인
- [ ] 허용되지 않은 MIME 타입 거부 (400)

### GET /api/v1/files/:id

- [ ] 파일 다운로드 성공 (200)
- [ ] Content-Disposition 헤더 설정
- [ ] 원본 파일명으로 다운로드
- [ ] 존재하지 않는 파일 시 404 반환
- [ ] 권한 없는 파일 접근 시 403 반환

### DELETE /api/v1/files/:id

- [ ] 파일 삭제 성공 (200)
- [ ] 실제 파일 시스템에서 삭제
- [ ] DB 레코드 삭제
- [ ] 작성자 또는 교사만 삭제 가능

### MIME 타입 검증 테스트

- [ ] 이미지 (jpg, png, gif) 허용
- [ ] 문서 (pdf, doc, docx, hwp) 허용
- [ ] 동영상 (mp4, mov) 허용
- [ ] 실행 파일 (exe, bat, sh) 거부
- [ ] 스크립트 (js, php) 거부

---

## 통합 테스트 시나리오

### 과제 제출 플로우

```
1. 교사: 과제 출제 (POST /assignments)
2. 학생: 과제 목록 확인 (GET /assignments)
3. 학생: 과제 상세 확인 (GET /assignments/:id)
4. 학생: 파일 업로드 (POST /files)
5. 학생: 제출 생성 (POST /submissions)
6. 학생: 답안 수정 (PUT /submissions/:id)
7. 학생: 최종 제출 (POST /submissions/:id/submit)
8. 교사: 제출 목록 확인 (GET /submissions)
9. 교사: 피드백 작성 (POST /submissions/:id/feedback)
```

- [ ] 위 플로우가 정상 동작

### 팀 과제 플로우

```
1. 교사: 팀 과제 출제 (type: 'team')
2. 팀원 A: 제출 생성
3. 팀원 B: 같은 제출 수정 가능 확인
4. 팀원 A: 최종 제출
5. 팀원 B: 수정 불가 확인
```

- [ ] 위 플로우가 정상 동작

---

## curl 테스트 예시

```bash
# 반 목록 조회
curl https://localhost:3000/api/v1/classes \
  -b cookies.txt -k

# 과제 출제
curl -X POST https://localhost:3000/api/v1/classes/1/assignments \
  -H "Content-Type: application/json" \
  -d '{"title":"첫 과제","description":"설명...","dueDate":"2024-12-31T23:59:59Z","type":"individual"}' \
  -b cookies.txt -k

# 파일 업로드
curl -X POST https://localhost:3000/api/v1/files \
  -F "file=@test.pdf" \
  -b cookies.txt -k
```

---

## 주의사항

1. **즉시 저장**: 제출/피드백은 `criticalTransaction()` 사용하여 즉시 저장
2. **마감 검증**: 서버 시간 기준으로 마감 판단
3. **파일 권한**: 게시글/과제에 연결된 파일은 해당 반 학생만 접근 가능
4. **트랜잭션**: 복합 작업(삭제 등)은 트랜잭션으로 원자성 보장
