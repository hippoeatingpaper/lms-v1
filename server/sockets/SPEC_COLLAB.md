# 공동 편집 백엔드 스펙 (Collaborative Editing)

> Yjs + y-protocols 기반 실시간 공동 문서 편집 서버 구현

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────┐
│                 HTTP Server (:3000)                     │
├─────────────────────────────────────────────────────────┤
│  /api/v1/documents/*  → Express REST API (문서 CRUD)    │
│  /yjs/:docId          → WebSocket (y-protocols 동기화)  │
└─────────────────────────────────────────────────────────┘
```

**중요**: 백엔드에서는 `y-websocket` 패키지를 사용하지 않습니다.
- `y-websocket`의 `setupWSConnection`은 LevelDB persistence가 내장되어 SQLite와 충돌
- `y-protocols/sync`, `y-protocols/awareness`를 직접 사용하여 커스텀 핸들러 구현

## 필요 패키지

```bash
npm install yjs y-protocols lib0 ws
```

- `yjs`: CRDT 문서 엔진
- `y-protocols`: 동기화/awareness 프로토콜
- `lib0`: 인코딩/디코딩 유틸리티
- `ws`: WebSocket 서버

## DB Schema

### documents — 공동 편집 문서
```sql
CREATE TABLE documents (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  team_id     INTEGER REFERENCES teams(id),  -- 팀 전용 문서
  class_id    INTEGER REFERENCES classes(id), -- 반 (권한 확인용)
  ydoc_state  BLOB,      -- Yjs 바이너리 상태 (Y.encodeStateAsUpdate)
  version     INTEGER DEFAULT 1,
  created_by  INTEGER REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## WebSocket 서버 설정

### 1. 서버 진입점 (index.js)

```js
// server/index.js
import { createServer } from 'http'  // 또는 https
import { WebSocketServer } from 'ws'
import { setupYjsConnection } from './sockets/yjs.js'

const httpServer = createServer(app)

// Yjs WebSocket 서버 (noServer 모드)
const yjsWss = new WebSocketServer({ noServer: true })

// HTTP Upgrade 처리
httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname

  // /yjs/:docId 경로만 처리
  if (pathname.startsWith('/yjs/')) {
    yjsWss.handleUpgrade(req, socket, head, (ws) => {
      yjsWss.emit('connection', ws, req)
    })
  } else {
    // Socket.IO는 자체적으로 /socket.io 경로 처리
    // 다른 경로는 무시
  }
})

// Yjs 연결 처리
yjsWss.on('connection', (ws, req) => {
  setupYjsConnection(ws, req)
})
```

### 2. Yjs 연결 핸들러 (sockets/yjs.js)

```js
// server/sockets/yjs.js
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import jwt from 'jsonwebtoken'
import { db, debouncedSave } from '../db.js'

// 메시지 타입
const MSG_SYNC = 0
const MSG_AWARENESS = 1

// 문서 캐시 (메모리)
const docs = new Map()        // docId → Y.Doc
const docConns = new Map()    // docId → Set<WebSocket>
const docLastAccess = new Map() // docId → timestamp

// 설정
const MAX_CACHED_DOCS = 50
const DOC_IDLE_TIMEOUT = 5 * 60 * 1000  // 5분
const MEMORY_WARNING_MB = 500
const MEMORY_CRITICAL_MB = 800

/**
 * JWT 인증 (쿠키 또는 쿼리 파라미터)
 */
function authenticateWs(req) {
  const url = new URL(req.url, `http://${req.headers.host}`)

  // 쿼리 파라미터에서 토큰 추출 (WebSocket은 쿠키 전송이 제한적)
  const token = url.searchParams.get('token')

  if (!token) {
    throw new Error('인증 토큰이 필요합니다.')
  }

  try {
    // ⚠️ algorithms 옵션 필수 (none 알고리즘 공격 방지)
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    })
  } catch (err) {
    throw new Error('유효하지 않은 토큰입니다.')
  }
}

/**
 * 문서 접근 권한 확인
 */
