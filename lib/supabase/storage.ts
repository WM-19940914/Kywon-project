/**
 * Supabase Storage 업로드 유틸리티
 *
 * 현장사진 등 파일을 Supabase Storage에 업로드하고
 * public URL을 반환합니다.
 */

import { createClient } from '@/lib/supabase/client'

/** Storage 버킷 이름 */
const SITE_PHOTOS_BUCKET = 'site-photos'

/**
 * 현장사진 업로드
 *
 * @param file - 업로드할 파일
 * @param orderId - 발주 ID (폴더 경로에 사용)
 * @returns 업로드된 파일의 public URL
 *
 * 예시:
 *   const url = await uploadSitePhoto(file, 'order-123')
 *   // → https://...supabase.co/storage/v1/object/public/site-photos/order-123/photo-1234.jpg
 */
export async function uploadSitePhoto(file: File, orderId: string): Promise<string | null> {
  const supabase = createClient()

  // 파일명: 타임스탬프 + 원본파일명 (중복 방지)
  const timestamp = Date.now()
  const fileName = `${timestamp}-${file.name}`
  const filePath = `${orderId}/${fileName}`

  console.log('📸 업로드 시작:', {
    버킷: SITE_PHOTOS_BUCKET,
    파일경로: filePath,
    파일크기: `${(file.size / 1024).toFixed(2)}KB`,
    파일타입: file.type,
  })

  try {
    // Storage에 업로드
    const { data, error } = await supabase.storage
      .from(SITE_PHOTOS_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600', // 1시간 캐시
        upsert: false, // 덮어쓰기 방지
      })

    if (error) {
      console.error('❌ 파일 업로드 실패:', {
        에러메시지: error.message,
        에러상세: error,
      })
      return null
    }

    console.log('✅ 업로드 성공:', data)

    // Public URL 생성
    const { data: urlData } = supabase.storage
      .from(SITE_PHOTOS_BUCKET)
      .getPublicUrl(data.path)

    console.log('🔗 Public URL:', urlData.publicUrl)

    return urlData.publicUrl
  } catch (error) {
    console.error('❌ 파일 업로드 중 오류:', error)
    return null
  }
}

/**
 * 현장사진 삭제
 *
 * @param photoUrl - 삭제할 사진의 public URL
 * @returns 성공 여부
 *
 * 예시:
 *   await deleteSitePhoto('https://...supabase.co/storage/v1/object/public/site-photos/order-123/photo-1234.jpg')
 */
export async function deleteSitePhoto(photoUrl: string): Promise<boolean> {
  const supabase = createClient()

  try {
    // URL에서 파일 경로 추출
    // 예: https://...supabase.co/storage/v1/object/public/site-photos/order-123/photo.jpg
    // → order-123/photo.jpg
    const urlParts = photoUrl.split(`${SITE_PHOTOS_BUCKET}/`)
    if (urlParts.length < 2) {
      console.error('잘못된 URL 형식:', photoUrl)
      return false
    }

    const filePath = urlParts[1]

    // Storage에서 삭제
    const { error } = await supabase.storage
      .from(SITE_PHOTOS_BUCKET)
      .remove([filePath])

    if (error) {
      console.error('파일 삭제 실패:', error.message)
      return false
    }

    return true
  } catch (error) {
    console.error('파일 삭제 중 오류:', error)
    return false
  }
}

/**
 * 여러 현장사진 일괄 업로드
 *
 * @param files - 업로드할 파일 배열
 * @param orderId - 발주 ID
 * @returns 업로드된 파일들의 public URL 배열
 */
export async function uploadMultipleSitePhotos(
  files: File[],
  orderId: string
): Promise<string[]> {
  const urls = await Promise.all(
    files.map(file => uploadSitePhoto(file, orderId))
  )

  // null 제거 (업로드 실패한 파일 제외)
  return urls.filter((url): url is string => url !== null)
}
