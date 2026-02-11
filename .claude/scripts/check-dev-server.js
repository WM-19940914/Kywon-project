#!/usr/bin/env node

/**
 * 개발 서버 상태 체크 및 자동 복구 스크립트
 * - localhost:3002 응답 확인
 * - 서버 다운 시 .next 캐시 삭제 및 재시작
 */

const http = require('http');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3002;
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const NEXT_CACHE = path.join(PROJECT_ROOT, '.next');

// 서버 체크 (타임아웃 2초)
function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// .next 캐시 삭제
function clearCache() {
  try {
    if (fs.existsSync(NEXT_CACHE)) {
      console.log('🗑️  Clearing .next cache...');
      if (process.platform === 'win32') {
        execSync(`rd /s /q "${NEXT_CACHE}"`, { stdio: 'ignore' });
      } else {
        execSync(`rm -rf "${NEXT_CACHE}"`, { stdio: 'ignore' });
      }
      console.log('✅ Cache cleared');
      return true;
    }
  } catch (err) {
    console.error('⚠️  Cache clear failed:', err.message);
    return false;
  }
}

// 포트 사용 중인지 확인
function isPortInUse() {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
      return result.includes('LISTENING');
    } else {
      execSync(`lsof -i:${PORT}`, { stdio: 'ignore' });
      return true;
    }
  } catch {
    return false;
  }
}

// 메인 로직
async function main() {
  const isHealthy = await checkServer();

  if (isHealthy) {
    // 서버 정상 - 아무것도 안 함
    process.exit(0);
  }

  console.log('\n⚠️  Dev server is not responding on port', PORT);

  // 포트가 사용 중이지만 응답이 없는 경우 (HMR 실패 상태)
  if (isPortInUse()) {
    console.log('🔧 Server process exists but not responding - clearing cache...');
    clearCache();
    console.log('💡 Please restart the dev server manually:');
    console.log('   npm run dev\n');
  } else {
    // 서버 자체가 죽은 경우
    console.log('❌ Server is completely down');
    clearCache();
    console.log('💡 Please restart the dev server:');
    console.log('   npm run dev\n');
  }

  process.exit(1);
}

main();
