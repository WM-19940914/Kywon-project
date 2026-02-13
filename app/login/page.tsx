/**
 * 로그인 페이지 — MeLEA 브랜드 간판
 *
 * 좌측: 브랜드 비주얼 (MeLEA 로고 + 슬로건 + 장식 요소)
 * 우측: 로그인 폼
 * 모바일: 상단 로고 + 아래 폼
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
      className="w-full py-3 rounded-xl text-white text-sm font-bold tracking-wide shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="min-h-screen flex">
      {/* ── 좌측: 브랜드 비주얼 (데스크톱에서만 보임) ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(145deg, #2D2519 0%, #1a1610 50%, #2D2519 100%)' }}
      >
        {/* 배경 장식 — 큰 원형 글로우 */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.08]"
          style={{
            background: 'radial-gradient(circle, #E09520 0%, transparent 70%)',
            top: '-10%',
            right: '-10%',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05]"
          style={{
            background: 'radial-gradient(circle, #E09520 0%, transparent 70%)',
            bottom: '-5%',
            left: '-5%',
          }}
        />

        {/* 대각선 라인 장식 */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, #E09520 40px, #E09520 41px)',
          }}
        />

        {/* 중앙 콘텐츠 */}
        <div className="relative z-10 text-center px-12">
          {/* MeLEA 대형 로고 */}
          <div className="mb-8">
            <div
              className="inline-flex items-baseline justify-center rounded-2xl"
              style={{ padding: '16px 28px', background: '#E09520', boxShadow: '0 20px 50px -10px rgba(224, 149, 32, 0.4)' }}
            >
              <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '2.8rem', letterSpacing: '-1px' }}>M</span>
              <span style={{ color: '#ffffff', fontStyle: 'italic', fontSize: '3.2rem', fontWeight: 500, lineHeight: 1, margin: '0 -1px' }}>e</span>
              <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '2.8rem', letterSpacing: '-1px' }}>LEA</span>
            </div>
          </div>

          {/* 슬로건 */}
          <h2 className="text-2xl font-bold text-white/90 mb-3 tracking-tight">
            교원그룹 에어컨 발주관리 시스템
          </h2>
          <p className="text-sm text-white/40 leading-relaxed max-w-xs mx-auto">
            발주부터 설치, 정산까지<br />
            한 곳에서 관리하세요
          </p>

        </div>
      </div>

      {/* ── 우측: 로그인 폼 ── */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-orange-50/30 px-6">
        <div className="w-full max-w-sm">
          {/* 모바일용 로고 (lg 이상에서 숨김) */}
          <div className="lg:hidden text-center mb-10">
            <div
              className="inline-flex items-baseline justify-center rounded-2xl mb-4"
              style={{ padding: '12px 22px', background: '#E09520', boxShadow: '0 12px 30px -6px rgba(224, 149, 32, 0.35)' }}
            >
              <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.5px' }}>M</span>
              <span style={{ color: '#ffffff', fontStyle: 'italic', fontSize: '1.8rem', fontWeight: 500, lineHeight: 1, margin: '0 -0.5px' }}>e</span>
              <span style={{ color: '#2D2519', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.5px' }}>LEA</span>
            </div>
            <h1 className="text-lg font-bold text-slate-800">교원그룹 에어컨 발주관리 시스템</h1>
          </div>

          {/* 데스크톱용 환영 문구 */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">환영합니다</h1>
            <p className="text-sm text-slate-400 mt-1">계정 정보를 입력하여 로그인하세요</p>
          </div>

          {/* 로그인 폼 */}
          <form action={formAction} className="space-y-5">
            {/* 에러 메시지 */}
            {state?.error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200/80 text-red-600 text-sm px-4 py-3 rounded-xl">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {state.error}
              </div>
            )}

            {/* 사용자이름 입력 */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
                className="w-full px-4 py-3 rounded-xl border border-slate-200/80 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all placeholder:text-slate-300"
              />
            </div>

            {/* 비밀번호 입력 */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-slate-200/80 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all placeholder:text-slate-300"
              />
            </div>

            {/* 로그인 버튼 */}
            <div className="pt-1">
              <SubmitButton />
            </div>
          </form>

          {/* 구분선 */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200/80" />
            <span className="text-[10px] text-slate-300 font-medium uppercase tracking-widest">MeLEA</span>
            <div className="flex-1 h-px bg-slate-200/80" />
          </div>

          {/* 하단 안내 */}
          <p className="text-center text-[11px] text-slate-300 tracking-wide">
            MeLEA 담당자 김우민 010-5498-6918
          </p>
        </div>
      </div>
    </div>
  )
}
