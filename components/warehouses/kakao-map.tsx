/**
 * 카카오 지도 기반 창고 위치 표시 컴포넌트
 *
 * 기존 SVG KoreaMap을 대체합니다.
 * - 실제 카카오 지도 위에 창고 마커 + 라벨 표시
 * - 마커 클릭 → 카드 스크롤 (onMarkerClick 콜백)
 * - 카드 클릭 → 지도 이동 (selectedId prop)
 * - 모든 마커가 보이게 자동 범위 조정
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { loadKakaoMapSdk } from '@/lib/kakao-map'
import type { Warehouse } from '@/types/warehouse'

interface KakaoMapProps {
  /** 표시할 창고 목록 */
  warehouses: Warehouse[]
  /** 현재 선택된 창고 ID */
  selectedId: string | null
  /** 마커 클릭 시 호출되는 콜백 */
  onMarkerClick: (id: string) => void
}

/**
 * 라벨 HTML 생성 (마커 위에 표시되는 창고명 뱃지)
 *
 * @param wh - 창고 정보
 * @param isSelected - 선택 여부 (선택되면 파란색 배경)
 */
function createLabelHtml(wh: Warehouse, isSelected: boolean): string {
  const bg = isSelected ? '#2563eb' : 'white'
  const color = isSelected ? 'white' : '#334155'
  const border = isSelected ? '#2563eb' : '#cbd5e1'
  const weight = isSelected ? '700' : '500'
  const shadow = isSelected ? '0 2px 8px rgba(37,99,235,0.3)' : '0 1px 3px rgba(0,0,0,0.1)'
  const label = wh.managerName ? `${wh.name}_${wh.managerName}` : wh.name

  return `
    <div
      style="
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: ${weight};
        color: ${color};
        background: ${bg};
        border: 1px solid ${border};
        box-shadow: ${shadow};
        white-space: nowrap;
        cursor: pointer;
        transform: translateY(-8px);
      "
      onclick="window.__kakaoMarkerClick && window.__kakaoMarkerClick('${wh.id}')"
    >${label}</div>
  `
}