function checkDocumentAccess(user, docId) {
  const doc = db.get('SELECT * FROM documents WHERE id = ?', [docId])

  if (!doc) {
    throw new Error('문서를 찾을 수 없습니다.')
  }

  // 교사는 모든 문서 접근 가능
  if (user.role === 'teacher') {
    return doc
  }

  // 학생은 자신의 팀 문서만 접근
  if (doc.team_id && doc.team_id !== user.team_id) {
    throw new Error('이 문서에 접근할 권한이 없습니다.')
  }

  // 반 확인
  if (doc.class_id && doc.class_id !== user.class_id) {
    throw new Error('이 문서에 접근할 권한이 없습니다.')
  }

  return doc
}

/**
 * Y.Doc 가져오기 또는 생성
 */
function getYDoc(docId) {
  if (docs.has(docId)) {
    docLastAccess.set(docId, Date.now())
    return docs.get(docId)
  }

  // DB에서 로드
  const row = db.get('SELECT ydoc_state FROM documents WHERE id = ?', [docId])
  const ydoc = new Y.Doc()

  if (row?.ydoc_state) {
    Y.applyUpdate(ydoc, new Uint8Array(row.ydoc_state))
  }

  // 변경 시 DB 저장 (디바운스)
  ydoc.on('update', (update, origin) => {
    if (origin !== 'db') {
      persistDocument(docId, ydoc)
    }
  })

  docs.set(docId, ydoc)
  docConns.set(docId, new Set())
  docLastAccess.set(docId, Date.now())

  // 캐시 관리
  cleanupOldDocs()

  return ydoc
}

/**
 * 문서 저장 (디바운스 2초)
 */
const persistTimers = new Map()

function persistDocument(docId, ydoc) {
  if (persistTimers.has(docId)) {
    clearTimeout(persistTimers.get(docId))
  }

  persistTimers.set(docId, setTimeout(() => {
    const state = Y.encodeStateAsUpdate(ydoc)
    db.run(
      'UPDATE documents SET ydoc_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [Buffer.from(state), docId]
    )
    debouncedSave()
    persistTimers.delete(docId)
    console.log(`[yjs] 문서 저장: ${docId}`)
  }, 2000))
}

/**
 * 오래된 문서 정리 (LRU)
 */
function cleanupOldDocs() {
  const now = Date.now()

  // 유휴 문서 정리
  for (const [docId, lastAccess] of docLastAccess) {
    const conns = docConns.get(docId)
    if ((!conns || conns.size === 0) && now - lastAccess > DOC_IDLE_TIMEOUT) {
      removeDoc(docId)
    }
  }

  // 최대 캐시 초과 시 LRU 정리
  if (docs.size > MAX_CACHED_DOCS) {
    const sorted = [...docLastAccess.entries()]
      .sort((a, b) => a[1] - b[1])

    const toRemove = docs.size - MAX_CACHED_DOCS
    for (let i = 0; i < toRemove; i++) {
      const docId = sorted[i][0]
      const conns = docConns.get(docId)
      if (!conns || conns.size === 0) {
        removeDoc(docId)
      }
    }
  }
}

function removeDoc(docId) {
  const ydoc = docs.get(docId)
  if (ydoc) {
    // 저장 타이머가 있으면 즉시 저장
    if (persistTimers.has(docId)) {
      clearTimeout(persistTimers.get(docId))
      const state = Y.encodeStateAsUpdate(ydoc)
      db.run(
        'UPDATE documents SET ydoc_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [Buffer.from(state), docId]
      )
    }
    ydoc.destroy()
  }
  docs.delete(docId)
  docConns.delete(docId)
  docLastAccess.delete(docId)
  persistTimers.delete(docId)
  console.log(`[yjs] 문서 정리: ${docId}`)
}

/**
 * WebSocket 연결 설정
 */
