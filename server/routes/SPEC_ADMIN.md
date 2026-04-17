# 반/팀/학생 관리 백엔드 스펙 (Admin)

> 반, 팀, 학생 계정 CRUD 및 팀 배정의 백엔드 구현 스펙
> **권한**: 모든 API는 교사(teacher) 전용

## DB Schema (참조)

### classes — 반
```sql
CREATE TABLE classes (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,           -- 예: '1반', '2반', '화요일 3교시'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### teams — 팀(모둠)
```sql
CREATE TABLE teams (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,           -- 예: '1모둠', 'A팀'
  class_id   INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_teams_class ON teams(class_id);
```

### users — 사용자 계정
```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL,        -- 'teacher' | 'student'
  class_id      INTEGER REFERENCES classes(id),  -- 학생만
  team_id       INTEGER REFERENCES teams(id),    -- 학생만
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_class ON users(class_id);
CREATE INDEX idx_users_team ON users(team_id);
```

## API Endpoints

---

## 1. 반 관리 (Classes)

### 반 목록 조회 (GET /api/v1/classes)

```
GET /api/v1/classes
Authorization: teacher only

Response 200:
{
  "classes": [
    {
      "id": 1,
      "name": "1반",
      "created_at": "2026-04-01T09:00:00Z",
      "stats": {
        "student_count": 28,
        "team_count": 5,
        "unassigned_count": 3
      }
    },
    ...
  ]
}
```

### 반 생성 (POST /api/v1/classes)

```
POST /api/v1/classes
Authorization: teacher only

Request:
{
  "name": "3반"
}

Response 201:
{
  "class": {
    "id": 3,
    "name": "3반",
    "created_at": "2026-04-14T10:00:00Z"
  }
}

Error 400:
{ "error": { "code": "VALIDATION_ERROR", "message": "반 이름을 입력하세요." } }
{ "error": { "code": "DUPLICATE_NAME", "message": "이미 존재하는 반 이름입니다." } }

Error 400:
{ "error": { "code": "MAX_CLASSES_EXCEEDED", "message": "최대 6개의 반만 생성할 수 있습니다." } }
```

### 반 수정 (PATCH /api/v1/classes/:classId)

```
PATCH /api/v1/classes/:classId
Authorization: teacher only

Request:
{
  "name": "1반 (오전)"
}

Response 200:
{
  "class": {
    "id": 1,
    "name": "1반 (오전)",
    "created_at": "2026-04-01T09:00:00Z"
  }
}

Error 404:
{ "error": { "code": "NOT_FOUND", "message": "반을 찾을 수 없습니다." } }
```

### 반 삭제 (DELETE /api/v1/classes/:classId)

```
DELETE /api/v1/classes/:classId
Authorization: teacher only

Response 200:
{ "ok": true }

Error 400:
{ "error": { "code": "HAS_STUDENTS", "message": "학생이 배정된 반은 삭제할 수 없습니다. 먼저 학생을 다른 반으로 이동하세요." } }

Error 404:
{ "error": { "code": "NOT_FOUND", "message": "반을 찾을 수 없습니다." } }
```

---

## 2. 팀 관리 (Teams)

### 반별 팀 목록 조회 (GET /api/v1/classes/:classId/teams)

```
GET /api/v1/classes/:classId/teams
Authorization: teacher only

Response 200:
{
  "teams": [
    {
      "id": 1,
      "name": "1모둠",
      "class_id": 1,
      "created_at": "2026-04-01T09:00:00Z",
      "members": [
        { "id": 10, "name": "김민준", "username": "student01" },
        { "id": 11, "name": "이서연", "username": "student02" },
        ...
      ]
    },
    ...
  ],
  "unassigned": [
    { "id": 15, "name": "박지호", "username": "student05" },
    ...
  ]
}
```

### 팀 생성 (POST /api/v1/classes/:classId/teams)

```
POST /api/v1/classes/:classId/teams
Authorization: teacher only

Request:
{
  "name": "3모둠"
}

Response 201:
{
  "team": {
    "id": 3,
    "name": "3모둠",
    "class_id": 1,
    "created_at": "2026-04-14T10:00:00Z",
    "members": []
  }
}

Error 400:
{ "error": { "code": "VALIDATION_ERROR", "message": "팀 이름을 입력하세요." } }
{ "error": { "code": "DUPLICATE_NAME", "message": "해당 반에 이미 존재하는 팀 이름입니다." } }
```

### 팀 수정 (PATCH /api/v1/teams/:teamId)

```
PATCH /api/v1/teams/:teamId
Authorization: teacher only

Request:
{
  "name": "A팀"
}

Response 200:
{
  "team": {
    "id": 1,
    "name": "A팀",
    "class_id": 1,
    "created_at": "2026-04-01T09:00:00Z"
  }
}

Error 404:
{ "error": { "code": "NOT_FOUND", "message": "팀을 찾을 수 없습니다." } }
```

### 팀 삭제 (DELETE /api/v1/teams/:teamId)

```
DELETE /api/v1/teams/:teamId
Authorization: teacher only

Response 200:
{ "ok": true }

참고: 팀 삭제 시 소속 학생들의 team_id는 NULL로 변경됨 (미배정 상태)
Socket.IO: 소속 학생들에게 'team:removed' 이벤트 전송
```

### 팀원 배정 (POST /api/v1/teams/:teamId/members)

```
POST /api/v1/teams/:teamId/members
Authorization: teacher only

Request:
{
  "user_ids": [10, 11, 12]
}

Response 200:
{
  "team": {
    "id": 1,
    "name": "1모둠",
    "members": [
      { "id": 10, "name": "김민준" },
      { "id": 11, "name": "이서연" },
      { "id": 12, "name": "박지호" }
    ]
  },
  "assigned": [10, 11, 12]
}

Socket.IO: 배정된 학생들에게 'team:assigned' 이벤트 전송

Error 400:
{ "error": { "code": "INVALID_USER", "message": "해당 반에 소속되지 않은 학생이 포함되어 있습니다." } }
{ "error": { "code": "ALREADY_ASSIGNED", "message": "이미 다른 팀에 배정된 학생이 포함되어 있습니다." } }
```

### 팀원 제거 (DELETE /api/v1/teams/:teamId/members/:userId)

```
DELETE /api/v1/teams/:teamId/members/:userId
Authorization: teacher only

Response 200:
{ "ok": true }

Socket.IO: 해당 학생에게 'team:removed' 이벤트 전송

Error 404:
{ "error": { "code": "NOT_FOUND", "message": "해당 팀에 소속되지 않은 학생입니다." } }
```

---

## 3. 학생 계정 관리 (Users)

### 학생 목록 조회 (GET /api/v1/users)

```
GET /api/v1/users
Authorization: teacher only

Query Parameters:
- class_id: 특정 반 학생만 조회 (선택)
- unassigned: true면 반 미배정 학생만 조회 (선택)

Response 200:
{
  "users": [
    {
      "id": 10,
      "name": "김민준",
      "username": "student01",
      "role": "student",
      "class_id": 1,
      "class_name": "1반",
      "team_id": 1,
      "team_name": "1모둠",
      "created_at": "2026-04-01T09:00:00Z"
    },
    ...
  ]
}
```

### 학생 계정 생성 (POST /api/v1/users)

```
POST /api/v1/users
Authorization: teacher only

Request:
{
  "name": "최유진",
  "username": "student30",
  "password": "초기비밀번호",
  "class_id": 1
}

Response 201:
{
  "user": {
    "id": 30,
    "name": "최유진",
    "username": "student30",
    "role": "student",
    "class_id": 1,
    "team_id": null,
    "created_at": "2026-04-14T10:00:00Z"
  }
}

Error 400:
{ "error": { "code": "VALIDATION_ERROR", "message": "이름, 아이디, 비밀번호를 입력하세요." } }
{ "error": { "code": "DUPLICATE_USERNAME", "message": "이미 사용 중인 아이디입니다." } }
```

### 학생 일괄 생성 (POST /api/v1/users/bulk)

```
POST /api/v1/users/bulk
Authorization: teacher only

Request:
{
  "class_id": 1,
  "users": [
    { "name": "학생1", "username": "s1", "password": "pw1" },
    { "name": "학생2", "username": "s2", "password": "pw2" },
    ...
  ]
}

Response 201:
{
  "created": 25,
  "failed": [
    { "username": "s10", "error": "이미 사용 중인 아이디입니다." }
  ]
}
```

### 학생 정보 수정 (PATCH /api/v1/users/:userId)

```
PATCH /api/v1/users/:userId
Authorization: teacher only

Request:
{
  "name": "김민준 (수정)",
  "class_id": 2,
  "team_id": null
}

Response 200:
{
  "user": {
    "id": 10,
    "name": "김민준 (수정)",
    "username": "student01",
    "class_id": 2,
    "team_id": null
  }
}

참고: class_id 변경 시 team_id는 자동으로 NULL로 변경됨
Socket.IO: 해당 학생에게 'user:updated' 이벤트 전송

Error 404:
{ "error": { "code": "NOT_FOUND", "message": "학생을 찾을 수 없습니다." } }
```

### 학생 비밀번호 초기화 (POST /api/v1/users/:userId/reset-password)

```
POST /api/v1/users/:userId/reset-password
Authorization: teacher only

Request:
{
  "new_password": "새비밀번호123"
}

Response 200:
{ "ok": true, "message": "비밀번호가 초기화되었습니다." }
```

### 학생 계정 삭제 (DELETE /api/v1/users/:userId)

```
DELETE /api/v1/users/:userId
Authorization: teacher only

Response 200:
{ "ok": true }

참고: 학생의 제출물, 댓글, 파일 등 관련 데이터도 CASCADE 삭제됨

Error 404:
{ "error": { "code": "NOT_FOUND", "message": "학생을 찾을 수 없습니다." } }
```

---

## 핵심 로직 구현

### 반 관리 라우터

```js
// server/routes/classes.js
import { Router } from 'express'
import { db, criticalTransaction } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'

const router = Router()
const MAX_CLASSES = 6

// 반 목록 조회
router.get('/', authenticate, requireTeacher, (req, res) => {
  const classes = db.all(`
    SELECT
      c.*,
      (SELECT COUNT(*) FROM users WHERE class_id = c.id AND role = 'student') as student_count,
      (SELECT COUNT(*) FROM teams WHERE class_id = c.id) as team_count,
      (SELECT COUNT(*) FROM users WHERE class_id = c.id AND team_id IS NULL AND role = 'student') as unassigned_count
    FROM classes c
    ORDER BY c.created_at
  `)

  res.json({
    classes: classes.map(c => ({
      ...c,
      stats: {
        student_count: c.student_count,
        team_count: c.team_count,
        unassigned_count: c.unassigned_count,
      }
    }))
  })
})

// 반 생성
router.post('/', authenticate, requireTeacher, (req, res) => {
  const { name } = req.body

  if (!name?.trim()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '반 이름을 입력하세요.' }
    })
  }

  // 최대 반 개수 확인
  const count = db.get('SELECT COUNT(*) as cnt FROM classes')
  if (count.cnt >= MAX_CLASSES) {
    return res.status(400).json({
      error: { code: 'MAX_CLASSES_EXCEEDED', message: '최대 6개의 반만 생성할 수 있습니다.' }
    })
  }

  // 중복 이름 확인
  const existing = db.get('SELECT id FROM classes WHERE name = ?', [name.trim()])
  if (existing) {
    return res.status(400).json({
      error: { code: 'DUPLICATE_NAME', message: '이미 존재하는 반 이름입니다.' }
    })
  }

  const { lastInsertRowid } = db.run(
    'INSERT INTO classes (name) VALUES (?)',
    [name.trim()]
  )

  const newClass = db.get('SELECT * FROM classes WHERE id = ?', [lastInsertRowid])
  res.status(201).json({ class: newClass })
})

