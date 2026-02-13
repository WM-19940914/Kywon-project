/**
 * 엑셀 다운로드 공통 버튼 컴포넌트
 * - 모든 페이지에서 동일한 스타일로 사용
 * - 초록색 outline 버튼 + Download 아이콘
 */
'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExcelExportButtonProps {
  /** 클릭 시 실행할 엑셀 다운로드 함수 */
  onClick: () => void
  /** 버튼 비활성화 여부 (데이터 없을 때 등) */
  disabled?: boolean
  /** 버튼 라벨 (기본: '엑셀 다운로드') */
  label?: string
}

export function ExcelExportButton({
  onClick,
  disabled = false,
  label = '엑셀 다운로드',
}: ExcelExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="border-green-500 text-green-700 hover:bg-green-50 hover:text-green-800 gap-1.5"
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  )
}
