/**
 * 현장사진 업로드 컴포넌트
 *
 * 설치팀장이 현장 사진을 업로드할 수 있는 컴포넌트입니다.
 * - 드래그 앤 드롭 지원
 * - 파일 선택 버튼
 * - 이미지 미리보기 (썸네일)
 * - 개별 삭제 기능
 *
 * 사용 위치: 설치예정/설치완료 탭
 */

'use client'

import { useState, useRef, DragEvent } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { uploadMultipleSitePhotos, deleteSitePhoto } from '@/lib/supabase/storage'

interface SitePhotoUploadProps {
  /** 현재 사진 URL 배열 */
  photos: string[]
  /** 사진 변경 콜백 */
  onChange: (photos: string[]) => void
  /** 발주 현장명 (다이얼로그 제목에 표시) */
  businessName: string
  /** 발주 ID (Storage 경로에 사용) */
  orderId: string
}

/**
 * 현장사진 업로드 컴포넌트
 */
export function SitePhotoUpload({ photos = [], onChange, businessName, orderId }: SitePhotoUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 파일 추가 핸들러 (여러 장 가능)
   * Supabase Storage에 업로드하고 URL 받아오기
   */
  const handleFiles = async (files: FileList | null) => {
    if (!files) return

    // 이미지 파일만 필터링
    const imageFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/')
    )

    if (imageFiles.length === 0) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    // Supabase Storage에 업로드
    setIsUploading(true)
    try {
      const newUrls = await uploadMultipleSitePhotos(imageFiles, orderId)

      if (newUrls.length === 0) {
        alert('파일 업로드에 실패했습니다.')
        return
      }

      // 기존 사진에 새 URL 추가
      onChange([...photos, ...newUrls])

      // 일부만 성공한 경우 알림
      if (newUrls.length < imageFiles.length) {
        alert(`${newUrls.length}/${imageFiles.length}개 파일이 업로드되었습니다.`)
      }
    } catch (error) {
      console.error('파일 업로드 실패:', error)
      alert('파일 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  /**
   * 드래그 오버 핸들러
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  /**
   * 드래그 종료 핸들러
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  /**
   * 드롭 핸들러
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  /**
   * 사진 삭제 핸들러
   * Supabase Storage에서도 삭제
   */
  const handleDelete = async (index: number) => {
    const photoUrl = photos[index]

    // Supabase Storage에서 삭제
    const success = await deleteSitePhoto(photoUrl)

    if (!success) {
      alert('사진 삭제에 실패했습니다.')
      return
    }

    // 로컬 상태에서도 제거
    onChange(photos.filter((_, i) => i !== index))
  }

  /**
   * 파일 선택 버튼 클릭
   */
  const handleSelectClick = () => {
    fileInputRef.current?.click()
  }

  // 사진 개수
  const photoCount = photos.length

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-xs transition-colors border ${
              photoCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                : 'bg-gray-50 border-gray-300 border-dashed text-gray-400 hover:bg-gray-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <ImageIcon className="h-3 w-3" />
            {photoCount > 0 ? (
              <span className="leading-tight">사진 {photoCount}장</span>
            ) : (
              <>
                <span className="leading-tight">사진</span>
                <span className="leading-tight">업로드</span>
              </>
            )}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>현장사진 업로드</DialogTitle>
            <DialogDescription>
              {businessName} 현장의 설치 사진을 올려주세요. (드래그 & 드롭 또는 파일 선택)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 드래그 앤 드롭 영역 */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto mb-3 text-blue-500 animate-spin" />
                  <p className="text-sm text-blue-600 font-medium">
                    업로드 중...
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-2">
                    이미지를 여기로 드래그하거나
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectClick}
                    disabled={isUploading}
                  >
                    파일 선택
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </>
              )}
            </div>

            {/* 업로드된 사진 미리보기 */}
            {photoCount > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  업로드된 사진 ({photoCount}장)
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {photos.map((url, index) => (
                    <div
                      key={index}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`현장사진 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {/* 삭제 버튼 (호버 시 표시) */}
                      <button
                        type="button"
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(index)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 안내 문구 */}
            <p className="text-xs text-gray-500">
              💡 설치 전/후 사진, 장비 상태 등을 촬영하여 올려주세요.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
