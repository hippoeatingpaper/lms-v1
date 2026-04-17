# 실시간 알림 백엔드 스펙 (Socket.IO)

> Socket.IO 기반 실시간 댓글, 좋아요, 공지, 팀 배정 알림 구현

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────┐
│                 HTTP Server (:3000)                     │
├─────────────────────────────────────────────────────────┤
│  /socket.io/*  → Socket.IO (댓글, 좋아요, 공지, 팀배정)  │
└─────────────────────────────────────────────────────────┘

Room 구조:
├── class:1, class:2, ...     # 반별 room (공지, 게시물)
├── team:1, team:2, ...       # 팀별 room (팀 알림)
└── user:1, user:2, ...       # 개인 room (개인 알림, 피드백)
```

## DB Schema

### notifications — 알림
```sql
CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY,
  type       TEXT NOT NULL,     -- 'notice' | 'feedback' | 'comment' | 'team_assigned' | 'assignment'
  message    TEXT NOT NULL,
  data       TEXT,              -- JSON (관련 데이터: post_id, assignment_id 등)
  class_id   INTEGER REFERENCES classes(id),  -- NULL이면 전체 반
  target_id  INTEGER REFERENCES users(id),    -- NULL이면 반/전체 대상
  sender_id  INTEGER REFERENCES users(id),    -- 발신자 (교사 또는 시스템)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**대상 결정 규칙**:
| class_id | target_id | 대상 |
|----------|-----------|------|
| 반ID | NULL | 해당 반 전체 학생 |
| NULL | NULL | 모든 반의 모든 학생 (전체 공지) |
| 반ID | 학생ID | 특정 반의 특정 학생 (개인 알림) |
| NULL | 학생ID | 특정 학생 (반과 무관한 개인 알림) |

### notification_reads — 읽음 상태
```sql
CREATE TABLE notification_reads (
  id              INTEGER PRIMARY KEY,
  notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  read_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(notification_id, user_id)
);
```

## Socket.IO 서버 설정

### server/sockets/index.js

```js
// server/sockets/index.js
import { Server as SocketIO } from 'socket.io'
import jwt from 'jsonwebtoken'
import cookie from 'cookie'
import { db } from '../db.js'

let io

/**
 * Socket.IO 초기화
 */
export function initSocketIO(httpServer, allowedOrigins) {
  io = new SocketIO(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    path: '/socket.io',
  })

  // 인증 미들웨어
  io.use(authenticateSocket)

  // 연결 처리
  io.on('connection', handleConnection)

  return io
}

/**
 * Socket.IO 인스턴스 반환 (다른 모듈에서 사용)
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.IO가 초기화되지 않았습니다.')
  }
  return io
}

/**
 * JWT 인증 미들웨어
 */
function authenticateSocket(socket, next) {
  try {
    // 쿠키에서 토큰 추출
    const cookies = cookie.parse(socket.handshake.headers.cookie || '')
    const token = cookies.access_token

    if (!token) {
      return next(new Error('인증 토큰이 필요합니다.'))
    }

    // ⚠️ algorithms 옵션 필수 (none 알고리즘 공격 방지)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    })
    socket.user = decoded  // { id, username, name, role, class_id, team_id }
    next()

  } catch (err) {
    next(new Error('유효하지 않은 토큰입니다.'))
  }
}

/**
 * 연결 처리
 */
function handleConnection(socket) {
  const user = socket.user
  console.log(`[socket] 연결: ${user.name} (${user.id})`)

  // Room 자동 참가
  joinRooms(socket, user)

  // 이벤트 리스너 등록
  registerEventHandlers(socket, user)

  // 연결 해제
  socket.on('disconnect', () => {
    console.log(`[socket] 연결 해제: ${user.name} (${user.id})`)
  })
}

/**
 * Room 참가
 */
