/**
 * 전역 에러 페이지
 *
 * 예상치 못한 에러 발생 시 사용자에게 안내합니다.
 * Next.js App Router의 error.tsx 컨벤션을 따릅니다.
 */

'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('애플리케이션 에러:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-gray-300 mb-4">오류</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          문제가 발생했습니다
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          일시적인 오류가 발생했습니다. 다시 시도해 주세요.
          <br />
          문제가 계속되면 관리자에게 문의해 주세요.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            다시 시도
          </button>
          <a
            href="/"
            className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            홈으로 이동
          </a>
        </div>
      </div>
    </div>
  )
}
