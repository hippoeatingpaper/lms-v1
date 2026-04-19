// scripts/createTeacher.js
// 교사 계정 생성 CLI

import readline from 'readline'
import bcrypt from 'bcryptjs'
import { initDatabase, db, saveDatabase } from '../server/db.js'
import { createInitialSchema } from '../server/migrations/schema.js'

const args = process.argv.slice(2)
const forceMode = args.includes('--force')
const addMode = args.includes('--add')

async function main() {
  // DB 초기화
  await initDatabase()
  createInitialSchema()

  // 기존 교사 계정 확인
  const existingTeachers = db.all("SELECT * FROM users WHERE role = 'teacher'")

  if (existingTeachers.length > 0 && !forceMode && !addMode) {
    console.error('⚠️  이미 교사 계정이 존재합니다.')
    console.error(`   현재 ${existingTeachers.length}개의 교사 계정이 등록되어 있습니다.`)
    console.error('')
    console.error('   옵션:')
    console.error('   --force : 기존 교사 계정을 삭제하고 새로 생성')
    console.error('   --add   : 추가 교사 계정 생성 (기존 유지)')
    process.exit(1)
  }

  if (forceMode && existingTeachers.length > 0) {
    console.log(`⚠️  기존 교사 계정 ${existingTeachers.length}개를 삭제합니다...`)
    db.run("DELETE FROM users WHERE role = 'teacher'", [])
    console.log('✅ 기존 교사 계정 삭제 완료')
  }

  // 대화형 입력으로 새 교사 계정 생성
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q) => new Promise(resolve => rl.question(q, resolve))

  console.log('')
  console.log('📝 새 교사 계정 생성')
  console.log('')

  const name = await ask('이름: ')
  const username = await ask('아이디: ')
  const password = await ask('비밀번호: ')
  rl.close()

  // 유효성 검사
  if (!name || !username || !password) {
    console.error('❌ 모든 필드를 입력해야 합니다.')
    process.exit(1)
  }

  if (username.length < 3) {
    console.error('❌ 아이디는 3자 이상이어야 합니다.')
    process.exit(1)
  }

  if (password.length < 4) {
    console.error('❌ 비밀번호는 4자 이상이어야 합니다.')
    process.exit(1)
  }

  // 중복 아이디 확인
  const existingUser = db.get('SELECT id FROM users WHERE username = ?', [username])
  if (existingUser) {
    console.error('❌ 이미 사용 중인 아이디입니다.')
    process.exit(1)
  }

  // 비밀번호 해시
  const passwordHash = await bcrypt.hash(password, 10)

  // DB 작업
  db.run(
    'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [name, username, passwordHash, 'teacher']
  )

  // 즉시 저장 (스크립트 종료 전)
  saveDatabase()

  console.log('')
  console.log(`✅ 교사 계정 생성 완료`)
  console.log(`   이름: ${name}`)
  console.log(`   아이디: ${username}`)
}

main().catch(err => {
  console.error('❌ 오류:', err.message)
  process.exit(1)
})