// 반 삭제
router.delete('/:classId', authenticate, requireTeacher, (req, res) => {
  const { classId } = req.params

  const classRow = db.get('SELECT * FROM classes WHERE id = ?', [classId])
  if (!classRow) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '반을 찾을 수 없습니다.' }
    })
  }

  // 소속 학생 확인
  const studentCount = db.get(
    'SELECT COUNT(*) as cnt FROM users WHERE class_id = ? AND role = ?',
    [classId, 'student']
  )

  if (studentCount.cnt > 0) {
    return res.status(400).json({
      error: {
        code: 'HAS_STUDENTS',
        message: '학생이 배정된 반은 삭제할 수 없습니다. 먼저 학생을 다른 반으로 이동하세요.'
      }
    })
  }

  db.run('DELETE FROM classes WHERE id = ?', [classId])
  res.json({ ok: true })
})

export default router
```

### 팀 배정 로직 (Socket.IO 연동)

```js
// server/routes/teams.js
import { Router } from 'express'
import { db, criticalTransaction } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'
import { getIO } from '../sockets/index.js'

const router = Router()

// 팀원 배정
router.post('/:teamId/members', authenticate, requireTeacher, (req, res) => {
  const { teamId } = req.params
  const { user_ids } = req.body

  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '배정할 학생을 선택하세요.' }
    })
  }

  const team = db.get('SELECT * FROM teams WHERE id = ?', [teamId])
  if (!team) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '팀을 찾을 수 없습니다.' }
    })
  }

  // 유효성 검증
  for (const userId of user_ids) {
    const user = db.get('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'student'])

    if (!user) {
      return res.status(400).json({
        error: { code: 'INVALID_USER', message: '유효하지 않은 학생입니다.' }
      })
    }

    if (user.class_id !== team.class_id) {
      return res.status(400).json({
        error: { code: 'INVALID_USER', message: '해당 반에 소속되지 않은 학생이 포함되어 있습니다.' }
      })
    }

    if (user.team_id && user.team_id !== parseInt(teamId)) {
      return res.status(400).json({
        error: { code: 'ALREADY_ASSIGNED', message: '이미 다른 팀에 배정된 학생이 포함되어 있습니다.' }
      })
    }
  }

  // 배정 실행 (중요 작업 - 즉시 저장)
  criticalTransaction('team_assign', () => {
    for (const userId of user_ids) {
      db.run('UPDATE users SET team_id = ? WHERE id = ?', [teamId, userId])
    }
  })

  // Socket.IO로 배정된 학생들에게 알림
  const io = getIO()
  for (const userId of user_ids) {
    io.to(`user:${userId}`).emit('team:assigned', {
      teamId: parseInt(teamId),
      teamName: team.name,
    })
  }

  // 업데이트된 팀 정보 반환
  const members = db.all(
    'SELECT id, name, username FROM users WHERE team_id = ?',
    [teamId]
  )

  res.json({
    team: { ...team, members },
    assigned: user_ids,
  })
})

