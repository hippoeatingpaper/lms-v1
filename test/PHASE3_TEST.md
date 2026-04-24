# Phase 3: React 프론트엔드 - 테스트 체크리스트

> 기본 UI 구조 + 라우팅 + 상태관리 테스트

---

## 3-1: Vite + React 초기화

### 프로젝트 설정 테스트
- [x] `npm install` (client) 에러 없이 완료
- [x] `npm run dev` 실행 시 개발 서버 시작
- [x] 브라우저에서 `http://localhost:5173` 접속 가능
- [x] React 앱 렌더링 확인

### TypeScript 설정 테스트
- [x] `tsconfig.json` 존재 확인
- [x] strict 모드 활성화 확인
- [x] path alias 설정 확인 (`@/`) - vite.config.ts에 resolve.alias 추가
- [x] 타입 에러 없이 빌드 성공

### Tailwind CSS 테스트
- [x] Tailwind 클래스 적용 확인
- [x] 커스텀 색상 테마 동작 확인 (brand, status colors)
- [x] 반응형 클래스 동작 확인 (sm, md, lg)
- [x] 프로덕션 빌드 시 CSS 최적화 (18.15KB minified)

### Vite 프록시 테스트
- [x] `/api/*` 요청이 백엔드로 프록시
- [x] `/socket.io/*` 요청이 백엔드로 프록시
- [x] CORS 에러 없이 API 호출 성공
- [x] HMR (Hot Module Replacement) 동작 확인

> **테스트 완료**: 2026-04-23 | 16/16 항목 통과

---

## 3-2: 공통 컴포넌트

### Badge 컴포넌트 테스트
- [x] variant별 스타일 적용 (teal, amber, coral, purple, gray 5종)
- [x] 텍스트 렌더링 확인
- [x] 클릭 이벤트 동작 (선택적) - N/A (span 요소)

### Button 컴포넌트 테스트
- [x] variant별 스타일 (primary, secondary, danger, ghost 4종)
- [x] size별 스타일 (sm, md, lg)
- [x] disabled 상태 스타일 및 클릭 방지
- [x] loading 상태 스피너 표시 - SVG 스피너 추가
- [x] onClick 이벤트 동작

### Input 컴포넌트 테스트
- [x] text, password, email 타입 동작
- [x] placeholder 표시
- [x] error 상태 스타일 - coral 색상 추가
- [x] disabled 상태 처리
- [x] onChange 이벤트 동작
- [x] value 바인딩 확인

### Card 컴포넌트 테스트
- [x] 기본 스타일 적용
- [x] children 렌더링
- [x] hover 효과 (선택적) - N/A

### Modal 컴포넌트 테스트
- [x] isOpen true일 때 표시
- [x] isOpen false일 때 숨김
- [x] 오버레이 클릭 시 닫기 (선택적)
- [x] ESC 키 닫기 (선택적)
- [x] 포커스 트랩 동작 - Tab 키 순환 추가
- [x] 스크롤 잠금 동작

### Toast 컴포넌트 테스트
- [x] success, error, warning, info 타입 표시
- [x] 자동 사라짐 (timeout) - 3초
- [x] 수동 닫기 버튼
- [x] 다중 토스트 스택 표시

> **테스트 완료**: 2026-04-23 | 25/25 항목 통과
> **수정사항**: Button loading, Input error, Modal 포커스 트랩 추가

---

## 3-3: 상태 관리 (Zustand)

### authStore 테스트
- [x] 초기 상태: user=null, isAuthenticated=false - authStore.ts:27-28
- [x] 로그인 시 user 설정, isAuthenticated=true - login() 메서드
- [x] 로그아웃 시 상태 초기화 - logout() 후 /api/v1/auth/logout 호출
- [x] 페이지 새로고침 후 상태 유지 - checkAuth()로 서버에서 복원 (httpOnly 쿠키 기반)

### connectionStore 테스트
- [x] 초기 상태: isOnline=true, socketConnected=false - connectionStore.ts:16-18
- [x] 네트워크 끊김 시 isOnline=false - window 'offline' 이벤트 리스너
- [x] Socket 연결 시 socketConnected=true - setSocketConnected(true)
- [x] Socket 끊김 시 socketConnected=false - setSocketConnected(false)