function joinRooms(socket, user) {
  // 개인 room (항상)
  socket.join(`user:${user.id}`)

  // 반 room (학생만)
  if (user.class_id) {
    socket.join(`class:${user.class_id}`)
  }

  // 팀 room (팀 배정된 학생만)
  if (user.team_id) {
    socket.join(`team:${user.team_id}`)
  }

  // 교사는 모든 반 room 참가 (선택적)
  if (user.role === 'teacher') {
    const classes = db.all('SELECT id FROM classes')
    classes.forEach(c => socket.join(`class:${c.id}`))
  }

  console.log(`[socket] Room 참가: user:${user.id}, class:${user.class_id}, team:${user.team_id}`)
}

/**
 * 이벤트 핸들러 등록
 */
function registerEventHandlers(socket, user) {
  // 댓글 작성
  socket.on('comment:create', (data) => handleCommentCreate(socket, user, data))

  // 좋아요 토글
  socket.on('like:toggle', (data) => handleLikeToggle(socket, user, data))

  // 알림 읽음 처리
  socket.on('notification:read', (data) => handleNotificationRead(socket, user, data))

  // 전체 읽음 처리
  socket.on('notification:readAll', () => handleNotificationReadAll(socket, user))

  // 팀 room 업데이트 (팀 배정 후)
  socket.on('team:join', (data) => {
    if (data.teamId) {
      socket.join(`team:${data.teamId}`)
    }
  })
}
```

## 이벤트 핸들러

### 댓글 작성

```js
/**
 * 댓글 작성 처리
 */
async function handleCommentCreate(socket, user, data) {
  const { postId, body } = data

  // 권한 확인
  const post = db.get('SELECT * FROM posts WHERE id = ?', [postId])
  if (!post) return

  if (user.role === 'student' && post.class_id !== user.class_id) {
    return socket.emit('error', { message: '권한이 없습니다.' })
  }

  // 댓글 저장
  const { lastInsertRowid } = db.run(
    'INSERT INTO comments (body, post_id, author_id) VALUES (?, ?, ?)',
    [body, postId, user.id]
  )

  const comment = {
    id: lastInsertRowid,
    body,
    author: { id: user.id, name: user.name },
    created_at: new Date().toISOString(),
  }

  // 해당 반에 브로드캐스트
  const targetRoom = post.class_id ? `class:${post.class_id}` : null
  if (targetRoom) {
    io.to(targetRoom).emit('comment:created', {
      postId,
      comment,
    })
  }
}
```

### 좋아요 토글

```js
/**
 * 좋아요 토글 처리
 */
async function handleLikeToggle(socket, user, data) {
  const { postId } = data

  // 기존 좋아요 확인
  const existing = db.get(
    'SELECT id FROM likes WHERE post_id = ? AND user_id = ?',
    [postId, user.id]
  )

  let liked
  if (existing) {
    // 좋아요 취소
    db.run('DELETE FROM likes WHERE id = ?', [existing.id])
    liked = false
  } else {
    // 좋아요 추가
    db.run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, user.id])
    liked = true
  }

  // 새 좋아요 수 조회
  const { count } = db.get(
    'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
    [postId]
  )

  // 해당 반에 브로드캐스트
  const post = db.get('SELECT class_id FROM posts WHERE id = ?', [postId])
  if (post?.class_id) {
    io.to(`class:${post.class_id}`).emit('like:updated', {
      postId,
      likeCount: count,
      // 누가 눌렀는지는 개인정보이므로 전송하지 않음
    })
  }

  // 본인에게만 liked 상태 전송
  socket.emit('like:toggled', { postId, liked })
}
```

### 알림 읽음 처리

```js
/**
 * 알림 읽음 처리
 */
function handleNotificationRead(socket, user, data) {
  const { notificationId } = data

  db.run(
    `INSERT OR IGNORE INTO notification_reads (notification_id, user_id)
     VALUES (?, ?)`,
    [notificationId, user.id]
  )

  socket.emit('notification:marked', { notificationId })
}

/**
 * 전체 알림 읽음 처리
 */
