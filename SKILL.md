# SKILL.md - Claude Code 개발 규칙

> Harness Engineering 기법을 활용한 효율적인 AI 협업 개발 가이드

## 1. Context 절약 규칙

### 1.1 Task 에이전트 활용

```
# 탐색/검색 작업은 반드시 Task(Explore) 사용
- 파일 구조 파악 → Task(Explore)
- 코드 패턴 검색 → Task(Explore)
- 의존성 추적 → Task(Explore)

# 직접 도구 사용 케이스 (Task 불필요)
- 특정 파일 경로를 아는 경우 → Read
- 정확한 클래스/함수명 검색 → Glob
- 2-3개 파일 내 검색 → Grep
```

### 1.2 SPEC 파일 참조 패턴

```
# 기능 구현 전 반드시 해당 SPEC 읽기
1. 백엔드 작업 → server/SPEC_*.md 먼저 Read
2. 프론트엔드 작업 → client/src/*/SPEC_*.md 먼저 Read
3. 공통 작업 → CLAUDE.md 참조

# SPEC 파일에 없는 내용만 탐색
- SPEC에 정의된 내용 재질문 금지
- 불필요한 코드 탐색 최소화
```

### 1.3 응답 간결화

```
# 불필요한 설명 제거
- 이미 합의된 결정사항 재설명 금지
- 코드 변경 시 변경 부분만 설명
- "~하겠습니다" 대신 바로 실행

# 코드 블록 최소화
- 전체 파일 출력 금지 (변경부분만)
- 긴 에러 로그는 핵심만 추출
```

## 2. 코드 작성 규칙

### 2.1 공통 규칙

```javascript
// 파일명: kebab-case
user-service.js, auth-middleware.js

// 변수/함수: camelCase
const userId = 1;
function getUserById() {}

// 클래스/컴포넌트: PascalCase
class UserService {}
function UserProfile() {}

// 상수: SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE = 20 * 1024 * 1024;
```

### 2.2 백엔드 (Node.js + Express)

```javascript
// 라우터 구조
router.get('/', authenticate, authorize('teacher'), asyncHandler(async (req, res) => {
  // 1. 입력 검증
  // 2. 비즈니스 로직
  // 3. 응답 반환
}));

// 에러 응답 형식 (고정)
res.status(400).json({ error: { code: 'INVALID_INPUT', message: '...' } });

// DB 쿼리는 db.js 래퍼 사용
const users = db.all('SELECT * FROM users WHERE class_id = ?', [classId]);
```

### 2.3 프론트엔드 (React + TypeScript)

```typescript
// 컴포넌트 구조
interface Props {
  userId: number;
  onSelect?: (id: number) => void;
}

export function UserCard({ userId, onSelect }: Props) {
  // hooks 선언
  // 핸들러 정의
  // return JSX
}

// 상태관리: Zustand
import { useAuthStore } from '@/stores/auth';
const { user, login, logout } = useAuthStore();

// API 호출: lib/api.ts 사용
import { api } from '@/lib/api';
const data = await api.get('/users');
```

### 2.4 타입 정의

```typescript
// types/index.ts에 공통 타입 정의
interface User {
  id: number;
  name: string;
  role: 'teacher' | 'student';
  classId: number | null;
}

// API 응답 타입
interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
}
```

## 3. 파일 구조 규칙

### 3.1 새 파일 생성 시

```
# 백엔드
routes/       → [resource].js (예: users.js, posts.js)
middleware/   → [name].js (예: auth.js, upload.js)
sockets/      → [feature].js (예: collab.js, realtime.js)

# 프론트엔드
pages/        → [PageName].tsx
components/   → [ComponentName].tsx
hooks/        → use[Name].ts
stores/       → [name].ts
lib/          → [utility].ts
```

### 3.2 Import 순서

```typescript
// 1. Node/React 내장
import { useState, useEffect } from 'react';

// 2. 외부 라이브러리
import { useNavigate } from 'react-router-dom';

// 3. 내부 절대경로 (@/)
import { Button } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';

// 4. 상대경로
import { formatDate } from './utils';
```

## 4. Git 커밋 규칙

```bash
# 커밋 메시지 형식
<type>: <description>

# type 종류
feat:     새 기능
fix:      버그 수정
refactor: 리팩토링
docs:     문서 수정
style:    포맷팅
test:     테스트
chore:    빌드/설정

# 예시
feat: 학생 과제 제출 API 구현
fix: JWT 토큰 만료 시 리프레시 로직 수정
```

## 5. Claude Code 요청 패턴

### 5.1 효율적인 요청 방식

```
# Good - 구체적이고 범위가 명확
"server/routes/auth.js에 로그아웃 엔드포인트 추가해줘"
"SPEC_AUTH.md 참고해서 JWT 미들웨어 구현해줘"

# Bad - 모호하고 범위가 넓음
"인증 기능 만들어줘"
"전체적으로 코드 리뷰해줘"
```

### 5.2 단계별 구현 요청

```
# 큰 기능은 단계별로 나누어 요청
1단계: "auth 라우터 뼈대만 만들어줘"
2단계: "로그인 엔드포인트 구현해줘"
3단계: "토큰 검증 미들웨어 추가해줘"
```

### 5.3 Plan 모드 활용

```
# 복잡한 기능은 Plan 모드로 시작
- 다중 파일 수정이 필요한 경우
- 아키텍처 결정이 필요한 경우
- 여러 접근 방식이 가능한 경우

# 단순 작업은 바로 실행
- 버그 수정
- 단일 파일 수정
- 명확한 요구사항
```

## 6. 디버깅 규칙

```javascript
// console.log 대신 구조화된 로깅
console.log('[AUTH] Login attempt:', { userId, timestamp: Date.now() });

// 에러 로깅 필수 정보
console.error('[ERROR]', {
  module: 'auth',
  action: 'login',
  error: err.message,
  stack: err.stack
});
```

## 7. 테스트 규칙

```javascript
// 테스트 파일명: *.test.js / *.spec.ts
// 위치: 동일 폴더 또는 __tests__/

describe('AuthService', () => {
  it('should return token on valid credentials', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## 8. 체크리스트

### 기능 구현 전
- [ ] 해당 SPEC 파일 읽음
- [ ] 관련 기존 코드 파악
- [ ] API 엔드포인트/응답 형식 확인

### 코드 작성 후
- [ ] 에러 처리 완료
- [ ] 타입 정의 완료 (TS)
- [ ] 불필요한 console.log 제거
- [ ] 린트 에러 없음

### 커밋 전
- [ ] 관련 파일만 스테이징
- [ ] 커밋 메시지 규칙 준수
- [ ] .env, 인증서 등 민감파일 제외
