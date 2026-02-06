/**
 * 카카오 지도 SDK TypeScript 타입 선언
 *
 * 카카오 지도는 JavaScript 라이브러리라서
 * TypeScript가 "kakao가 뭐야?" 하고 에러를 냅니다.
 * 이 파일이 "kakao는 이런 모양이야" 하고 알려주는 설명서입니다.
 */

declare global {
  interface Window {
    kakao: typeof kakao
    /** 카카오 오버레이 클릭 → React 콜백 연결용 전역 함수 */
    __kakaoMarkerClick?: (id: string) => void
  }

  namespace kakao.maps {
    /** 지도 생성 */
    class Map {
      constructor(container: HTMLElement, options: MapOptions)
      setCenter(latlng: LatLng): void
      setLevel(level: number): void
      getLevel(): number
      panTo(latlng: LatLng): void
      setBounds(bounds: LatLngBounds): void
      relayout(): void
    }

    interface MapOptions {
      center: LatLng
      level?: number
    }

    /** 위도/경도 좌표 */
    class LatLng {
      constructor(lat: number, lng: number)
      getLat(): number
      getLng(): number
    }

    /** 좌표 영역 (모든 마커가 보이게 범위 조정할 때 사용) */
    class LatLngBounds {
      constructor()
      extend(latlng: LatLng): void
    }

    /** 지도 마커 */
    class Marker {
      constructor(options: MarkerOptions)
      setMap(map: Map | null): void
      setPosition(position: LatLng): void
      setImage(image: MarkerImage): void
      getPosition(): LatLng
    }

    interface MarkerOptions {
      position: LatLng
      map?: Map
      image?: MarkerImage
      clickable?: boolean
    }

    /** 마커 이미지 커스텀 */
    class MarkerImage {
      constructor(src: string, size: Size, options?: MarkerImageOptions)
    }

    interface MarkerImageOptions {
      offset?: Point
    }

    class Size {
      constructor(width: number, height: number)
    }

    class Point {
      constructor(x: number, y: number)
    }

    /** 커스텀 오버레이 (마커 위에 라벨 표시용) */
    class CustomOverlay {
      constructor(options: CustomOverlayOptions)
      setMap(map: Map | null): void
      setContent(content: string | HTMLElement): void
      setPosition(position: LatLng): void
    }

    interface CustomOverlayOptions {
      position: LatLng
      content: string | HTMLElement
      map?: Map
      yAnchor?: number
      xAnchor?: number
      clickable?: boolean
    }

    /** 이벤트 */
    namespace event {
      function addListener(target: Marker | Map, type: string, handler: Function): void
      function removeListener(target: Marker | Map, type: string, handler: Function): void
    }

    /** SDK 수동 로드 (autoload=false일 때) */
    function load(callback: () => void): void

    /** 주소 → 좌표 변환 등 서비스 */
    namespace services {
      class Geocoder {
        addressSearch(
          address: string,
          callback: (result: GeocoderResult[], status: Status) => void
        ): void
      }

      interface GeocoderResult {
        x: string  // 경도 (longitude)
        y: string  // 위도 (latitude)
        address_name: string
      }

      enum Status {
        OK = 'OK',
        ZERO_RESULT = 'ZERO_RESULT',
        ERROR = 'ERROR',
      }
    }
  }
}

export {}
