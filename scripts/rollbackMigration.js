// scripts/rollbackMigration.js
// 마이그레이션 롤백 CLI

import { initDatabase } from '../server/db.js'
import { rollbackTo, getMigrationStatus } from '../server/migrations/index.js'

const targetVersion = parseInt(process.argv[2])

if (isNaN(targetVersion) || targetVersion < 0) {
  console.log('')
  console.log('사용법: npm run migrate:rollback <버전>')
  console.log('')
  console.log('예시:')
  console.log('  npm run migrate:rollback 2   # v3 이후를 롤백하고 v2까지 유지')
  console.log('  npm run migrate:rollback 0   # 모든 마이그레이션 롤백')
  console.log('')
  process.exit(1)
}

async function main() {
  try {
    await initDatabase()

    // 현재 상태 출력
    const status = getMigrationStatus()
    console.log('')
    console.log('[현재 적용된 마이그레이션]')
    if (status.applied.length === 0) {
      console.log('  (없음)')
    } else {
      for (const m of status.applied) {
        console.log(`  v${m.version}: ${m.description}`)
      }
    }
    console.log('')

    // 롤백 실행
    console.log(`[롤백 목표] v${targetVersion}까지 유지`)
    console.log('')

    rollbackTo(targetVersion)

    // 결과 출력
    const newStatus = getMigrationStatus()
    console.log('')
    console.log('[롤백 후 적용된 마이그레이션]')
    if (newStatus.applied.length === 0) {
      console.log('  (없음)')
    } else {
      for (const m of newStatus.applied) {
        console.log(`  v${m.version}: ${m.description}`)
      }
    }
    console.log('')

    process.exit(0)
  } catch (err) {
    console.error('[ERROR] 롤백 실패:', err.message)
    process.exit(1)
  }
}

main()
