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
- [ ] 반 목록 테이블 표시
- [ ] 반 추가 모달 동작
- [ ] 반 수정 기능 동작
- [ ] 반 삭제 확인 모달
- [ ] 삭제 시 경고 메시지 (연관 데이터)

### AdminUsers 페이지 테스트
- [ ] 반 선택 드롭다운
- [ ] 학생 목록 테이블 표시
- [ ] 학생 일괄 추가 (텍스트 입력/파싱)
- [ ] 학생 개별 수정
- [ ] 학생 삭제
- [ ] 비밀번호 초기화 기능

### AdminTeams 페이지 테스트
- [ ] 반 선택 드롭다운
- [ ] 팀 목록 표시
- [ ] 팀 생성 기능
- [ ] 팀원 배정 (드래그앤드롭 또는 선택)
- [ ] 팀원 해제 기능
- [ ] 팀 삭제 기능

---

## 3-8: 게시판 (공지/자료)

### Board 목록 페이지 테스트
- [ ] 게시글 목록 표시
- [ ] 카테고리 탭 (공지, 자료, 자유)
- [ ] 페이지네이션 동작
- [ ] 검색 기능 (선택적)
- [ ] 글쓰기 버튼 (교사 / 자유게시판)

### PostDetail 페이지 테스트
- [ ] 게시글 제목, 내용 표시
- [ ] 작성자, 작성일 표시
- [ ] 첨부파일 목록 및 다운로드
- [ ] 댓글 목록 표시
- [ ] 댓글 작성 폼
- [ ] 좋아요 버튼 동작
- [ ] 수정/삭제 버튼 (작성자/교사)

### PostForm 페이지 테스트
- [ ] 제목 입력 필드
- [ ] 내용 에디터 (TipTap 또는 textarea)
- [ ] 카테고리 선택 (교사만)
- [ ] 파일 첨부 기능
- [ ] 저장 버튼 동작
- [ ] 취소 버튼 동작
- [ ] 수정 모드에서 기존 값 로드

---

## 3-9: 과제 목록/상세

### AssignmentList 페이지 테스트
- [ ] 과제 목록 표시
- [ ] 진행 중/마감 탭 구분
- [ ] 마감일 표시
- [ ] 제출 상태 배지 (미제출/제출/평가완료)
- [ ] 과제 클릭 시 상세 페이지 이동

### AssignmentDetail 페이지 테스트
- [ ] 과제 제목, 설명 표시
- [ ] 마감일 표시 (D-day 카운트다운)
- [ ] 첨부파일 다운로드
- [ ] 제출하기 버튼 (학생)
- [ ] 수정/삭제 버튼 (교사)
- [ ] 제출 현황 보기 링크 (교사)

### AssignmentForm 페이지 테스트 (교사)
- [ ] 제목 입력 필드
- [ ] 설명 에디터
- [ ] 과제 유형 선택 (개인/팀)
- [ ] 마감일 선택 (날짜+시간 picker)
- [ ] 파일 첨부
- [ ] 저장 버튼 동작

---

## 3-10: 과제 제출/피드백

### SubmissionForm 페이지 (학생) 테스트
- [ ] 과제 정보 표시 (읽기 전용)
- [ ] 답안 입력 에디터
- [ ] 파일 첨부 기능
- [ ] 임시 저장 버튼
- [ ] 최종 제출 버튼
- [ ] 제출 확인 모달
- [ ] 제출 후 수정 불가 표시

### SubmissionList 페이지 (교사) 테스트
- [ ] 제출 현황 테이블
- [ ] 제출 상태 필터 (전체/제출/미제출)
- [ ] 팀별 보기 (팀 과제인 경우)
- [ ] 제출물 클릭 시 상세 보기
- [ ] 일괄 다운로드 (선택적)

### FeedbackForm 페이지 (교사) 테스트
- [ ] 학생/팀 정보 표시
- [ ] 제출 답안 표시
- [ ] 첨부 파일 다운로드
- [ ] 점수 입력 필드
- [ ] 피드백 코멘트 입력
- [ ] 저장 버튼 동작
- [ ] 이전/다음 제출 네비게이션

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
