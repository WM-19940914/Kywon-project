/**
 * 대시보드 에러 페이지
 *
 * (dashboard) 그룹 내에서 에러 발생 시 표시됩니다.
 * 이 파일이 없으면 "missing required error components" 경고가 발생합니다.
 */

'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('대시보드 에러:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl font-bold text-slate-200 mb-4">오류</div>
        <h1 className="text-lg font-bold text-slate-800 mb-2">
          페이지를 불러오지 못했습니다
        </h1>
        <p className="text-slate-500 mb-6 text-sm">
          일시적인 오류입니다. 아래 버튼을 눌러 다시 시도해 주세요.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-[#E09520] text-white text-sm font-bold rounded-xl hover:bg-[#c87d1a] transition-colors"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
