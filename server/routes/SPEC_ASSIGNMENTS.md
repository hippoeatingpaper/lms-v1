# 과제 API 스펙 (Assignments)

> 과제 출제, 제출, 피드백의 백엔드 구현 스펙

## DB Schema

### assignments — 과제 (교사가 출제)
```sql
CREATE TABLE assignments (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  scope        TEXT NOT NULL,  -- 'individual' | 'team'
  class_id     INTEGER REFERENCES classes(id),  -- NULL이면 전체 반
  due_at       DATETIME,
  author_id    INTEGER REFERENCES users(id),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### assignment_questions — 과제 하위 질문
```sql
CREATE TABLE assignment_questions (
  id             INTEGER PRIMARY KEY,
  assignment_id  INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
  order_num      INTEGER NOT NULL,           -- 질문 순서 (1, 2, 3...)
  question_type  TEXT NOT NULL,              -- 'essay' | 'short' | 'multiple_choice' | 'file'
  body           TEXT NOT NULL,              -- 질문 내용
  options        TEXT,                       -- 객관식: JSON 배열 ["①가","②나","③다"]
  allow_multiple BOOLEAN DEFAULT 0,          -- 객관식 복수 선택 허용
  required       BOOLEAN DEFAULT 1,          -- 필수 응답 여부
  UNIQUE(assignment_id, order_num)
);
```

### submissions — 과제 제출물 (제출 단위)
```sql
CREATE TABLE submissions (
  id               INTEGER PRIMARY KEY,
  assignment_id    INTEGER REFERENCES assignments(id),
  submitter_id     INTEGER REFERENCES users(id),   -- 개인: 본인 / 팀: 제출자
  team_id          INTEGER REFERENCES teams(id),   -- 팀 과제만
  status           TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'submitted'
  version          INTEGER DEFAULT 1,              -- Optimistic Locking
  last_modified_by INTEGER REFERENCES users(id),
  feedback         TEXT,                           -- 교사 피드백
  is_published     BOOLEAN DEFAULT 0,
  published_post_id INTEGER REFERENCES posts(id),
  submitted_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### submission_answers — 질문별 학생 응답
```sql
CREATE TABLE submission_answers (
  id             INTEGER PRIMARY KEY,
  submission_id  INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
  question_id    INTEGER REFERENCES assignment_questions(id),
  answer_text    TEXT,     -- 서술형/단답형/객관식 선택값
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, question_id)  -- 중복 방지
);
```

### files — 파일 업로드 질문 연결
```sql
-- 파일 업로드 질문의 응답은 files 테이블 사용
-- submission_id + question_id로 연결
SELECT * FROM files
WHERE submission_id = ? AND question_id = ?;
```

## API Endpoints

### 과제 출제 (교사)

```
POST /api/v1/assignments
Authorization: teacher only

Body:
{
  "title": "1차 보고서",
  "description": "주제: 환경 문제",
  "scope": "team",           // 'individual' | 'team'
  "class_id": 1,             // null이면 전체 반
  "due_at": "2026-04-20T23:59:00",
  "questions": [
    {
      "order_num": 1,
      "question_type": "essay",
      "body": "환경 문제의 원인을 서술하시오.",
      "required": true
    },
    {
      "order_num": 2,
      "question_type": "multiple_choice",
      "body": "가장 심각한 문제는?",
      "options": ["①대기오염", "②수질오염", "③토양오염"],
      "allow_multiple": false,
      "required": true
    },
    {
      "order_num": 3,
      "question_type": "file",
      "body": "관련 자료를 첨부하시오.",
      "required": false
    }
  ]
}

Response: { "assignment": {...}, "questions": [...] }
```

### 과제 목록 조회

```
GET /api/v1/classes/:classId/assignments
Authorization: teacher or student of class

Query: ?scope=individual|team (optional)

Response: {
  "assignments": [
    {
      "id": 1,
      "title": "1차 보고서",
      "scope": "team",
      "due_at": "2026-04-20T23:59:00",
      "question_count": 3,
      "submission_status": "draft" | "submitted" | null  // 학생용
    }
  ]
}
```

### 과제 상세 조회

```
GET /api/v1/assignments/:id
Authorization: teacher or student of class

Response: {
  "assignment": {...},
  "questions": [...],
  "submission": {...} | null,  // 학생: 본인/팀 제출물
  "answers": [...] | null      // 학생: 본인/팀 응답
}
```

### 임시저장 (학생)

```
POST /api/v1/assignments/:id/draft
Authorization: student

Body: {
  "answers": [
    { "question_id": 1, "answer_text": "임시 답변..." },
    { "question_id": 2, "answer_text": "①대기오염" }
  ]
}

Response: { "submission": { "id": 1, "status": "draft" } }
```

**로직**:
1. 기존 submission 있으면 → UPDATE
2. 없으면 → INSERT (status='draft')
3. `debouncedSave()` 사용 (2초 디바운스)

### 최종 제출 (학생)

```
POST /api/v1/assignments/:id/submit
Authorization: student

Body: {
  "answers": [
    { "question_id": 1, "answer_text": "최종 답변..." },
    { "question_id": 2, "answer_text": "①대기오염" }
  ]
}

Response: { "submission": { "id": 1, "status": "submitted" } }
```

**로직**:
1. 마감 시간 확인 → 지났으면 `{ error: { code: 'DEADLINE_PASSED' } }`
2. 필수 질문 응답 확인
3. `criticalTransaction('submission_submit', ...)` 사용 (즉시 저장)
4. status = 'submitted', submitted_at = NOW()

### 파일 업로드 (질문별)

```
POST /api/v1/assignments/:id/questions/:questionId/file
Authorization: student
Content-Type: multipart/form-data

Body: file (FormData)

Response: { "file": { "id": 1, "filename": "...", "size": 1234 } }
```

**로직**:
1. submission 없으면 자동 생성 (draft)
2. 기존 파일 있으면 삭제 후 교체
3. `saveImmediate('file_upload')` 즉시 저장

### 피드백 작성 (교사)

```
PATCH /api/v1/submissions/:id/feedback
Authorization: teacher

Body: { "feedback": "잘 작성했습니다. 다만..." }

Response: { "ok": true }
```

**로직**: `criticalTransaction('feedback_create', ...)` 즉시 저장

### 제출물 공개 (교사)

```
POST /api/v1/submissions/:id/publish
Authorization: teacher

Response: { "post_id": 123 }
```

**로직**:
1. posts 테이블에 type='published_submission'으로 INSERT
2. submissions.is_published = 1, published_post_id 설정

## 권한 검증

### 과제 접근 권한
```js
// 학생: 본인 반의 과제만 조회 가능
if (user.role === 'student' && assignment.class_id !== user.class_id) {
  return res.status(403).json({ error: { code: 'FORBIDDEN' } })
}
```

### 팀 과제 제출 권한
```js
// 팀 과제: 팀 배정 필수
if (assignment.scope === 'team' && !user.team_id) {
  return res.status(403).json({
    error: { code: 'TEAM_REQUIRED', message: '팀 배정이 필요합니다.' }
  })
}

// 같은 팀원 누구나 제출 가능
const existingSubmission = db.get(
  'SELECT * FROM submissions WHERE assignment_id = ? AND team_id = ?',
  [assignmentId, user.team_id]
)
```

### 개인 과제 제출 권한
```js
// 개인 과제: 본인 submission만 수정 가능
if (assignment.scope === 'individual') {
  const submission = db.get(
    'SELECT * FROM submissions WHERE assignment_id = ? AND submitter_id = ?',
    [assignmentId, user.id]
  )
}
```

## 질문 타입별 처리

| question_type | answer_text 저장 형식 | 검증 |
|---------------|----------------------|------|
| `essay` | 그대로 저장 | 길이 제한 (10000자) |
| `short` | 그대로 저장 | 길이 제한 (500자) |
| `multiple_choice` | 단일: `"①가"`, 복수: `["①가","②나"]` (JSON) | options에 포함된 값인지 |
| `file` | files 테이블 참조 | MIME 타입, 크기 검증 |

## 재제출 로직

```js
// 기존 제출물이 있어도 마감 전이면 수정 가능
if (submission.status === 'submitted' && new Date() < new Date(assignment.due_at)) {
  // 수정 허용 → version 증가
  db.run('UPDATE submissions SET version = version + 1, last_modified_by = ? WHERE id = ?',
    [user.id, submission.id])
}
```

## 제출 현황 조회 (교사)

```
GET /api/v1/assignments/:id/submissions
Authorization: teacher

Response: {
  "submissions": [
    {
      "id": 1,
      "submitter": { "id": 5, "name": "김민준" },
      "team": { "id": 2, "name": "2모둠" } | null,
      "status": "submitted",
      "submitted_at": "2026-04-15T14:30:00",
      "has_feedback": true
    }
  ],
  "stats": {
    "total": 30,
    "submitted": 23,
    "draft": 4,
    "not_started": 3
  }
}
```