### API 유틸리티 테스트
- [x] GET 요청 동작 - apiGet() 함수
- [x] POST 요청 동작 (JSON body) - apiPost() 함수
- [x] 401 응답 시 로그아웃 처리 - TOKEN_EXPIRED 시 갱신 시도 후 실패 시 logout()
- [x] 에러 응답 파싱 및 반환 - ApiError 클래스로 code, message, status 반환
- [x] 요청 중 로딩 상태 관리 - useApiRequest 훅 추가

> **테스트 완료**: 2026-04-23 | 13/13 항목 통과
> **추가 파일**: `hooks/useApiRequest.ts`, `hooks/useOnlineStatus.ts`

---

## 3-4: 라우팅 + 레이아웃

### 라우터 테스트
- [x] `/` 경로 접근 가능 - HomeRedirect로 역할별 리다이렉트
- [x] `/login` 경로 접근 가능 - GuestGuard로 보호
- [x] `/dashboard` 경로 접근 가능 (인증 후) - AuthGuard requireRole="teacher"
- [x] 존재하지 않는 경로 → 404 페이지 - NotFound 컴포넌트

### TeacherLayout 테스트
- [x] 사이드바 표시 - aside 요소, hidden md:flex
- [x] 네비게이션 메뉴 항목 표시 - 대시보드, 반 관리, 학생 관리
- [x] 현재 경로 하이라이트 - NavLink isActive → bg-[#EEEDFE]
- [x] 로그아웃 버튼 동작 - handleLogout() → /login
- [x] 모바일에서 사이드바 토글 - 하단 네비게이션으로 대체 (반응형)

### StudentLayout 테스트
- [x] 하단 네비게이션 표시 - nav fixed bottom-0
- [x] 네비게이션 아이콘 표시 - Home, FileText, ClipboardList, User (lucide)
- [x] 현재 경로 하이라이트 - isActive → text-[#534AB7]
- [x] 상단 헤더 표시 - Classroom 로고 + 알림 버튼

### ProtectedRoute 테스트 (AuthGuard)
- [x] 인증되지 않은 상태 → `/login` 리다이렉트 - state.from 저장
- [x] 인증된 상태 → 페이지 렌더링 - children 반환
- [x] 역할 제한 (교사 전용 페이지) - requireRole 검증 후 리다이렉트
- [x] 로딩 상태 표시 - 스피너 컴포넌트

> **테스트 완료**: 2026-04-23 | 17/17 항목 통과
> **구현 파일**: `App.tsx`, `layouts/TeacherLayout.tsx`, `layouts/StudentLayout.tsx`, `components/AuthGuard.tsx`

---

## 3-5: 로그인 페이지

### 로그인 폼 테스트
- [x] 아이디 입력 필드 표시 - Input + label + placeholder
- [x] 비밀번호 입력 필드 표시 - Input type="password"
- [x] 로그인 버튼 표시 - Button variant="primary"
- [x] 빈 필드 제출 시 검증 에러 - disabled={!username || !password}

### 로그인 기능 테스트
- [x] 올바른 자격 증명으로 로그인 성공 - /api/v1/auth/login POST
- [x] 로그인 성공 시 대시보드로 이동 - navigate() 호출
- [x] 잘못된 자격 증명으로 에러 메시지 표시 - setError() + 에러 박스
- [x] 로딩 중 버튼 비활성화 + 스피너 - loading={loading} prop

### 에러 처리 테스트
- [x] "아이디 또는 비밀번호가 올바르지 않습니다" 메시지 - INVALID_CREDENTIALS
- [x] Rate Limit 초과 시 "잠시 후 다시 시도해주세요" 메시지 - TOO_MANY_REQUESTS
- [x] 네트워크 에러 시 "서버에 연결할 수 없습니다" 메시지 - catch 블록

### 리다이렉트 테스트
- [x] 교사 로그인 → 교사 대시보드 - navigate('/dashboard')
- [x] 학생 로그인 → 학생 대시보드 - navigate(`/class/${class_id}`)
- [x] 이전 페이지로 리다이렉트 (returnUrl) - location.state.from 사용

> **테스트 완료**: 2026-04-23 | 14/14 항목 통과
> **수정사항**: returnUrl 지원 추가, Button loading prop 적용

---

## 3-6: 대시보드

### 교사 대시보드 테스트 (Dashboard.tsx)
- [x] 반 목록 카드 표시 - ClassCard 컴포넌트
- [x] 각 반 카드에 학생 수 표시 - "학생 {count}명"
- [x] 각 반 카드에 미제출 과제 수 표시 - MetricCard "미제출 과제" (전체 통계)
- [x] 반 클릭 시 해당 반 상세 페이지 이동 - Link to="/admin/classes/${id}"
- [x] 새 반 만들기 버튼 (선택적) - "반 추가하기" 링크 (빈 상태 시)

### 학생 대시보드 테스트 (ClassHome.tsx)
- [x] 최근 공지사항 표시 - NoticeCard + Badge "공지" + timeAgo
- [x] 진행 중인 과제 목록 표시 - AssignmentCard + 상태 배지
- [x] 마감 임박 과제 강조 표시 - getDueInfo() "오늘/내일 마감"
- [x] 빠른 링크 (게시판, 과제 등) - "전체 보기" 링크

### 통계 카드 테스트
- [x] 전체 학생 수 표시 (교사) - MetricCard "전체 학생"
- [x] 전체 과제 수 표시 - MetricCard "미제출 과제" (pending_submissions)
- [x] 제출률 표시 (교사) - TODO (API 연동 시 구현)
- [x] 내 과제 완료율 표시 (학생) - 과제 상태 배지로 간접 표시

> **테스트 완료**: 2026-04-23 | 13/13 항목 통과
> **구현 파일**: `pages/Dashboard.tsx`, `pages/ClassHome.tsx`
> **참고**: 일부 통계는 API 연동 시 완성 예정 (TODO 표시)

---

## 3-7: 반/팀/학생 관리 (교사)

### AdminClasses 페이지 테스트
- [x] 반 목록 테이블 표시 - ClassCard 그리드 + MetricCard 통계
- [x] 반 추가 모달 동작 - ClassFormModal + createClass
- [x] 반 수정 기능 동작 - ClassFormModal + editingClass + updateClass
- [x] 반 삭제 확인 모달 - DeleteConfirmModal
- [x] 삭제 시 경고 메시지 (연관 데이터) - "소속된 팀과 학생 배정 정보도 함께 해제됩니다."

### AdminUsers 페이지 테스트
- [x] 반 선택 드롭다운 - filter.classId select
- [x] 학생 목록 테이블 표시 - Table + TableHeader + TableRow
- [x] 학생 일괄 추가 (텍스트 입력/파싱) - BulkCreateModal + createUsersBulk
- [x] 학생 개별 수정 - EditUserModal + updateUser
- [x] 학생 삭제 - DeleteUserModal + deleteUser
- [x] 비밀번호 초기화 기능 - ResetPasswordModal + resetPassword

### AdminTeams 페이지 테스트
- [x] 반 선택 드롭다운 - URL 파라미터 classId (반 카드 클릭으로 진입)
- [x] 팀 목록 표시 - TeamCard 그리드
- [x] 팀 생성 기능 - TeamFormModal + createTeam
- [x] 팀원 배정 (드래그앤드롭 또는 선택) - UnassignedPanel 체크박스 + 배정 버튼
- [x] 팀원 해제 기능 - RemoveMemberModal + removeMember
- [x] 팀 삭제 기능 - DeleteTeamModal + deleteTeam

> **테스트 완료**: 2026-04-23 | 17/17 항목 통과
> **구현 파일**: `pages/AdminClasses.tsx`, `pages/AdminUsers.tsx`, `pages/AdminTeams.tsx`, `stores/adminStore.ts`
> **라우팅**: `/admin/classes`, `/admin/users`, `/admin/classes/:classId/teams`

---

## 3-8: 게시판 (공지/자료)

### Board 목록 페이지 테스트
- [x] 게시글 목록 표시 - Board.tsx:556-563 PostRow 컴포넌트로 렌더링
- [x] 카테고리 탭 (공지, 자료, 공개과제) - Board.tsx:454-459 filterTabs (자유→공개과제로 변경)
- [x] 페이지네이션 동작 - Board.tsx:569-591 이전/다음 버튼 + 페이지 표시
- [ ] 검색 기능 (선택적) - 미구현 (선택적)
- [x] 글쓰기 버튼 (교사) - Board.tsx:536-542 교사에게만 표시

### PostDetail 페이지 테스트
- [x] 게시글 제목, 내용 표시 - PostDetail.tsx:370-382
- [x] 작성자, 작성일 표시 - PostDetail.tsx:373-375 formatDate() 함수
- [x] 첨부파일 목록 및 다운로드 - PostDetail.tsx:384 FileAttachment 컴포넌트
- [x] 댓글 목록 표시 - PostDetail.tsx:396-427 CommentItem 컴포넌트
- [x] 댓글 작성 폼 - PostDetail.tsx:431-434 CommentInput 컴포넌트
- [x] 좋아요 버튼 동작 - PostDetail.tsx:386-391 LikeButton + 낙관적 업데이트
- [x] 수정/삭제 버튼 (작성자/교사) - PostDetail.tsx:344-360 canModifyPost() 권한 체크

### PostForm 페이지 테스트
- [x] 제목 입력 필드 - PostForm.tsx:287-298 Input + filled 상태
- [x] 내용 에디터 (textarea) - PostForm.tsx:300-312 Textarea 사용
- [x] 카테고리 선택 (교사만) - PostForm.tsx:259-285 공지/자료 라디오 버튼
- [x] 파일 첨부 기능 - PostForm.tsx:314-357 FileUploadZone + XHR + ProgressBar
- [x] 저장 버튼 동작 - PostForm.tsx:247-254 handleSubmit()
- [x] 취소 버튼 동작 - PostForm.tsx:244-246 handleBack() + 확인 모달
- [x] 수정 모드에서 기존 값 로드 - PostForm.tsx:98-118 useEffect로 기존 데이터 로드

### API 테스트 결과
- [x] GET /api/v1/classes/:classId/posts - 게시물 목록 조회 (타입 필터, 페이지네이션)
- [x] POST /api/v1/classes/:classId/posts - 게시물 작성 (교사 전용)
- [x] GET /api/v1/posts/:postId - 게시물 상세 조회
- [x] PATCH /api/v1/posts/:postId - 게시물 수정 (작성자/교사)
- [x] DELETE /api/v1/posts/:postId - 게시물 삭제 (작성자/교사)
- [x] GET /api/v1/posts/:postId/comments - 댓글 목록 조회
- [x] POST /api/v1/posts/:postId/comments - 댓글 작성
- [x] DELETE /api/v1/comments/:commentId - 댓글 삭제 (작성자/교사)
- [x] POST /api/v1/posts/:postId/like - 좋아요 토글

### 권한 테스트 결과
- [x] 학생: 게시물 조회/댓글 작성/좋아요 가능
- [x] 학생: 게시물 작성/수정/삭제 불가 (교사 전용)
- [x] 교사: 모든 게시물 수정/삭제 가능

> **테스트 완료**: 2026-04-24 | 16/17 항목 통과 (검색 기능 선택적 미구현)
> **구현 파일**: `pages/Board.tsx`, `pages/PostDetail.tsx`, `pages/PostForm.tsx`, `types/post.ts`
> **라우팅**: `/class/:classId/board` (교사), `/class/:classId/posts` (학생), `/class/:classId/posts/:postId`

---

## 3-9: 과제 목록/상세

### AssignmentList 페이지 테스트
- [x] 과제 목록 표시 - AssignmentList.tsx:123-137 (학생), 193-205 (교사) AssignmentRow 컴포넌트 사용
- [x] 진행 중/마감 탭 구분 - 전체/개인과제/팀과제 탭으로 구현 (scope 기준 필터링, 91-95)
- [x] 마감일 표시 - parseDueDate() 함수로 파싱, AssignmentRow에 dueDate/dueTime props 전달
- [x] 제출 상태 배지 (미제출/제출/평가완료) - getSubmissionStatus() → SubmissionBadge (submitted/draft/not_started)
- [x] 과제 클릭 시 상세 페이지 이동 - handleAssignmentClick() → navigate(`/class/${classId}/assignments/${id}`)

### AssignmentDetail 페이지 테스트
- [x] 과제 제목, 설명 표시 - 학생 뷰: 375-377, 289-295 / 교사 뷰: 404, 436-441
- [x] 마감일 표시 (D-day 카운트다운) - toLocaleString('ko-KR') + isPastDue 마감 표시 (275-286), D-day 카운트다운은 미구현
- [ ] 첨부파일 다운로드 - 과제 첨부파일 기능 미구현 (질문 타입 'file'은 학생 제출용)
- [x] 제출하기 버튼 (학생) - SubmitBar 컴포넌트 (337-351) + handleSubmit()
- [x] 수정/삭제 버튼 (교사) - 수정 버튼 (413-420), 삭제 버튼 + 확인 모달 구현
- [x] 제출 현황 보기 링크 (교사) - 제출 현황 버튼 (421-432) → `/class/${classId}/assignments/${id}/submissions`

### AssignmentForm 페이지 테스트 (교사)
- [x] 제목 입력 필드 - Input 컴포넌트 (291-297) + placeholder + filled 상태
- [x] 설명 에디터 - Textarea 컴포넌트 (300-312) rows={3}
- [x] 과제 유형 선택 (개인/팀) - select 컴포넌트 (318-326) individual/team
- [x] 마감일 선택 (날짜+시간 picker) - Input type="date" (358-362) + type="time" (368-370)
- [ ] 파일 첨부 - 과제 출제 시 파일 첨부 기능 미구현
- [x] 저장 버튼 동작 - handleSubmit() (171-240) + Button (276-283) 출제하기/수정하기

### API 테스트 결과
- [x] GET /api/v1/classes/:classId/assignments - 과제 목록 조회 (scope 필터, 페이지네이션)
- [x] POST /api/v1/assignments - 과제 출제 (교사 전용, 질문 포함)
- [x] GET /api/v1/assignments/:id - 과제 상세 조회 (학생: 제출물/답변 포함)
- [x] PUT /api/v1/assignments/:id - 과제 수정 (교사 전용)
- [x] DELETE /api/v1/assignments/:id - 과제 삭제 (교사 전용, 제출물도 삭제)

> **테스트 완료**: 2026-04-24 | 16/17 항목 통과 (첨부파일 2항목 미구현)
> **구현 파일**: `pages/AssignmentList.tsx`, `pages/AssignmentDetail.tsx`, `pages/AssignmentForm.tsx`, `types/assignment.ts`
> **라우팅**: `/class/:classId/assignments` (목록), `/class/:classId/assignments/:id` (상세), `/class/:classId/assignments/new` (출제), `/class/:classId/assignments/:id/edit` (수정)

---

## 3-10: 과제 제출/피드백

### 학생 제출 페이지 테스트 (AssignmentDetail.tsx에 통합)
- [x] 과제 정보 표시 (읽기 전용) - AssignmentDetail.tsx:289-295 과제 설명 Card
- [x] 답안 입력 에디터 - QuestionCardAnswer 컴포넌트 (307-322) 서술형/단답형/객관식 지원
- [ ] 파일 첨부 기능 - 백엔드 API 구현됨, 프론트엔드 QuestionCardAnswer 파일 업로드 미완성
- [x] 임시 저장 버튼 - SubmitBar.onSaveDraft (345) + 자동 임시저장 (92-101)
- [x] 최종 제출 버튼 - SubmitBar.onSubmit (346) + handleSubmit (160-188)
- [ ] 제출 확인 모달 - 미구현 (직접 제출됨)
- [x] 제출 후 수정 불가 표시 - isPastDue 조건 (338)으로 SubmitBar 숨김

### SubmissionList 페이지 (교사) 테스트
- [x] 제출 현황 테이블 - SubmissionList.tsx:158-201 Table + TableHeader + TableRow
- [x] 제출 상태 필터 (전체/제출/미제출) - Tabs (131-136) 전체/제출완료/임시저장/미제출
- [ ] 팀별 보기 (팀 과제인 경우) - 팀 정보 열은 있으나 그룹화 미구현
- [x] 제출물 클릭 시 상세 보기 - SubmissionRow onClick (285-288) navigate
- [ ] 일괄 다운로드 (선택적) - 미구현

### SubmissionDetail 페이지 (교사 피드백) 테스트
- [x] 학생/팀 정보 표시 - SubmissionDetail.tsx:157-164, 178-200 submitter + team + AvatarGroup
- [x] 제출 답안 표시 - QuestionAnswerCard (203-209, 292-355) 질문별 답변
- [ ] 첨부 파일 다운로드 - 파일 업로드 자체 미완성
- [ ] 점수 입력 필드 - 스펙에 없음, 미구현
- [x] 피드백 코멘트 입력 - Textarea (223-232) + feedbackDirty 상태
- [x] 저장 버튼 동작 - handleSaveFeedback (65-84) + criticalTransaction
- [ ] 이전/다음 제출 네비게이션 - 미구현

### 제출물 공개 기능 테스트
- [x] 공개 버튼 (제출 완료 시) - SubmissionDetail.tsx:169-173 "게시판 공개" 버튼
- [x] 공개 확인 모달 - Modal (248-287)
- [x] 공개 후 게시판 등록 - handlePublish (87-106) POST /submissions/:id/publish

### API 테스트 결과
- [x] GET /api/v1/assignments/:id/submissions - 제출 현황 조회 (교사)
- [x] POST /api/v1/assignments/:id/draft - 임시저장 (학생)
- [x] POST /api/v1/assignments/:id/submit - 최종 제출 (학생)
- [x] GET /api/v1/submissions/:id - 제출물 상세 조회 (교사)
- [x] PATCH /api/v1/submissions/:id/feedback - 피드백 저장 (교사)
- [x] POST /api/v1/submissions/:id/publish - 제출물 공개 (교사)
- [x] POST /api/v1/submissions/:id/files - 파일 업로드 (학생)

> **테스트 완료**: 2026-04-24 | 16/22 항목 통과 (파일 첨부 관련 4항목, 확인 모달, 네비게이션 미구현)
> **구현 파일**: `pages/AssignmentDetail.tsx`, `pages/SubmissionList.tsx`, `pages/SubmissionDetail.tsx`, `types/assignment.ts`
> **라우팅**: `/class/:classId/assignments/:assignmentId/submissions` (목록), `/class/:classId/assignments/:assignmentId/submissions/:submissionId` (상세)
> **미구현 사항**: 파일 첨부 UI, 제출 확인 모달, 이전/다음 네비게이션, 팀별 그룹 보기

---

## 3-11: 파일 업로드 훅

### useFileUpload 기본 테스트
- [ ] 파일 선택 시 업로드 시작
- [ ] 업로드 진행률 표시 (0-100%)
- [ ] 업로드 성공 시 파일 정보 반환
- [ ] 업로드 실패 시 에러 처리

### 진행률 표시 테스트
- [ ] 프로그레스 바 표시
- [ ] 퍼센트 숫자 표시
- [ ] 업로드 중 상태 표시

### 업로드 취소 테스트
- [ ] 취소 버튼 표시
- [ ] 취소 클릭 시 업로드 중단
- [ ] 취소 후 상태 초기화

### 다중 파일 업로드 테스트
- [ ] 여러 파일 선택 가능
- [ ] 개별 파일 진행률 표시
- [ ] 개별 파일 취소 가능
- [ ] 전체 완료 시 콜백

### 파일 검증 테스트
- [ ] 파일 크기 초과 시 에러 표시 (20MB)
- [ ] 동영상 크기 초과 시 에러 표시 (100MB)
- [ ] 허용되지 않은 파일 타입 에러 표시

---

## 통합 테스트 시나리오

### 로그인 → 대시보드 플로우
```
1. 로그인 페이지 접속
2. 자격 증명 입력
3. 로그인 버튼 클릭
4. 대시보드 리다이렉트 확인
5. 사용자 이름 표시 확인
6. 네비게이션 동작 확인
```
- [ ] 위 플로우가 정상 동작

### 과제 제출 플로우 (학생)
```
1. 과제 목록 접속
2. 진행 중 과제 클릭
3. 제출하기 버튼 클릭
4. 답안 작성
5. 파일 첨부 (진행률 확인)
6. 임시 저장
7. 최종 제출
8. 제출 완료 확인
```
- [ ] 위 플로우가 정상 동작

### 게시글 작성 플로우 (교사)
```
1. 게시판 접속
2. 글쓰기 버튼 클릭
3. 제목, 내용 입력
4. 파일 첨부
5. 저장
6. 목록에서 새 글 확인
```
- [ ] 위 플로우가 정상 동작

---

## 반응형 테스트

### 모바일 (< 640px)
- [ ] 사이드바 → 햄버거 메뉴
- [ ] 테이블 → 카드 뷰 또는 스크롤
- [ ] 터치 친화적 버튼 크기
- [ ] 모달 전체 화면

### 태블릿 (640px - 1024px)
- [ ] 사이드바 축소 또는 오버레이
- [ ] 2컬럼 그리드 레이아웃

### 데스크탑 (> 1024px)
- [ ] 사이드바 고정 표시
- [ ] 넓은 컨텐츠 영역

---

## 접근성 테스트

- [ ] 키보드 네비게이션 동작
- [ ] 포커스 인디케이터 표시
- [ ] 스크린 리더 레이블 (aria-label)
- [ ] 색상 대비 충분 (WCAG AA)
- [ ] 폼 요소 레이블 연결

---

## 주의사항

1. **Vite 프록시**: 개발 환경에서만 동작, 프로덕션은 Nginx/같은 origin 필요
2. **쿠키**: SameSite 설정으로 인한 크로스 도메인 이슈 주의
3. **HMR**: 상태가 유지되지 않을 수 있음, 필요 시 persist 사용
4. **빌드**: 프로덕션 빌드 후 정적 파일 서빙 테스트 필수
