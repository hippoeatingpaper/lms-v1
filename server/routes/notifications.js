// server/routes/notifications.js
// 알림 API

import { Router } from 'express'
import { db } from '../db.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// ============================================================
// 내 알림 목록 조회
// GET /api/v1/notifications
// ============================================================

router.get('/', authenticate, (req, res) => {
  const user = req.user

  // 내게 온 알림 조회 (최근 30일, 최대 50개)
  const notifications = db.all(`
    SELECT
      n.*,
      u.name as sender_name,
      nr.read_at
    FROM notifications n
    LEFT JOIN users u ON n.sender_id = u.id
    LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
    WHERE n.target_id = ?
      AND n.created_at > datetime('now', '-30 days')
    ORDER BY n.created_at DESC
    LIMIT 50
  `, [user.id, user.id])

  // 읽지 않은 알림 수
  const unreadCount = db.get(`
    SELECT COUNT(*) as count
    FROM notifications n
    LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
    WHERE n.target_id = ?
      AND nr.id IS NULL
      AND n.created_at > datetime('now', '-30 days')
  `, [user.id, user.id]).count

  res.json({
    notifications: notifications.map(n => ({
      id: n.id,
      type: n.type,
      message: n.message,
      data: n.data ? JSON.parse(n.data) : null,
      sender: n.sender_id ? { id: n.sender_id, name: n.sender_name } : null,
      is_read: !!n.read_at,
      created_at: n.created_at
    })),
    unread_count: unreadCount
  })
})

// ============================================================
// 알림 읽음 처리
// POST /api/v1/notifications/:id/read
// ============================================================

router.post('/:id/read', authenticate, (req, res) => {
  const { id } = req.params
  const user = req.user

  // 알림 존재 및 권한 확인
  const notification = db.get(
    'SELECT * FROM notifications WHERE id = ? AND target_id = ?',
    [id, user.id]
  )

  if (!notification) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '알림을 찾을 수 없습니다.' }
    })
  }

  // 이미 읽은 경우 무시
  const alreadyRead = db.get(
    'SELECT 1 FROM notification_reads WHERE notification_id = ? AND user_id = ?',
    [id, user.id]
  )

  if (!alreadyRead) {
    db.run(
      'INSERT INTO notification_reads (notification_id, user_id) VALUES (?, ?)',
      [id, user.id]
    )
  }

  res.json({ ok: true })
})

// ============================================================
// 모든 알림 읽음 처리
// POST /api/v1/notifications/read-all
// ============================================================

router.post('/read-all', authenticate, (req, res) => {
  const user = req.user

  // 읽지 않은 알림 조회
  const unreadNotifications = db.all(`
    SELECT n.id
    FROM notifications n
    LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
    WHERE n.target_id = ?
      AND nr.id IS NULL
  `, [user.id, user.id])

  // 모두 읽음 처리
  for (const n of unreadNotifications) {
    db.run(
      'INSERT INTO notification_reads (notification_id, user_id) VALUES (?, ?)',
      [n.id, user.id]
    )
  }

  res.json({ ok: true, count: unreadNotifications.length })
})

export default router