// 팀원 제거
router.delete('/:teamId/members/:userId', authenticate, requireTeacher, (req, res) => {
  const { teamId, userId } = req.params

  const user = db.get(
    'SELECT * FROM users WHERE id = ? AND team_id = ?',
    [userId, teamId]
  )

  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '해당 팀에 소속되지 않은 학생입니다.' }
    })
  }

  criticalTransaction('team_remove', () => {
    db.run('UPDATE users SET team_id = NULL WHERE id = ?', [userId])
  })

  // Socket.IO로 해당 학생에게 알림
  const io = getIO()
  io.to(`user:${userId}`).emit('team:removed', { teamId: parseInt(teamId) })

  res.json({ ok: true })
})

export default router
```

### 학생 계정 관리 라우터

```js
// server/routes/users.js
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db, criticalTransaction } from '../db.js'
import { authenticate, requireTeacher } from '../middleware/auth.js'
import { getIO } from '../sockets/index.js'

const router = Router()

// 학생 목록 조회
router.get('/', authenticate, requireTeacher, (req, res) => {
  const { class_id, unassigned } = req.query

  let sql = `
    SELECT
      u.id, u.name, u.username, u.role, u.class_id, u.team_id, u.created_at,
      c.name as class_name,
      t.name as team_name
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.role = 'student'
  `
  const params = []

  if (class_id) {
    sql += ' AND u.class_id = ?'
    params.push(class_id)
  }

  if (unassigned === 'true') {
    sql += ' AND u.class_id IS NULL'
  }

  sql += ' ORDER BY u.class_id, u.name'

  const users = db.all(sql, params)
  res.json({ users })
})

