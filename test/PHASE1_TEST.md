# Phase 1: 인증 시스템 - 테스트 체크리스트

> JWT 기반 인증 + 역할/반 검증 미들웨어 테스트

---

## 1-1: JWT 인증 미들웨어

### Access Token 검증 테스트
- [x] 유효한 Access Token으로 인증 성공
- [x] httpOnly 쿠키에서 토큰 읽기 확인
- [x] `req.user`에 사용자 정보 설정 확인
- [x] `req.user.id`, `req.user.role`, `req.user.classId` 포함

### 토큰 만료 테스트
- [x] 만료된 Access Token으로 401 응답
- [x] 에러 코드 `TOKEN_EXPIRED` 반환
- [x] 에러 메시지 "토큰이 만료되었습니다" 반환 *(실제: "세션이 만료되었습니다")*

### 유효하지 않은 토큰 테스트
- [x] 변조된 토큰으로 401 응답
- [x] 형식이 잘못된 토큰으로 401 응답
- [x] 토큰 없이 요청 시 401 응답
- [x] 에러 코드 `UNAUTHORIZED` 반환

### 토큰 페이로드 테스트
- [x] 토큰에 `userId` 포함
- [x] 토큰에 `role` 포함
- [x] 토큰에 `classId` 포함 (학생인 경우)
- [x] 토큰에 만료 시간(`exp`) 포함

### 추가 보안 테스트
- [x] none 알고리즘 공격 방지 (algorithms: ['HS256'] 설정)

> **테스트 완료일**: 2026-04-19
> **테스트 방법**: `node test/phase1-1-test.js` (16개 테스트 모두 통과)
> **비고**:
> - server/index.js에서 .env 파일 경로를 루트 디렉토리로 수정
> - 테스트용 인증 라우트 `/api/v1/test-auth` 추가
> - optionalAuth 미들웨어도 구현됨 (토큰 없어도 통과, req.user = null)

---

## 1-2: 역할/반 검증 미들웨어

### requireRole 테스트
- [x] `requireRole('teacher')` - 교사 접근 허용
- [x] `requireRole('teacher')` - 학생 접근 거부 (403)
- [x] `requireRole('student')` - 학생 접근 허용
- [x] `requireRole('student')` - 교사 접근 거부 (403)
- [x] `requireRole('teacher', 'student')` - 둘 다 허용
- [x] 권한 부족 시 에러 코드 `FORBIDDEN` 반환

### requireClassAccess 테스트 *(실제 함수명: verifyClassAccess)*
- [x] 교사 - 모든 반 접근 허용
- [x] 학생 - 자신의 반 접근 허용
- [x] 학생 - 다른 반 접근 거부 (403)
- [x] URL 파라미터 `classId` 검증
- [x] 존재하지 않는 반 접근 시 403 반환 *(학생 기준, DB 재확인 방식)*

### requireTeamAccess 테스트 *(실제 함수명: verifyTeamAccess)*
- [x] 교사 - 모든 팀 접근 허용
- [x] 학생 - 자신의 팀 접근 허용
- [x] 학생 - 다른 팀 접근 거부 (403)
- [x] 팀에 속하지 않은 학생 접근 거부 (403)
- [x] 존재하지 않는 팀 접근 시 403 반환 *(학생 기준, DB 재확인 방식)*

### 미들웨어 조합 테스트
```javascript
// 예: 반 게시판 접근
router.get('/classes/:classId/posts',
  authenticate,
  verifyClassAccess,
  getPosts
)
```
- [x] 인증 → 반 접근 순서로 검증
- [x] 각 단계에서 적절한 에러 반환

> **테스트 완료일**: 2026-04-19
> **테스트 방법**: `node test/phase1-2-test.js` (20개 테스트 모두 통과)
> **비고**:
> - 미들웨어 함수명이 스펙과 다름: `requireClassAccess` → `verifyClassAccess`, `requireTeamAccess` → `verifyTeamAccess`
> - DB 재확인 방식 사용: JWT 클레임만 믿지 않고 DB에서 실제 소속 재확인 (클레임 위조 방지)
> - 존재하지 않는 반/팀 접근 시 학생은 403 반환 (자신의 소속과 불일치로 처리됨)

---

## 1-3: Rate Limiting

