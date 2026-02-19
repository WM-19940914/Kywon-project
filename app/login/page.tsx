/**
 * 로그인 페이지 — 센터 심플형 (프리미엄)
 *
 * 화면 중앙에 MeLEA 로고 + 글래스 카드 로그인 폼
 * 은은한 배경 + 미니멀 프리미엄 디자인
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
      className="w-full py-3.5 rounded-2xl text-white text-sm font-bold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={{
        background: 'linear-gradient(135deg, #E09520 0%, #c57d12 100%)',
        boxShadow: pending ? 'none' : '0 8px 24px -4px rgba(224, 149, 32, 0.45)',
      }}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          로그인 중...
        </span>
      ) : '로그인'}
    </button>
  )
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, null)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #f8f6f3 0%, #f0ebe4 30%, #e8e2d8 60%, #f5f0ea 100%)' }}
    >
      {/* 배경 장식 — 은은한 원형 글로우 */}
      <div
        className="absolute rounded-full opacity-[0.15] blur-3xl"
        style={{
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, #E09520 0%, transparent 70%)',
          top: '-15%', right: '-10%',
        }}
      />
      <div
        className="absolute rounded-full opacity-[0.08] blur-3xl"
        style={{
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, #E09520 0%, transparent 70%)',
          bottom: '-10%', left: '-8%',
        }}
      />

      {/* 메인 카드 */}
      <div
        className="w-full max-w-[400px] relative z-10 rounded-3xl p-8 sm:p-10"
        style={{
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255,255,255,0.5) inset',
        }}
      >
        {/* MeLEA 로고 */}
        <div className="text-center mb-9">
          <div
            className="inline-flex items-baseline justify-center rounded-2xl mb-6"
            style={{
              padding: '14px 26px',
              background: 'linear-gradient(135deg, #E09520 0%, #d48a18 100%)',
              boxShadow: '0 10px 30px -6px rgba(224, 149, 32, 0.4)',
            }}
          >
            <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.5px' }}>M</span>
            <span style={{ color: '#ffffff', fontStyle: 'italic', fontSize: '2.3rem', fontWeight: 500, lineHeight: 1, marginLeft: '-1px', marginRight: '4px' }}>e</span>
            <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.5px' }}>LEA</span>
          </div>
          <h1 className="text-[17px] font-bold text-slate-700 tracking-tight">
            교원그룹 에어컨 발주관리 시스템
          </h1>
        </div>

        {/* 로그인 폼 */}
        <form action={formAction} className="space-y-5">
          {/* 에러 메시지 */}
          {state?.error && (
            <div className="flex items-center gap-2 bg-brick-50/80 border border-brick-200/60 text-brick-500 text-sm px-4 py-3 rounded-2xl">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {state.error}
            </div>
          )}

          {/* 사용자이름 입력 */}
          <div className="space-y-2">
            <label htmlFor="username" className="block text-xs font-semibold text-slate-400 tracking-wider pl-1">
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
              className="w-full px-4 py-3.5 rounded-2xl border border-white/60 text-sm transition-all placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-carrot-400/25 focus:border-carrot-300"
              style={{ background: 'rgba(255,255,255,0.7)' }}
            />
          </div>

          {/* 비밀번호 입력 */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-400 tracking-wider pl-1">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-3.5 rounded-2xl border border-white/60 text-sm transition-all placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-carrot-400/25 focus:border-carrot-300"
              style={{ background: 'rgba(255,255,255,0.7)' }}
            />
          </div>

          {/* 로그인 버튼 */}
          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>

        {/* 하단 구분선 + 교원 로고 + 안내 */}
        <div className="mt-8 pt-6 border-t border-slate-200/50 flex flex-col items-center gap-4">
          {/* 교원그룹 CSS 로고 */}
          <div className="flex items-center gap-2 opacity-50">
            {/* KYO / WON 2줄 텍스트 */}
            <div className="leading-[1.05]" style={{ fontWeight: 900, letterSpacing: '-0.5px' }}>
              <div className="flex items-center" style={{ fontSize: '13px' }}>
                <span style={{ color: '#2D2519' }}>KY</span>
                <span style={{ color: '#E09520' }}>O</span>
              </div>
              <div className="flex items-center" style={{ fontSize: '13px' }}>
                <span style={{ color: '#2D2519' }}>W</span>
                <span style={{ color: '#E09520' }}>O</span>
                <span style={{ color: '#2D2519' }}>N</span>
              </div>
            </div>
            <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '16px', marginLeft: '2px' }}>교원</span>
          </div>

        </div>

        {/* 카드 우측 하단 계정문의 */}
        <p className="text-right text-[9px] text-slate-300/70 mt-3 pr-1">
          계정문의 : 김우민 (010-5498-6918)
        </p>
      </div>

    </div>
  )
}