// 학생 계정 생성
router.post('/', authenticate, requireTeacher, (req, res) => {
  const { name, username, password, class_id } = req.body

  if (!name?.trim() || !username?.trim() || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '이름, 아이디, 비밀번호를 입력하세요.' }
    })
  }

  // 아이디 중복 확인
  const existing = db.get('SELECT id FROM users WHERE username = ?', [username.trim()])
  if (existing) {
    return res.status(400).json({
      error: { code: 'DUPLICATE_USERNAME', message: '이미 사용 중인 아이디입니다.' }
    })
  }

  // 비밀번호 해시
  const passwordHash = bcrypt.hashSync(password, 10)

  const { lastInsertRowid } = criticalTransaction('user_create', () => {
    return db.run(
      'INSERT INTO users (name, username, password_hash, role, class_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), username.trim(), passwordHash, 'student', class_id || null]
    )
  })

  const user = db.get(
    'SELECT id, name, username, role, class_id, team_id, created_at FROM users WHERE id = ?',
    [lastInsertRowid]
  )

  res.status(201).json({ user })
})

// 학생 정보 수정
router.patch('/:userId', authenticate, requireTeacher, (req, res) => {
  const { userId } = req.params
  const { name, class_id, team_id } = req.body

  const user = db.get('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'student'])
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '학생을 찾을 수 없습니다.' }
    })
  }

  const updates = []
  const params = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(name.trim())
  }

  if (class_id !== undefined) {
    updates.push('class_id = ?')
    params.push(class_id)

    // 반이 변경되면 팀도 초기화
    if (class_id !== user.class_id) {
      updates.push('team_id = NULL')
    }
  }

  if (team_id !== undefined && class_id === undefined) {
    updates.push('team_id = ?')
    params.push(team_id)
  }

  if (updates.length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '수정할 항목이 없습니다.' }
    })
  }

  params.push(userId)
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

  // Socket.IO로 학생에게 알림
  const io = getIO()
  const updatedUser = db.get(
    'SELECT id, name, username, role, class_id, team_id FROM users WHERE id = ?',
    [userId]
  )
  io.to(`user:${userId}`).emit('user:updated', { user: updatedUser })

  res.json({ user: updatedUser })
})

