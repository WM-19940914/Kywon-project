/**
 * 대시보드 404 페이지
 *
 * (dashboard) 그룹 내 존재하지 않는 경로 접근 시 표시됩니다.
 */

import Link from 'next/link'

export default function DashboardNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-slate-200 mb-4">404</div>
        <h1 className="text-lg font-bold text-slate-800 mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-slate-500 mb-6 text-sm">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-[#E09520] text-white text-sm font-bold rounded-xl hover:bg-[#c87d1a] transition-colors inline-block"
        >
          홈으로 이동
        </Link>
      </div>
    </div>
  )
}
