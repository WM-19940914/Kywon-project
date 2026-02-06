/**
 * 카카오 지도 SDK 동적 로드 유틸리티
 *
 * 비유: "택배가 도착할 때까지 기다렸다가, 도착하면 알려주는 함수"
 * - 카카오 지도 스크립트를 <script> 태그로 삽입
 * - 완전히 로드되면 Promise를 resolve
 * - 이미 로드돼 있으면 바로 resolve (중복 로드 방지)
 */

let loadPromise: Promise<void> | null = null

export function loadKakaoMapSdk(): Promise<void> {
  // 이미 로드 중이거나 완료됐으면 같은 Promise 재사용
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    // 이미 로드 완료된 경우
    if (typeof window !== 'undefined' && window.kakao?.maps?.Map) {
      resolve()
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
    if (!apiKey) {
      reject(new Error('NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수가 설정되지 않았습니다.'))
      return
    }

    const script = document.createElement('script')
    // autoload=false: 스크립트 로드 후 수동으로 kakao.maps.load() 호출
    // libraries=services: Geocoder(주소→좌표 변환) 기능 포함
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`
    script.onload = () => {
      window.kakao.maps.load(() => {
        resolve()
      })
    }
    script.onerror = () => {
      loadPromise = null
      reject(new Error('카카오 지도 SDK 로드 실패'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

/**
 * 주소 → 정확한 위도/경도 좌표 변환 (카카오 Geocoder)
 *
 * 기존 SIGUNGU_COORDS 매핑 테이블 대신 사용.
 * 도로명주소를 넣으면 정확한 좌표를 돌려줍니다.
 *
 * @param address - 도로명주소 (예: "서울특별시 강남구 테헤란로 123")
 * @returns { lat, lng } 또는 실패 시 한국 중심 좌표
 */
export async function getCoordFromAddress(address: string): Promise<{ lat: number; lng: number }> {
  await loadKakaoMapSdk()

  return new Promise((resolve) => {
    const geocoder = new kakao.maps.services.Geocoder()
    geocoder.addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result.length > 0) {
        resolve({
          lat: parseFloat(result[0].y),
          lng: parseFloat(result[0].x),
        })
      } else {
        // 실패 시 한국 중심 좌표 (폴백)
        resolve({ lat: 36.5, lng: 127.5 })
      }
    })
  })
}