// 비밀번호 초기화
router.post('/:userId/reset-password', authenticate, requireTeacher, (req, res) => {
  const { userId } = req.params
  const { new_password } = req.body

  if (!new_password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: '새 비밀번호를 입력하세요.' }
    })
  }

  const user = db.get('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'student'])
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '학생을 찾을 수 없습니다.' }
    })
  }

  const passwordHash = bcrypt.hashSync(new_password, 10)
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId])

  res.json({ ok: true, message: '비밀번호가 초기화되었습니다.' })
})

// 학생 계정 삭제
router.delete('/:userId', authenticate, requireTeacher, (req, res) => {
  const { userId } = req.params

  const user = db.get('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'student'])
  if (!user) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '학생을 찾을 수 없습니다.' }
    })
  }

  db.run('DELETE FROM users WHERE id = ?', [userId])
  res.json({ ok: true })
})

export default router
```

---

## Socket.IO 이벤트

### 팀 배정 이벤트

```js
// 서버 → 클라이언트
io.to(`user:${userId}`).emit('team:assigned', {
  teamId: number,
  teamName: string,
})

// 팀 제거 이벤트
io.to(`user:${userId}`).emit('team:removed', {
  teamId: number,
})

// 사용자 정보 업데이트 이벤트
io.to(`user:${userId}`).emit('user:updated', {
  user: { id, name, class_id, team_id, ... },
})
```

---

## 라우터 등록

```js
// server/index.js
import classRouter from './routes/classes.js'
import teamRouter from './routes/teams.js'
import userRouter from './routes/users.js'

// 모든 관리 API는 교사 전용
app.use('/api/v1/classes', authenticate, classRouter)
app.use('/api/v1/teams', authenticate, teamRouter)
app.use('/api/v1/users', authenticate, userRouter)
```

---

## 보안 체크리스트

- [ ] 모든 API에 `authenticate` + `requireTeacher` 미들웨어 적용
- [ ] 반 삭제 전 소속 학생 유무 확인
- [ ] 팀 배정 시 반 소속 검증
- [ ] 학생 계정 생성 시 `criticalTransaction()` 사용
- [ ] 팀 배정 시 `criticalTransaction()` 사용
- [ ] 비밀번호는 bcryptjs로 해시 저장
- [ ] 반 변경 시 팀 자동 초기화
- [ ] Socket.IO로 실시간 알림 전송