export function setupYjsConnection(ws, req) {
  let user, docId, ydoc

  try {
    // 인증
    user = authenticateWs(req)

    // 문서 ID 추출
    const url = new URL(req.url, `http://${req.headers.host}`)
    docId = url.pathname.replace('/yjs/', '')

    // 권한 확인
    checkDocumentAccess(user, docId)

    // Y.Doc 가져오기
    ydoc = getYDoc(docId)

    // 연결 등록
    docConns.get(docId).add(ws)

    console.log(`[yjs] 연결: 문서 ${docId}, 사용자 ${user.id}`)

  } catch (err) {
    console.error('[yjs] 연결 거부:', err.message)
    ws.close(4001, err.message)
    return
  }

  // Awareness 설정
  const awareness = new awarenessProtocol.Awareness(ydoc)
  awareness.setLocalState({
    user: {
      id: user.id,
      name: user.name,
      color: getAwarenessColor(user.id),
    }
  })

  // 초기 동기화 전송
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MSG_SYNC)
  syncProtocol.writeSyncStep1(encoder, ydoc)
  ws.send(encoding.toUint8Array(encoder))

  // Awareness 초기 상태 전송
  const awarenessEncoder = encoding.createEncoder()
  encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS)
  encoding.writeVarUint8Array(
    awarenessEncoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, [user.id])
  )
  ws.send(encoding.toUint8Array(awarenessEncoder))

  // 메시지 수신 처리
  ws.on('message', (data) => {
    try {
      const message = new Uint8Array(data)
      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)

      switch (messageType) {
        case MSG_SYNC:
          handleSyncMessage(ws, decoder, ydoc, docId)
          break
        case MSG_AWARENESS:
          handleAwarenessMessage(decoder, awareness, docId)
          break
      }
    } catch (err) {
      console.error('[yjs] 메시지 처리 오류:', err)
    }
  })

  // 연결 종료 처리
  ws.on('close', () => {
    docConns.get(docId)?.delete(ws)
    awarenessProtocol.removeAwarenessStates(awareness, [user.id], null)
    console.log(`[yjs] 연결 종료: 문서 ${docId}, 사용자 ${user.id}`)
  })

  ws.on('error', (err) => {
    console.error(`[yjs] WebSocket 오류:`, err)
  })
}

/**
 * 동기화 메시지 처리
 */
function handleSyncMessage(ws, decoder, ydoc, docId) {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MSG_SYNC)
  const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, ydoc, null)

  if (encoding.length(encoder) > 1) {
    ws.send(encoding.toUint8Array(encoder))
  }

  // 변경사항을 다른 클라이언트에 브로드캐스트
  if (syncMessageType === syncProtocol.messageYjsUpdate) {
    const update = decoding.readVarUint8Array(decoder)
    broadcastUpdate(docId, update, ws)
  }
}

/**
 * Awareness 메시지 처리
 */
function handleAwarenessMessage(decoder, awareness, docId) {
  const update = decoding.readVarUint8Array(decoder)
  awarenessProtocol.applyAwarenessUpdate(awareness, update, null)
  broadcastAwareness(docId, update)
}

/**
 * 업데이트 브로드캐스트
 */
function broadcastUpdate(docId, update, excludeWs) {
  const conns = docConns.get(docId)
  if (!conns) return

  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MSG_SYNC)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)

  for (const conn of conns) {
    if (conn !== excludeWs && conn.readyState === 1) {
      conn.send(message)
    }
  }
}

/**
 * Awareness 브로드캐스트
 */
function broadcastAwareness(docId, update) {
  const conns = docConns.get(docId)
  if (!conns) return

  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MSG_AWARENESS)
  encoding.writeVarUint8Array(encoder, update)
  const message = encoding.toUint8Array(encoder)

  for (const conn of conns) {
    if (conn.readyState === 1) {
      conn.send(message)
    }
  }
}

/**
 * 사용자별 커서 색상
 */
const AWARENESS_COLORS = [
  '#3C3489', '#085041', '#993C1D', '#633806', '#0C447C'
]

function getAwarenessColor(userId) {
  return AWARENESS_COLORS[userId % AWARENESS_COLORS.length]
}

/**
 * 메모리 모니터링 (1분마다 실행)
 */
setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024

  if (used > MEMORY_CRITICAL_MB) {
    console.warn(`[yjs] 메모리 위험: ${used.toFixed(1)}MB - 유휴 문서 전체 정리`)
    for (const [docId] of docs) {
      const conns = docConns.get(docId)
      if (!conns || conns.size === 0) {
        removeDoc(docId)
      }
    }
  } else if (used > MEMORY_WARNING_MB) {
    console.warn(`[yjs] 메모리 경고: ${used.toFixed(1)}MB - LRU 정리`)
    cleanupOldDocs()
  }
}, 60 * 1000)
```

## REST API (문서 CRUD)

### routes/documents.js

```js
// server/routes/documents.js
import { Router } from 'express'
import { db, criticalTransaction } from '../db.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()

// 문서 목록 (팀별)
router.get('/teams/:teamId/documents', authenticate, (req, res) => {
  const { teamId } = req.params
  const user = req.user

  // 권한 확인
  if (user.role === 'student' && user.team_id !== parseInt(teamId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: '팀 문서에 접근할 권한이 없습니다.' }
    })
  }

  const documents = db.all(
    `SELECT id, title, created_at, updated_at
     FROM documents WHERE team_id = ? ORDER BY updated_at DESC`,
    [teamId]
  )

  res.json({ documents })
})

// 문서 생성
router.post('/teams/:teamId/documents', authenticate, (req, res) => {
  const { teamId } = req.params
  const { title } = req.body
  const user = req.user

  // 권한 확인 (팀원 또는 교사)
  if (user.role === 'student' && user.team_id !== parseInt(teamId)) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN' }
    })
  }

  // 팀의 반 ID 조회
  const team = db.get('SELECT class_id FROM teams WHERE id = ?', [teamId])
  if (!team) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '팀을 찾을 수 없습니다.' }
    })
  }

  const { lastInsertRowid } = db.run(
    `INSERT INTO documents (title, team_id, class_id, created_by)
     VALUES (?, ?, ?, ?)`,
    [title || '새 문서', teamId, team.class_id, user.id]
  )

  res.json({ document: { id: lastInsertRowid, title } })
})

// 문서 제목 수정
router.patch('/documents/:id', authenticate, (req, res) => {
  const { id } = req.params
  const { title } = req.body
  const user = req.user

  const doc = db.get('SELECT * FROM documents WHERE id = ?', [id])
  if (!doc) {
    return res.status(404).json({ error: { code: 'NOT_FOUND' } })
  }

  // 권한 확인
  if (user.role === 'student' && doc.team_id !== user.team_id) {
    return res.status(403).json({ error: { code: 'FORBIDDEN' } })
  }

  db.run('UPDATE documents SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, id])

  res.json({ ok: true })
})

// 문서 삭제
router.delete('/documents/:id', authenticate, requireRole('teacher'), (req, res) => {
  const { id } = req.params

  criticalTransaction('document_delete', () => {
    db.run('DELETE FROM documents WHERE id = ?', [id])
  })

  res.json({ ok: true })
})

export default router
```

## 메모리 관리 설정

| 설정 | 값 | 설명 |
|------|-----|------|
| `MAX_CACHED_DOCS` | 50 | 최대 캐시 문서 수 |
| `DOC_IDLE_TIMEOUT` | 5분 | 유휴 문서 정리 기준 |
| `MEMORY_WARNING_MB` | 500MB | 경고 임계치 (LRU 정리) |
| `MEMORY_CRITICAL_MB` | 800MB | 위험 임계치 (전체 유휴 문서 정리) |
| 저장 디바운스 | 2초 | 문서 변경 후 DB 저장 지연 |

## 클라이언트 연결 URL

```
wss://192.168.x.x:3000/yjs/{docId}?token={accessToken}
```

- `docId`: 문서 ID (정수)
- `token`: JWT Access Token (쿼리 파라미터로 전달)

## 서버 종료 시 처리

```js
// server/index.js
process.on('SIGTERM', () => {
  console.log('[server] 종료 시작...')

  // 모든 문서 즉시 저장
  for (const [docId, ydoc] of docs) {
    const state = Y.encodeStateAsUpdate(ydoc)
    db.run(
      'UPDATE documents SET ydoc_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [Buffer.from(state), docId]
    )
  }

  db.close()
  process.exit(0)
})
```
