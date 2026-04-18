// server/migrations/schema.js
// 초기 테이블 생성 — DB가 비어있을 때 실행

import { db, saveDatabase } from '../db.js'

/**
 * 초기 스키마 생성 — DB가 비어있을 때 실행
 */
export function createInitialSchema() {
  // 테이블 존재 여부 확인
  const tables = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
  if (tables) {
    console.log('[SCHEMA] 기존 스키마 존재, 생략')
    return
  }

  console.log('[SCHEMA] 초기 스키마 생성 중...')

  // ============================================================
  // 핵심 테이블
  // ============================================================

  db.run(`
    CREATE TABLE classes (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE teams (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      class_id   INTEGER REFERENCES classes(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL,
      class_id      INTEGER REFERENCES classes(id),
      team_id       INTEGER REFERENCES teams(id),
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // ============================================================
  // 인증 관련
  // ============================================================

  db.run(`
    CREATE TABLE refresh_tokens (
      id         INTEGER PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // ============================================================
  // 게시판
  // ============================================================

  db.run(`
    CREATE TABLE posts (
      id         INTEGER PRIMARY KEY,
      title      TEXT NOT NULL,
      content    TEXT,
      type       TEXT NOT NULL,
      author_id  INTEGER REFERENCES users(id),
      class_id   INTEGER REFERENCES classes(id),
      team_id    INTEGER REFERENCES teams(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE comments (
      id         INTEGER PRIMARY KEY,
      body       TEXT NOT NULL,
      post_id    INTEGER REFERENCES posts(id),
      author_id  INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE likes (
      id      INTEGER PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id),
      user_id INTEGER REFERENCES users(id),
      UNIQUE(post_id, user_id)
    )
  `)

  // ============================================================
  // 과제
  // ============================================================

  db.run(`
    CREATE TABLE assignments (
      id           INTEGER PRIMARY KEY,
      title        TEXT NOT NULL,
      description  TEXT,
      scope        TEXT NOT NULL,
      class_id     INTEGER REFERENCES classes(id),
      due_at       DATETIME,
      author_id    INTEGER REFERENCES users(id),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE assignment_questions (
      id             INTEGER PRIMARY KEY,
      assignment_id  INTEGER REFERENCES assignments(id),
      order_num      INTEGER NOT NULL,
      question_type  TEXT NOT NULL,
      body           TEXT NOT NULL,
      options        TEXT,
      required       BOOLEAN DEFAULT 1
    )
  `)

  db.run(`
    CREATE TABLE submissions (
      id               INTEGER PRIMARY KEY,
      assignment_id    INTEGER REFERENCES assignments(id),
      submitter_id     INTEGER REFERENCES users(id),
      team_id          INTEGER REFERENCES teams(id),
      status           TEXT NOT NULL DEFAULT 'draft',
      version          INTEGER DEFAULT 1,
      last_modified_by INTEGER REFERENCES users(id),
      feedback         TEXT,
      is_published     BOOLEAN DEFAULT 0,
      published_post_id INTEGER REFERENCES posts(id),
      submitted_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE submission_answers (
      id             INTEGER PRIMARY KEY,
      submission_id  INTEGER REFERENCES submissions(id),
      question_id    INTEGER REFERENCES assignment_questions(id),
      answer_text    TEXT,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(submission_id, question_id)
    )
  `)

  // ============================================================
  // 파일
  // ============================================================

  db.run(`
    CREATE TABLE files (
      id             INTEGER PRIMARY KEY,
      filename       TEXT NOT NULL,
      original_name  TEXT NOT NULL,
      filepath       TEXT NOT NULL,
      mimetype       TEXT NOT NULL,
      size           INTEGER NOT NULL,
      class_id       INTEGER REFERENCES classes(id),
      post_id        INTEGER REFERENCES posts(id),
      submission_id  INTEGER REFERENCES submissions(id),
      question_id    INTEGER REFERENCES assignment_questions(id),
      uploader_id    INTEGER REFERENCES users(id),
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // ============================================================
  // 공동 문서
  // ============================================================

  db.run(`
    CREATE TABLE documents (
      id          INTEGER PRIMARY KEY,
      title       TEXT NOT NULL,
      team_id     INTEGER REFERENCES teams(id),
      class_id    INTEGER REFERENCES classes(id),
      ydoc_state  BLOB,
      version     INTEGER DEFAULT 1,
      created_by  INTEGER REFERENCES users(id),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // ============================================================
  // 알림
  // ============================================================

  db.run(`
    CREATE TABLE notifications (
      id         INTEGER PRIMARY KEY,
      type       TEXT NOT NULL,
      message    TEXT NOT NULL,
      data       TEXT,
      class_id   INTEGER REFERENCES classes(id),
      target_id  INTEGER REFERENCES users(id),
      sender_id  INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE notification_reads (
      id              INTEGER PRIMARY KEY,
      notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      read_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(notification_id, user_id)
    )
  `)

  // ============================================================
  // 인덱스 생성
  // ============================================================

  db.run('CREATE INDEX idx_users_class ON users(class_id)')
  db.run('CREATE INDEX idx_users_team ON users(team_id)')
  db.run('CREATE INDEX idx_users_username ON users(username)')
  db.run('CREATE INDEX idx_posts_class ON posts(class_id)')
  db.run('CREATE INDEX idx_posts_type ON posts(type)')
  db.run('CREATE INDEX idx_assignments_class ON assignments(class_id)')
  db.run('CREATE INDEX idx_submissions_assignment ON submissions(assignment_id)')
  db.run('CREATE INDEX idx_submissions_submitter ON submissions(submitter_id)')
  db.run('CREATE INDEX idx_files_submission ON files(submission_id, question_id)')
  db.run('CREATE INDEX idx_files_class ON files(class_id)')
  db.run('CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)')
  db.run('CREATE INDEX idx_notifications_target ON notifications(target_id)')
  db.run('CREATE INDEX idx_comments_post ON comments(post_id)')

  saveDatabase()
  console.log('[SCHEMA] 초기 스키마 생성 완료')
}
