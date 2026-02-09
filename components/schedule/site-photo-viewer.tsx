/**
 * 현장사진 보기 전용 컴포넌트
 *
 * 업로드된 현장사진을 조회만 할 수 있는 컴포넌트입니다.
 * - 업로드/삭제 기능 없음 (읽기 전용)
 * - 정산관리 등에서 사용
 *
 * 사용 위치: 정산관리, 과거내역 등
 */

'use client'

import { useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface SitePhotoViewerProps {
  /** 현재 사진 URL 배열 */
  photos: string[]
  /** 발주 현장명 (다이얼로그 제목에 표시) */
  businessName: string
}

/**
 * 현장사진 보기 컴포넌트 (읽기 전용)
 */
export function SitePhotoViewer({ photos = [], businessName }: SitePhotoViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  // 사진 개수
  const photoCount = photos.length

  // 사진이 없으면 버튼 표시 안 함
  if (photoCount === 0) {
    return (
      <span className="text-xs text-gray-300">사진 없음</span>
    )
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors border bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            onClick={(e) => e.stopPropagation()}
          >
            <ImageIcon className="h-3 w-3" />
            <span>보기</span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>현장사진 보기</DialogTitle>
            <DialogDescription>
              {businessName} 현장의 설치 사진 ({photoCount}장)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 사진 그리드 */}
            <div className="grid grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
              {photos.map((url, index) => (
                <div
                  key={index}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => setSelectedPhoto(url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`현장사진 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* 확대 힌트 (호버 시) */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      클릭하여 크게 보기
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 안내 문구 */}
            <p className="text-xs text-gray-500 text-center">
              💡 사진을 클릭하면 크게 볼 수 있습니다
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 사진 확대 다이얼로그 */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-5xl p-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto}
                alt="현장사진 확대"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <button
                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                onClick={() => setSelectedPhoto(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
