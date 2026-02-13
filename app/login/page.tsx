/**
 * 로그인 페이지
 *
 * 화면 중앙에 로그인 카드가 표시됩니다.
 * 사용자이름 + 비밀번호를 입력하면 Supabase Auth로 인증합니다.
 *
 * 내부적으로 사용자이름을 "{username}@mellea.local" 이메일로 변환합니다.
 * (사용자는 이메일을 알 필요 없이 사용자이름만 입력하면 됩니다)
 */

'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'

/** 로그인 버튼 — useFormStatus로 로딩 상태 감지 */
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? '로그인 중...' : '로그인'}
    </button>
  )
}

export default function LoginPage() {
  // useFormState: 서버 액션의 결과(에러 메시지 등)를 관리 (React 18 + Next.js 14 호환)
  const [state, formAction] = useFormState(login, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* 로그인 카드 */}
      <div className="w-full max-w-sm mx-4">
        {/* MeLEA 로고 영역 */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center rounded-2xl shadow-lg mb-4"
            style={{
              background: '#E09520',
              padding: '10px 16px',
              boxShadow: '0 10px 25px -5px rgba(224, 149, 32, 0.35)',
            }}
          >
            <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.5px' }}>M</span>
            <span style={{ color: '#ffffff', fontStyle: 'italic', fontSize: '1.5rem', fontWeight: 500, paddingRight: '1px', lineHeight: 1 }}>e</span>
            <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.5px' }}>LEA</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">에어컨 발주 관리 시스템</h1>
          <p className="text-sm text-slate-500 mt-1">로그인하여 시작하세요</p>
        </div>

        {/* 로그인 폼 */}
        <form action={formAction} className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8 space-y-5">
          {/* 에러 메시지 */}
          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {state.error}
            </div>
          )}

          {/* 사용자이름 입력 */}
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-slate-700">
              사용자이름
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              placeholder="사용자이름을 입력하세요"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition placeholder:text-slate-400"
            />
          </div>

          {/* 비밀번호 입력 */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition placeholder:text-slate-400"
            />
          </div>

          {/* 로그인 버튼 */}
          <SubmitButton />
        </form>

        {/* 하단 안내 */}
        <p className="text-center text-xs text-slate-400 mt-6">
          계정이 없으신가요? 관리자에게 문의하세요<br />
          <span className="text-slate-500">(김우민 010-5498-6918)</span>
        </p>
      </div>
    </div>
  )
}
