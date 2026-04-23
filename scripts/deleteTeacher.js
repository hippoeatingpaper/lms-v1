// scripts/deleteTeacher.js
// 교사 계정 삭제 CLI

import readline from 'readline'
import { initDatabase, db, saveDatabase } from '../server/db.js'

const args = process.argv.slice(2)
const listMode = args.includes('--list')
const forceMode = args.includes('--force')
const usernameArg = args.find(arg => !arg.startsWith('--'))

async function main() {
  await initDatabase()

  // 교사 목록 조회
  const teachers = db.all("SELECT id, name, username, created_at FROM users WHERE role = 'teacher' ORDER BY id")

  if (teachers.length === 0) {
    console.log('ℹ️  등록된 교사 계정이 없습니다.')
    process.exit(0)
  }

  // --list: 목록만 출력
  if (listMode) {
    console.log('')
    console.log('📋 교사 계정 목록')
    console.log('')
    teachers.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.name} (${t.username}) - 생성일: ${t.created_at}`)
    })
    console.log('')
    process.exit(0)
  }

  let targetUser = null

  // 인자로 username이 주어진 경우
  if (usernameArg) {
    targetUser = teachers.find(t => t.username === usernameArg)
    if (!targetUser) {
      console.error(`❌ 교사 계정을 찾을 수 없습니다: ${usernameArg}`)
      console.error('')
      console.error('등록된 교사 목록:')
      teachers.forEach(t => console.error(`  - ${t.username} (${t.name})`))
      process.exit(1)
    }
  } else {
    // 대화형 선택
    console.log('')
    console.log('📋 교사 계정 목록')
    console.log('')
    teachers.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.name} (${t.username})`)
    })
    console.log('')

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const ask = (q) => new Promise(resolve => rl.question(q, resolve))

    const choice = await ask('삭제할 계정 번호를 입력하세요 (취소: 0): ')
    rl.close()

    const index = parseInt(choice, 10) - 1
    if (choice === '0' || isNaN(index) || index < 0 || index >= teachers.length) {
      console.log('취소되었습니다.')
      process.exit(0)
    }

    targetUser = teachers[index]
  }

  // 관련 데이터 확인
  const relatedData = {
    posts: db.get('SELECT COUNT(*) as count FROM posts WHERE author_id = ?', [targetUser.id])?.count || 0,
    assignments: db.get('SELECT COUNT(*) as count FROM assignments WHERE author_id = ?', [targetUser.id])?.count || 0,
    comments: db.get('SELECT COUNT(*) as count FROM comments WHERE author_id = ?', [targetUser.id])?.count || 0,
  }

  const hasRelatedData = relatedData.posts > 0 || relatedData.assignments > 0 || relatedData.comments > 0

  console.log('')
  console.log(`🎯 삭제 대상: ${targetUser.name} (${targetUser.username})`)

  if (hasRelatedData) {
    console.log('')
    console.log('⚠️  관련 데이터가 존재합니다:')
    if (relatedData.posts > 0) console.log(`   - 게시물: ${relatedData.posts}개`)
    if (relatedData.assignments > 0) console.log(`   - 과제: ${relatedData.assignments}개`)
    if (relatedData.comments > 0) console.log(`   - 댓글: ${relatedData.comments}개`)
  }

  // --force가 없으면 확인
  if (!forceMode) {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout })
    const ask2 = (q) => new Promise(resolve => rl2.question(q, resolve))

    console.log('')
    const confirm = await ask2('정말 삭제하시겠습니까? (y/N): ')
    rl2.close()

    if (confirm.toLowerCase() !== 'y') {
      console.log('취소되었습니다.')
      process.exit(0)
    }
  }

  // 삭제 실행
  console.log('')
  console.log('🗑️  삭제 중...')

  // 관련 데이터 삭제 (외래키 제약 회피)
  if (relatedData.comments > 0) {
    db.run('DELETE FROM comments WHERE author_id = ?', [targetUser.id])
    console.log(`   - 댓글 ${relatedData.comments}개 삭제`)
  }

  if (relatedData.posts > 0) {
    // 게시물의 댓글, 좋아요, 파일도 삭제
    const postIds = db.all('SELECT id FROM posts WHERE author_id = ?', [targetUser.id]).map(p => p.id)
    if (postIds.length > 0) {
      const placeholders = postIds.map(() => '?').join(',')
      db.run(`DELETE FROM comments WHERE post_id IN (${placeholders})`, postIds)
      db.run(`DELETE FROM likes WHERE post_id IN (${placeholders})`, postIds)
      db.run(`DELETE FROM files WHERE post_id IN (${placeholders})`, postIds)
    }
    db.run('DELETE FROM posts WHERE author_id = ?', [targetUser.id])
    console.log(`   - 게시물 ${relatedData.posts}개 삭제 (댓글, 좋아요, 파일 포함)`)
  }

  if (relatedData.assignments > 0) {
    // 과제의 문제, 제출물, 답변, 파일도 삭제
    const assignmentIds = db.all('SELECT id FROM assignments WHERE author_id = ?', [targetUser.id]).map(a => a.id)
    if (assignmentIds.length > 0) {
      const placeholders = assignmentIds.map(() => '?').join(',')

      // 제출물 관련 삭제
      const submissionIds = db.all(`SELECT id FROM submissions WHERE assignment_id IN (${placeholders})`, assignmentIds).map(s => s.id)
      if (submissionIds.length > 0) {
        const subPlaceholders = submissionIds.map(() => '?').join(',')
        db.run(`DELETE FROM submission_answers WHERE submission_id IN (${subPlaceholders})`, submissionIds)
        db.run(`DELETE FROM files WHERE submission_id IN (${subPlaceholders})`, submissionIds)
        db.run(`DELETE FROM submissions WHERE id IN (${subPlaceholders})`, submissionIds)
      }

      db.run(`DELETE FROM assignment_questions WHERE assignment_id IN (${placeholders})`, assignmentIds)
      db.run('DELETE FROM assignments WHERE author_id = ?', [targetUser.id])
    }
    console.log(`   - 과제 ${relatedData.assignments}개 삭제 (문제, 제출물, 답변 포함)`)
  }

  // refresh_tokens는 CASCADE로 자동 삭제됨
  // notifications에서 sender_id 관련 레코드 삭제
  db.run('DELETE FROM notifications WHERE sender_id = ?', [targetUser.id])

  // 최종 사용자 삭제
  db.run('DELETE FROM users WHERE id = ?', [targetUser.id])

  saveDatabase()

  console.log('')
  console.log(`✅ 교사 계정 삭제 완료: ${targetUser.name} (${targetUser.username})`)
}

main().catch(err => {
  console.error('❌ 오류:', err.message)
  process.exit(1)
})
