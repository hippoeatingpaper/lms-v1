# Phase 2: REST API - 테스트 체크리스트

> 핵심 비즈니스 로직 API 테스트

---

## 2-1: Auth API

### POST /api/v1/auth/login
- [ ] 올바른 자격 증명으로 로그인 성공 (200)
- [ ] Access Token 쿠키 설정 확인
- [ ] Refresh Token 쿠키 설정 확인
- [ ] 응답에 사용자 정보 포함 (id, name, role)
- [ ] 잘못된 아이디로 로그인 실패 (401)
- [ ] 잘못된 비밀번호로 로그인 실패 (401)
- [ ] 빈 요청 바디로 로그인 실패 (400)

### POST /api/v1/auth/logout
- [ ] 로그아웃 성공 (200)
- [ ] Access Token 쿠키 삭제 확인
- [ ] Refresh Token 쿠키 삭제 확인
- [ ] 로그아웃 후 인증 필요 API 접근 불가

### POST /api/v1/auth/refresh
- [ ] 유효한 Refresh Token으로 갱신 성공 (200)
- [ ] 새 Access Token 발급 확인
- [ ] 만료된 Refresh Token으로 갱신 실패 (401)
- [ ] 유효하지 않은 Refresh Token으로 갱신 실패 (401)

### GET /api/v1/auth/me
- [ ] 인증된 사용자 정보 반환 (200)
- [ ] 교사: id, name, role='teacher' 포함
- [ ] 학생: id, name, role='student', classId, teamId 포함
- [ ] 비인증 요청 시 401 반환

---

## 2-2: Classes API

### GET /api/v1/classes
- [ ] 교사: 전체 반 목록 반환
- [ ] 학생: 자신의 반만 반환
- [ ] 각 반 정보에 id, name, description 포함
- [ ] 학생 수 통계 포함

### POST /api/v1/classes (교사 전용)
- [ ] 반 생성 성공 (201)
- [ ] 생성된 반 정보 반환
- [ ] 필수 필드 누락 시 400 반환
- [ ] 학생 계정으로 접근 시 403 반환
- [ ] 중복 반 이름 처리 확인

### GET /api/v1/classes/:id
- [ ] 반 상세 정보 반환 (200)
- [ ] 소속 학생 목록 포함
- [ ] 팀 목록 포함
- [ ] 존재하지 않는 반 접근 시 404 반환
- [ ] 학생: 다른 반 접근 시 403 반환

### PUT /api/v1/classes/:id (교사 전용)
- [ ] 반 정보 수정 성공 (200)
- [ ] 수정된 반 정보 반환
- [ ] 학생 계정으로 접근 시 403 반환
- [ ] 존재하지 않는 반 수정 시 404 반환

### DELETE /api/v1/classes/:id (교사 전용)
- [ ] 반 삭제 성공 (200)
- [ ] 연관 데이터 처리 확인 (학생, 팀, 게시글 등)
- [ ] 학생 계정으로 접근 시 403 반환
- [ ] 존재하지 않는 반 삭제 시 404 반환

---

## 2-3: Users API (학생 관리)

### GET /api/v1/classes/:classId/users
- [ ] 해당 반의 학생 목록 반환
- [ ] 각 학생: id, loginId, name, teamId 포함
- [ ] 페이지네이션 지원 확인 (선택적)
- [ ] 존재하지 않는 반 접근 시 404 반환

### POST /api/v1/classes/:classId/users (교사 전용)
- [ ] 학생 일괄 생성 성공 (201)
- [ ] 배열 형태로 다수 학생 생성
- [ ] 각 학생에 loginId, name, 초기 비밀번호 설정
- [ ] 중복 loginId 시 에러 반환
- [ ] 학생 계정으로 접근 시 403 반환

### PUT /api/v1/users/:id (교사 전용)
- [ ] 학생 정보 수정 성공 (200)
- [ ] 이름 변경 가능
- [ ] 반 변경 가능 (classId)
- [ ] 학생 계정으로 접근 시 403 반환
- [ ] 존재하지 않는 학생 수정 시 404 반환

### DELETE /api/v1/users/:id (교사 전용)
- [ ] 학생 삭제 성공 (200)
- [ ] 연관 데이터 처리 확인 (제출물, 팀 멤버십 등)
- [ ] 학생 계정으로 접근 시 403 반환
- [ ] 교사 계정은 삭제 불가 (400 또는 403)

### POST /api/v1/users/:id/reset-password (교사 전용)
- [ ] 비밀번호 초기화 성공 (200)
- [ ] 초기화된 비밀번호 반환 (또는 기본값 설정)
- [ ] 학생 계정으로 접근 시 403 반환
- [ ] 존재하지 않는 학생 시 404 반환

---

## 2-4: Teams API

### GET /api/v1/classes/:classId/teams
- [ ] 해당 반의 팀 목록 반환
- [ ] 각 팀: id, name, memberCount 포함
- [ ] 팀원 목록 포함 (선택적)

### POST /api/v1/classes/:classId/teams (교사 전용)
- [ ] 팀 생성 성공 (201)
- [ ] 팀 이름 설정
- [ ] 학생 계정으로 접근 시 403 반환
- [ ] 중복 팀 이름 처리 확인

### PUT /api/v1/teams/:id (교사 전용)
- [ ] 팀 정보 수정 성공 (200)
- [ ] 팀 이름 변경 가능
- [ ] 학생 계정으로 접근 시 403 반환
- [ ] 존재하지 않는 팀 수정 시 404 반환