### 로그인 시도 제한 테스트 *(loginLimiter - username 기반)*
- [x] 15분 내 5회 로그인 시도 후 차단 (6번째부터 429)
- [x] 차단 시 429 응답 반환
- [x] 에러 메시지에 재시도 가능 시간 포함 ("15분 후 다시 시도")
- [x] 에러 코드 `TOO_MANY_REQUESTS` 반환
- [x] username 기반 제한 - 다른 username은 별도 카운트

### 일반 API 제한 테스트 *(apiLimiter - IP당 100회/분)*
- [x] 첫 요청 성공 (200)
- [x] RateLimit 헤더로 remaining 확인 가능
- [x] 요청마다 remaining 값 감소 확인
- [x] 사용자별(또는 IP별) 개별 카운트

### Rate Limit 헤더 테스트 *(standardHeaders: true)*
- [x] `RateLimit-Limit` 헤더 반환
- [x] `RateLimit-Remaining` 헤더 반환
- [x] `RateLimit-Reset` 헤더 반환

### 예외 경로 테스트
- [x] 정적 파일 요청 (`/uploads`) Rate Limit 미적용
- [x] 헬스체크 경로 `/api/v1/health` globalLimiter 적용됨 (API 경로이므로)

### 인증된 사용자 Rate Limit 테스트 *(authenticatedLimiter - userID 기반)*
- [x] 인증된 사용자 API Rate Limit 동작 확인
- [x] 사용자 ID 기반 별도 카운트 확인

> **테스트 완료일**: 2026-04-19
> **테스트 방법**: `node test/phase1-3-test.js` (15개 테스트 모두 통과)
> **비고**:
> - `standardHeaders: true` 사용으로 `X-RateLimit-*` 대신 `RateLimit-*` 헤더 반환
> - NAT 환경 대응: loginLimiter는 username 기반, authenticatedLimiter는 userID 기반
> - globalLimiter: IP당 1000회/분 (NAT 환경에서 30명 공유 시 33회/분/학생)

---

## 통합 테스트

### 인증 플로우 전체 테스트
```
1. 로그인 실패 (잘못된 비밀번호) → 401
2. 로그인 성공 → Access Token + Refresh Token 쿠키 설정
3. 인증 필요 API 접근 → 성공
4. 3시간 경과 (토큰 만료) → 401 TOKEN_EXPIRED
5. Refresh Token으로 갱신 → 새 Access Token
6. 로그아웃 → 쿠키 삭제
7. 인증 필요 API 접근 → 401
```

- [ ] 위 플로우가 정상 동작

### 권한별 접근 테스트

#### 교사 계정
- [ ] 모든 반의 데이터 조회 가능
- [ ] 학생 관리 API 접근 가능
- [ ] 과제 출제 API 접근 가능

#### 학생 계정
- [ ] 자신의 반 데이터만 조회 가능
- [ ] 학생 관리 API 접근 불가 (403)
- [ ] 과제 출제 API 접근 불가 (403)
- [ ] 자신의 과제 제출 가능

### 보안 테스트

#### 토큰 탈취 방지
- [ ] httpOnly 쿠키로 JavaScript 접근 불가
- [ ] Secure 플래그 설정 (HTTPS only)
- [ ] SameSite 설정 확인

#### 브루트포스 방지
- [ ] 로그인 5회 실패 후 15분 차단
- [ ] 차단 중 올바른 비밀번호도 거부

---

## curl 테스트 예시

### 로그인 테스트
```bash
# 로그인 성공
curl -X POST https://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"teacher1","password":"test1234"}' \
  -c cookies.txt -k

# 쿠키 확인
cat cookies.txt
```

### 인증 API 테스트
```bash
# 내 정보 조회 (쿠키 포함)
curl https://localhost:3000/api/v1/auth/me \
  -b cookies.txt -k
```

### Rate Limit 테스트
```bash
# 로그인 연속 실패 (6회)
for i in {1..6}; do
  curl -X POST https://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"loginId":"teacher1","password":"wrong"}' -k
  echo ""
done
# 6번째부터 429 응답
```

---

## 주의사항

1. **토큰 만료 테스트**: 실제 3시간 대기 대신 환경변수로 짧은 만료 시간 설정
2. **Rate Limit 테스트**: 테스트 환경에서는 제한을 낮게 설정하여 빠른 검증
3. **쿠키 설정**: HTTPS에서만 Secure 쿠키 동작, 개발 시 HTTP 허용 필요
