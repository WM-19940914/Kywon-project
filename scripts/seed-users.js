/**
 * 사용자 계정 생성 스크립트
 *
 * Supabase Auth에 계정을 만들고, user_profiles 테이블에 역할 정보를 넣습니다.
 *
 * 실행 방법:
 *   1. .env.local에 SUPABASE_SERVICE_ROLE_KEY 추가
 *      (Supabase 대시보드 → Settings → API → service_role 키 복사)
 *   2. node scripts/seed-users.js
 *
 * ⚠️ 주의: service_role 키는 절대 외부에 노출하면 안 됩니다!
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

// 환경변수 확인
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다!')
  console.error('   .env.local에 다음 값들이 있는지 확인하세요:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// service_role 키로 Supabase 클라이언트 생성 (관리자 권한)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// 생성할 계정 목록 (비밀번호는 별도 JSON 파일에서 로드)
const users = require(path.join(__dirname, 'data', 'seed-users.json'))

async function seedUsers() {
  console.log('🚀 사용자 계정 생성을 시작합니다...\n')

  for (const user of users) {
    const email = `${user.username}@mellea.local`

    // 1) Supabase Auth에 계정 생성
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: user.password,
      email_confirm: true, // 이메일 인증 건너뛰기 (내부용이므로)
    })

    if (authError) {
      // 이미 존재하는 계정이면 건너뛰기
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        console.log(`⏭️  ${user.username} — 이미 존재하는 계정, 건너뜀`)
        continue
      }
      console.error(`❌ ${user.username} 계정 생성 실패:`, authError.message)
      continue
    }

    // 2) user_profiles 테이블에 역할 정보 INSERT
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: authData.user.id,
        username: user.username,
        display_name: user.displayName,
        role: user.role,
        affiliate_name: user.affiliateName,
      })

    if (profileError) {
      console.error(`❌ ${user.username} 프로필 저장 실패:`, profileError.message)
      continue
    }

    console.log(`✅ ${user.username} (${user.displayName}) — ${user.role} 역할로 생성 완료`)
  }

  console.log('\n🎉 사용자 계정 생성 완료!')
  console.log('\n📋 로그인 정보는 scripts/data/seed-users.json 파일을 참고하세요.')
}

seedUsers().catch(console.error)
