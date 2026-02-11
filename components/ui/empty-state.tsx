/**
 * 빈 상태 표시 컴포넌트
 *
 * 데이터가 없을 때 아이콘 + 제목 + 설명 + 액션 버튼을 표준화된 형태로 보여줍니다.
 * 모든 페이지에서 동일한 빈 상태 UI를 사용하기 위해 만들었습니다.
 */

import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  /** 중앙에 표시할 아이콘 */
  icon: LucideIcon
  /** 제목 (예: "발주가 없습니다") */
  title: string
  /** 부가 설명 (예: "새 발주를 등록해 보세요") */
  description?: string
  /** 액션 버튼 텍스트 */
  actionLabel?: string
  /** 액션 버튼 클릭 핸들러 */
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="bg-slate-100 rounded-2xl p-5 mb-4">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <p className="text-lg font-medium text-slate-600 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-slate-400">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
