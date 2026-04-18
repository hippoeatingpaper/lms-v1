// scripts/generateCert.js
// HTTPS 인증서 생성 스크립트 (mkcert 사용)

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const CERT_DIR = './certs'

// 로컬 IP 주소 자동 감지
function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '192.168.1.100' // 기본값
}

function generateCert() {
  // 인증서 디렉터리 생성
  fs.mkdirSync(CERT_DIR, { recursive: true })

  const localIP = process.env.SERVER_IP || getLocalIP()
  console.log(`[CERT] 감지된 IP: ${localIP}`)

  // mkcert 설치 확인
  try {
    execSync('mkcert -version', { stdio: 'ignore' })
  } catch {
    console.error('[CERT] mkcert가 설치되어 있지 않습니다.')
    console.error('       설치 방법: choco install mkcert (Windows)')
    console.error('                  brew install mkcert (Mac)')
    console.error('')
    console.error('       설치 후: mkcert -install (로컬 CA 등록)')
    process.exit(1)
  }

  // 인증서 생성
  const certPath = path.join(CERT_DIR, 'cert.pem')
  const keyPath = path.join(CERT_DIR, 'key.pem')

  console.log('[CERT] 인증서 생성 중...')
  execSync(
    `mkcert -cert-file "${certPath}" -key-file "${keyPath}" localhost ${localIP} 127.0.0.1`,
    { stdio: 'inherit' }
  )

  console.log('')
  console.log('[CERT] 인증서 생성 완료!')
  console.log(`       인증서: ${certPath}`)
  console.log(`       개인키: ${keyPath}`)
  console.log('')
  console.log('[CERT] 다음 단계:')
  console.log('       1. .env 파일에 HTTPS_ENABLED=true 설정')
  console.log(`       2. .env 파일에 SERVER_IP=${localIP} 확인`)
  console.log('       3. npm run dev 로 서버 실행')
  console.log(`       4. 학생들에게 https://${localIP}:3000 주소 안내`)
}

generateCert()
