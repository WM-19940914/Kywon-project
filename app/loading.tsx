/**
 * 전역 로딩 화면
 *
 * 페이지 전환 시 표시되는 로딩 인디케이터입니다.
 */

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    </div>
  )
}
