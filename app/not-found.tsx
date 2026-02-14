/**
 * 404 페이지
 *
 * 존재하지 않는 경로에 접근했을 때 표시됩니다.
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="text-7xl font-bold text-gray-200 mb-4">404</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
          <br />
          주소를 다시 확인해 주세요.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          홈으로 이동
        </Link>
      </div>
    </div>
  )
}