function handleNotificationReadAll(socket, user) {
  // 사용자에게 해당하는 모든 알림을 읽음 처리
  const notifications = db.all(
    `SELECT id FROM notifications
     WHERE (target_id = ? OR target_id IS NULL)
       AND (class_id = ? OR class_id IS NULL)`,
    [user.id, user.class_id]
  )

  for (const n of notifications) {
    db.run(
      `INSERT OR IGNORE INTO notification_reads (notification_id, user_id)
       VALUES (?, ?)`,
      [n.id, user.id]
    )
  }

  socket.emit('notification:allMarked')
}
```

## 서버에서 알림 전송 (API에서 호출)

### 유틸리티 함수

```js
// server/sockets/notify.js
import { getIO } from './index.js'
import { db, debouncedSave } from '../db.js'

/**
 * 공지 전송 (교사 → 반 전체 또는 전체 학생)
 */
export function sendNotice({ message, classId, senderId }) {
  const io = getIO()

  // DB 저장
  const { lastInsertRowid } = db.run(
    `INSERT INTO notifications (type, message, class_id, sender_id)
     VALUES ('notice', ?, ?, ?)`,
    [message, classId, senderId]
  )

  const notification = {
    id: lastInsertRowid,
    type: 'notice',
    message,
    created_at: new Date().toISOString(),
  }

  // 브로드캐스트
  if (classId) {
    io.to(`class:${classId}`).emit('notification', notification)
  } else {
    // 전체 반에 전송
    const classes = db.all('SELECT id FROM classes')
    classes.forEach(c => {
      io.to(`class:${c.id}`).emit('notification', notification)
    })
  }

  return notification
}

/**
 * 개인 알림 전송 (피드백, 팀 배정 등)
 */
export function sendPersonalNotification({ type, message, data, targetId, senderId }) {
  const io = getIO()

  // DB 저장
  const { lastInsertRowid } = db.run(
    `INSERT INTO notifications (type, message, data, target_id, sender_id)
     VALUES (?, ?, ?, ?, ?)`,
    [type, message, JSON.stringify(data), targetId, senderId]
  )

  const notification = {
    id: lastInsertRowid,
    type,
    message,
    data,
    created_at: new Date().toISOString(),
  }

  // 개인 room에 전송
  io.to(`user:${targetId}`).emit('notification', notification)

  return notification
}

/**
 * 팀 배정 알림
 */
export function sendTeamAssigned({ userId, teamId, teamName, senderId }) {
  const io = getIO()

  // 개인 알림 저장
  const { lastInsertRowid } = db.run(
    `INSERT INTO notifications (type, message, data, target_id, sender_id)
     VALUES ('team_assigned', ?, ?, ?, ?)`,
    [`${teamName} 팀에 배정되었습니다.`, JSON.stringify({ teamId, teamName }), userId, senderId]
  )

  // 특별 이벤트 전송 (UI에서 즉시 반영)
  io.to(`user:${userId}`).emit('team:assigned', {
    teamId,
    teamName,
    notificationId: lastInsertRowid,
  })

  return { teamId, teamName }
}

/**
 * 피드백 알림
 */
export function sendFeedbackNotification({ submissionId, studentId, assignmentTitle, senderId }) {
  return sendPersonalNotification({
    type: 'feedback',
    message: `"${assignmentTitle}" 과제에 피드백이 등록되었습니다.`,
    data: { submissionId },
    targetId: studentId,
    senderId,
  })
}

/**
 * 새 과제 알림
 */
