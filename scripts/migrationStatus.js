// scripts/migrationStatus.js
// 마이그레이션 상태 확인 CLI

import { initDatabase } from '../server/db.js'
import { getMigrationStatus } from '../server/migrations/index.js'

async function main() {
  try {
    await initDatabase()
    const status = getMigrationStatus()

    console.log('')
    console.log('='.repeat(60))
    console.log(' 마이그레이션 상태')
    console.log('='.repeat(60))

    if (status.applied.length > 0) {
      console.log('\n[적용된 마이그레이션]')
      console.log('-'.repeat(60))
      for (const m of status.applied) {
        const rollbackable = m.hasDown ? '✓' : '✗'
        console.log(`  v${m.version}: ${m.description}`)
        console.log(`       적용일: ${m.applied_at}`)
        console.log(`       롤백가능: ${rollbackable}`)
        if (m.backup_path) {
          console.log(`       백업: ${m.backup_path}`)
        }
        console.log('')
      }
    } else {
      console.log('\n[적용된 마이그레이션]')
      console.log('  (없음)')
    }

    if (status.pending.length > 0) {
      console.log('\n[대기 중인 마이그레이션]')
      console.log('-'.repeat(60))
      for (const m of status.pending) {
        const rollbackable = m.hasDown ? '✓' : '✗'
        console.log(`  v${m.version}: ${m.description} (롤백가능: ${rollbackable})`)
      }
    } else {
      console.log('\n[대기 중인 마이그레이션]')
      console.log('  (없음) - 모든 마이그레이션이 적용되었습니다.')
    }

    console.log('')
    console.log('='.repeat(60))

    process.exit(0)
  } catch (err) {
    console.error('[ERROR] 마이그레이션 상태 확인 실패:', err.message)
    process.exit(1)
  }
}

main()
