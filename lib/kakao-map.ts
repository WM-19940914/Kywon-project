/**
 * 카카오 지도 SDK 동적 로드 유틸리티
 *
 * 비유: "택배가 도착할 때까지 기다렸다가, 도착하면 알려주는 함수"
 * - 카카오 지도 스크립트를 <script> 태그로 삽입
 * - 완전히 로드되면 Promise를 resolve
 * - 이미 로드돼 있으면 바로 resolve (중복 로드 방지)
 */

let loadPromise: Promise<void> | null = null

/**
 * 카카오 지도 SDK 초기화 (layout.tsx에서 스크립트를 미리 로드)
 *
 * layout.tsx의 <Script> 태그로 SDK가 로드된 후,
 * kakao.maps.load()를 호출해서 초기화합니다.
 * 스크립트가 아직 안 들어왔으면 polling으로 기다립니다.
 */
export function loadKakaoMapSdk(): Promise<void> {
  // 이미 로드 중이거나 완료됐으면 같은 Promise 재사용
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    // 이미 초기화 완료된 경우
    if (typeof window !== 'undefined' && window.kakao?.maps?.Map) {
      resolve()
      return
    }

    // layout.tsx의 <Script>가 로드될 때까지 polling (최대 10초)
    let attempts = 0
    const maxAttempts = 50 // 200ms × 50 = 10초
    const check = () => {
      attempts++

      if (window.kakao?.maps?.load) {
        // SDK 스크립트 로드 완료 → maps.load()로 초기화
        window.kakao.maps.load(() => {
          resolve()
        })
      } else if (attempts >= maxAttempts) {
        // 타임아웃
        console.error('[카카오맵] SDK 로드 타임아웃 (10초)')
        loadPromise = null
        reject(new Error('카카오 지도 SDK 로드 시간 초과 — 브라우저 콘솔의 네트워크 탭을 확인하세요'))
      } else {
        // 아직 로드 안 됨 → 200ms 후 재시도
        setTimeout(check, 200)
      }
    }
    check()
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