export function sendNewAssignmentNotification({ assignmentId, title, classId, senderId }) {
  const io = getIO()

  const { lastInsertRowid } = db.run(
    `INSERT INTO notifications (type, message, data, class_id, sender_id)
     VALUES ('assignment', ?, ?, ?, ?)`,
    [`새 과제: ${title}`, JSON.stringify({ assignmentId }), classId, senderId]
  )

  const notification = {
    id: lastInsertRowid,
    type: 'assignment',
    message: `새 과제: ${title}`,
    data: { assignmentId },
    created_at: new Date().toISOString(),
  }

  if (classId) {
    io.to(`class:${classId}`).emit('notification', notification)
  } else {
    const classes = db.all('SELECT id FROM classes')
    classes.forEach(c => {
      io.to(`class:${c.id}`).emit('notification', notification)
    })
  }

  return notification
}
```

### API에서 사용 예시

```js
// server/routes/notifications.js
import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth.js'
import { sendNotice } from '../sockets/notify.js'
import { db } from '../db.js'

const router = Router()

// 공지 전송 (교사)
router.post('/', authenticate, requireRole('teacher'), (req, res) => {
  const { message, classId } = req.body
  const notification = sendNotice({
    message,
    classId: classId || null,  // null이면 전체
    senderId: req.user.id,
  })
  res.json({ notification })
})

// 알림 목록 조회
router.get('/', authenticate, (req, res) => {
  const user = req.user

  const notifications = db.all(`
    SELECT n.*,
           CASE WHEN nr.id IS NOT NULL THEN 1 ELSE 0 END as is_read
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id AND nr.user_id = ?
    WHERE (n.target_id = ? OR n.target_id IS NULL)
      AND (n.class_id = ? OR n.class_id IS NULL)
    ORDER BY n.created_at DESC
    LIMIT 50
  `, [user.id, user.id, user.class_id])

  // 읽지 않은 알림 수
  const { unread_count } = db.get(`
    SELECT COUNT(*) as unread_count
    FROM notifications n
    WHERE (n.target_id = ? OR n.target_id IS NULL)
      AND (n.class_id = ? OR n.class_id IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM notification_reads nr
        WHERE nr.notification_id = n.id AND nr.user_id = ?
      )
  `, [user.id, user.class_id, user.id])

  res.json({ notifications, unread_count })
})

export default router
```

```js
// server/routes/teams.js — 팀 배정 시 알림
import { sendTeamAssigned } from '../sockets/notify.js'

router.post('/:teamId/members', authenticate, requireRole('teacher'), (req, res) => {
  const { teamId } = req.params
  const { userIds } = req.body

  const team = db.get('SELECT * FROM teams WHERE id = ?', [teamId])

  for (const userId of userIds) {
    db.run('UPDATE users SET team_id = ? WHERE id = ?', [teamId, userId])

    // 실시간 알림 전송
    sendTeamAssigned({
      userId,
      teamId,
      teamName: team.name,
      senderId: req.user.id,
    })
  }

  res.json({ ok: true })
})
```

## 이벤트 요약

### 클라이언트 → 서버

| 이벤트 | 데이터 | 설명 |
|--------|--------|------|
| `comment:create` | `{ postId, body }` | 댓글 작성 |
| `like:toggle` | `{ postId }` | 좋아요 토글 |
| `notification:read` | `{ notificationId }` | 알림 읽음 |
| `notification:readAll` | - | 전체 읽음 |
| `team:join` | `{ teamId }` | 팀 room 참가 |

### 서버 → 클라이언트

| 이벤트 | 데이터 | 대상 |
|--------|--------|------|
| `comment:created` | `{ postId, comment }` | 반 room |
| `like:updated` | `{ postId, likeCount }` | 반 room |
| `notification` | `{ id, type, message, data }` | 반/개인 room |
| `team:assigned` | `{ teamId, teamName }` | 개인 room |
| `notification:marked` | `{ notificationId }` | 본인 |
| `notification:allMarked` | - | 본인 |
| `error` | `{ message }` | 본인 |

## Room 명명 규칙

```js
`class:${classId}`   // 반 전체 (공지, 게시물, 댓글, 좋아요)
`team:${teamId}`     // 팀 (팀 관련 알림)
`user:${userId}`     // 개인 (피드백, 팀 배정, 개인 알림)
```