### DELETE /api/v1/teams/:id (교사 전용)
- [ ] 팀 삭제 성공 (200)
- [ ] 팀원들의 teamId null 처리
- [ ] 학생 계정으로 접근 시 403 반환

### POST /api/v1/teams/:id/members (교사 전용)
- [ ] 팀원 배정 성공 (200)
- [ ] 다른 팀에서 자동 제외 (1팀만 소속)
- [ ] 다른 반 학생 배정 시 400 반환
- [ ] 학생 계정으로 접근 시 403 반환

---

## 2-5: Posts API (게시판)

### GET /api/v1/classes/:classId/posts
- [ ] 게시글 목록 반환
- [ ] 각 게시글: id, title, category, author, createdAt 포함
- [ ] 카테고리별 필터링 (notice, material, free)
- [ ] 페이지네이션 지원
- [ ] 최신순 정렬

### POST /api/v1/classes/:classId/posts
- [ ] 게시글 작성 성공 (201)
- [ ] 교사: 공지(notice), 자료(material) 작성 가능
- [ ] 학생: 자유(free) 게시판만 작성 가능 (있는 경우)
- [ ] 첨부파일 연결 가능
- [ ] 필수 필드 누락 시 400 반환

### GET /api/v1/posts/:id
- [ ] 게시글 상세 조회 (200)
- [ ] 내용, 첨부파일, 댓글 포함
- [ ] 조회수 증가 확인
- [ ] 다른 반 게시글 접근 시 403 반환

### PUT /api/v1/posts/:id
- [ ] 게시글 수정 성공 (200)
- [ ] 작성자 또는 교사만 수정 가능
- [ ] 다른 사용자 수정 시 403 반환

### DELETE /api/v1/posts/:id
- [ ] 게시글 삭제 성공 (200)
- [ ] 작성자 또는 교사만 삭제 가능
- [ ] 연관 댓글도 삭제 확인
- [ ] 다른 사용자 삭제 시 403 반환

### POST /api/v1/posts/:id/comments
- [ ] 댓글 작성 성공 (201)
- [ ] 대댓글 지원 (parentId 있는 경우)
- [ ] 작성자 정보 포함

### POST /api/v1/posts/:id/like
- [ ] 좋아요 토글 성공 (200)
- [ ] 좋아요 상태 반환 (liked: true/false)
- [ ] 중복 좋아요 방지 (토글로 해제)

---

## 2-6: Assignments API (과제 출제)

### GET /api/v1/classes/:classId/assignments
- [ ] 과제 목록 반환
- [ ] 각 과제: id, title, dueDate, type 포함
- [ ] 진행 중/마감 과제 구분
- [ ] 학생: 제출 상태 포함

### POST /api/v1/classes/:classId/assignments (교사 전용)
- [ ] 과제 출제 성공 (201)
- [ ] 개인/팀 과제 타입 설정
- [ ] 마감일 설정
- [ ] 첨부파일 연결 가능
- [ ] 학생 계정으로 접근 시 403 반환

### GET /api/v1/assignments/:id
- [ ] 과제 상세 조회 (200)
- [ ] 지시문, 첨부파일 포함
- [ ] 학생: 자신의 제출 정보 포함
- [ ] 다른 반 과제 접근 시 403 반환

### PUT /api/v1/assignments/:id (교사 전용)
- [ ] 과제 수정 성공 (200)
- [ ] 마감일 연장 가능
- [ ] 학생 계정으로 접근 시 403 반환

### DELETE /api/v1/assignments/:id (교사 전용)
- [ ] 과제 삭제 성공 (200)
- [ ] 연관 제출물 처리 확인
- [ ] 학생 계정으로 접근 시 403 반환

---

## 2-7: Submissions API (과제 제출)

### GET /api/v1/assignments/:assignmentId/submissions (교사 전용)
- [ ] 제출 목록 반환
- [ ] 각 제출: 학생/팀, 상태, 제출일 포함
- [ ] 미제출자 목록 포함
- [ ] 학생 계정으로 접근 시 403 반환

### GET /api/v1/assignments/:assignmentId/my-submission
- [ ] 자신의 제출 정보 반환 (200)
- [ ] 팀 과제: 팀 제출 정보 반환
- [ ] 미제출 시 빈 응답 또는 null

### POST /api/v1/assignments/:assignmentId/submissions
- [ ] 제출 생성 성공 (201)
- [ ] 초안 상태로 생성 (submitted: false)
- [ ] 마감 후 제출 불가 (400)
- [ ] 팀 과제: 팀원 누구나 생성 가능

### PUT /api/v1/submissions/:id
- [ ] 답안 수정 성공 (200)
- [ ] 최종 제출 전까지만 수정 가능
- [ ] 다른 사용자 제출물 수정 시 403 반환
- [ ] 버전 충돌 처리 확인

### POST /api/v1/submissions/:id/submit
- [ ] 최종 제출 성공 (200)
- [ ] submitted: true, submittedAt 설정
- [ ] 이미 제출된 과제 재제출 불가 (400)
- [ ] 마감 후 제출 불가 (400)

### POST /api/v1/submissions/:id/feedback (교사 전용)
- [ ] 피드백 작성 성공 (200)
- [ ] 점수, 코멘트 설정
- [ ] 즉시 저장 확인 (criticalTransaction)
- [ ] 학생 계정으로 접근 시 403 반환

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