export default function KakaoMap({ warehouses, selectedId, onMarkerClick }: KakaoMapProps) {
  /** 지도 컨테이너 div 참조 */
  const mapContainerRef = useRef<HTMLDivElement>(null)
  /** 카카오 Map 인스턴스 */
  const mapRef = useRef<kakao.maps.Map | null>(null)
  /** 창고 ID → 마커 객체 매핑 */
  const markersRef = useRef<Record<string, kakao.maps.Marker>>({})
  /** 창고 ID → 라벨 오버레이 객체 매핑 */
  const overlaysRef = useRef<Record<string, kakao.maps.CustomOverlay>>({})
  /** SDK 로드 완료 여부 */
  const sdkLoadedRef = useRef(false)

  /** 로딩/에러 상태 (화면에 표시용) */
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  /** onMarkerClick을 안정적으로 참조 (리렌더링 시 함수 참조 변경 방지) */
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  /**
   * 전역 콜백 등록 (카카오 오버레이 클릭 → React 콜백)
   *
   * 카카오 CustomOverlay의 content는 순수 HTML 문자열이라
   * React 이벤트를 직접 바인딩할 수 없어서 window에 전역 함수를 등록합니다.
   */
  useEffect(() => {
    window.__kakaoMarkerClick = (id: string) => {
      onMarkerClickRef.current(id)
    }
    return () => {
      delete window.__kakaoMarkerClick
    }
  }, [])

  /**
   * SDK 로드 + 지도 초기화 (최초 1회만)
   */
  useEffect(() => {
    setMapStatus('loading')
    loadKakaoMapSdk().then(() => {
      if (!mapContainerRef.current || mapRef.current) return
      sdkLoadedRef.current = true

      const map = new kakao.maps.Map(mapContainerRef.current, {
        center: new kakao.maps.LatLng(36.0, 127.5), // 한국 중심
        level: 13, // 전국이 보이는 줌 레벨
        mapTypeId: kakao.maps.MapTypeId.ROADMAP, // 기본 도로 지도
        disableDoubleClickZoom: true, // 더블클릭 줌 비활성화
      })

      mapRef.current = map
      setMapStatus('ready')
    }).catch((err) => {
      console.error('카카오 지도 로드 실패:', err)
      setErrorMsg(err?.message || '알 수 없는 오류')
      setMapStatus('error')
    })
  }, [])

  /**
   * 마커 업데이트 함수
   * warehouses 데이터가 바뀔 때 호출
   */
  const updateMarkers = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    // 1. 기존 마커/오버레이 전부 제거
    Object.values(markersRef.current).forEach(m => m.setMap(null))
    Object.values(overlaysRef.current).forEach(o => o.setMap(null))
    markersRef.current = {}
    overlaysRef.current = {}

    // 좌표가 있는 창고만 필터
    const validWarehouses = warehouses.filter(wh => wh.latitude && wh.longitude)
    if (validWarehouses.length === 0) return

    const bounds = new kakao.maps.LatLngBounds()

    // 2. 각 창고마다 마커 + 라벨 오버레이 생성
    validWarehouses.forEach(wh => {
      const position = new kakao.maps.LatLng(wh.latitude!, wh.longitude!)
      bounds.extend(position)

      // 마커 생성
      const marker = new kakao.maps.Marker({
        position,
        map,
        clickable: true,
      })

      // 마커 클릭 이벤트
      kakao.maps.event.addListener(marker, 'click', () => {
        onMarkerClickRef.current(wh.id)
      })

      // 라벨 오버레이 (창고명_담당자명)
      const isSelected = wh.id === selectedId
      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: createLabelHtml(wh, isSelected),
        yAnchor: 2.2, // 마커 위에 표시
        clickable: true,
      })
      overlay.setMap(map)

      markersRef.current[wh.id] = marker
      overlaysRef.current[wh.id] = overlay
    })

    // 3. 모든 마커가 보이도록 범위 자동 조정
    map.setBounds(bounds)
  }, [warehouses, selectedId])

  /**
   * warehouses가 바뀌면 마커 재생성
   * (SDK 로드 후 약간 딜레이를 두고 실행)
   */
  useEffect(() => {
    if (!sdkLoadedRef.current) {
      // SDK 로드 기다리기 (최초 로드 시)
      const timer = setTimeout(() => {
        updateMarkers()
      }, 800)
      return () => clearTimeout(timer)
    }
    updateMarkers()
  }, [updateMarkers])

  /**
   * selectedId 변경 → 라벨 스타일 업데이트 + 지도 이동
   */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // 모든 오버레이의 라벨 스타일 업데이트
    warehouses.forEach(wh => {
      const overlay = overlaysRef.current[wh.id]
      if (overlay) {
        overlay.setContent(createLabelHtml(wh, wh.id === selectedId))
      }
    })

    // 선택된 마커 위치로 부드럽게 이동
    if (selectedId && markersRef.current[selectedId]) {
      map.panTo(markersRef.current[selectedId].getPosition())
    }
  }, [selectedId, warehouses])

  return (
    <div style={{ position: 'relative', width: '100%', height: '700px' }}>
      {/* 카카오 지도 컨테이너 */}
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
        className="rounded-lg"
      />

      {/* 로딩 중일 때 표시 */}
      {mapStatus === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f9ff',
            borderRadius: '8px',
          }}
        >
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>카카오 지도 로딩 중...</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>잠시만 기다려주세요</div>
          </div>
        </div>
      )}

      {/* 에러 발생 시 표시 */}
      {mapStatus === 'error' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fef2f2',
            borderRadius: '8px',
          }}
        >
          <div style={{ textAlign: 'center', color: '#dc2626' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>카카오 지도 로드 실패</div>
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#9ca3af' }}>{errorMsg}</div>
            <div style={{ fontSize: '11px', marginTop: '8px', color: '#6b7280' }}>
              카카오 개발자센터 → 앱 → 플랫폼 → Web에<br/>
              http://localhost:3002 이 등록되었는지 확인하세요
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
