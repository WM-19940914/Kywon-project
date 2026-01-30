/**
 * 창고 관리 페이지 (리뉴얼)
 *
 * 장비를 보관하는 창고들을 관리하는 페이지입니다.
 * - 중앙에 한국 지도, 좌우에 창고 카드 배치
 * - 카드에서 인라인 편집 가능
 * - 검색/필터링 기능
 */

'use client'

import { useState, useRef, useCallback } from 'react'
import { mockWarehouses } from '@/lib/warehouse-data'
import type { Warehouse } from '@/types/warehouse'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Warehouse as WarehouseIcon,
  MapPin,
  User,
  Phone,
  Pencil,
  Check,
  X,
  Search,
  Trash2,
  Plus,
} from 'lucide-react'

// ─── 다음 우편번호 API ─────────────────────────────────────────

/** 다음 우편번호 API 스크립트 동적 로드 (무료, 키 불필요) */
function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).daum?.Postcode) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

/** 다음 우편번호 팝업 결과 타입 */
interface PostcodeResult {
  address: string
  sido: string
  sigungu: string
}

/** 주소 검색 팝업 열기 */
async function openAddressSearch(
  onComplete: (result: PostcodeResult) => void
) {
  await loadDaumPostcode()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (window as any).daum.Postcode({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oncomplete: (data: any) => {
      onComplete({
        address: data.roadAddress || data.jibunAddress,
        sido: data.sido,
        sigungu: data.sigungu,
      })
    },
  }).open()
}

// ─── 시/군/구 → 좌표 매핑 (지도 자동 배치용) ──────────────────

/**
 * 주요 시/군/구 좌표 테이블
 * 다음 우편번호 API의 sido, sigungu 값 기준
 */
const SIGUNGU_COORDS: Record<string, { lat: number; lng: number }> = {
  // 서울
  '서울특별시/강서구': { lat: 37.551, lng: 126.850 },
  '서울특별시/강남구': { lat: 37.517, lng: 127.047 },
  '서울특별시/종로구': { lat: 37.573, lng: 126.979 },
  '서울특별시/중구': { lat: 37.564, lng: 126.997 },
  '서울특별시/송파구': { lat: 37.515, lng: 127.106 },
  '서울특별시/마포구': { lat: 37.566, lng: 126.901 },
  // 경기
  '경기도/파주시': { lat: 37.760, lng: 126.780 },
  '경기도/평택시': { lat: 36.992, lng: 127.085 },
  '경기도/안성시': { lat: 37.008, lng: 127.270 },
  '경기도/수원시': { lat: 37.263, lng: 127.029 },
  '경기도/성남시': { lat: 37.420, lng: 127.126 },
  '경기도/용인시': { lat: 37.241, lng: 127.178 },
  '경기도/고양시': { lat: 37.658, lng: 126.832 },
  '경기도/연천군': { lat: 38.017, lng: 127.074 },
  '경기도/포천시': { lat: 37.895, lng: 127.200 },
  '경기도/양주시': { lat: 37.785, lng: 127.046 },
  '경기도/김포시': { lat: 37.615, lng: 126.716 },
  // 인천
  '인천광역시/서구': { lat: 37.545, lng: 126.676 },
  '인천광역시/남동구': { lat: 37.447, lng: 126.731 },
  // 강원
  '강원특별자치도/강릉시': { lat: 37.752, lng: 128.876 },
  '강원특별자치도/원주시': { lat: 37.342, lng: 127.920 },
  '강원특별자치도/춘천시': { lat: 37.881, lng: 127.730 },
  '강원특별자치도/속초시': { lat: 38.207, lng: 128.592 },
  '강원특별자치도/삼척시': { lat: 37.450, lng: 129.165 },
  '강원특별자치도/동해시': { lat: 37.525, lng: 129.114 },
  '강원특별자치도/태백시': { lat: 37.164, lng: 128.986 },
  '강원도/강릉시': { lat: 37.752, lng: 128.876 },
  '강원도/원주시': { lat: 37.342, lng: 127.920 },
  '강원도/춘천시': { lat: 37.881, lng: 127.730 },
  // 충남
  '충청남도/아산시': { lat: 36.789, lng: 127.002 },
  '충청남도/천안시': { lat: 36.815, lng: 127.114 },
  '충청남도/서산시': { lat: 36.785, lng: 126.450 },
  '충청남도/당진시': { lat: 36.890, lng: 126.630 },
  '충청남도/논산시': { lat: 36.187, lng: 127.099 },
  // 충북
  '충청북도/청주시': { lat: 36.642, lng: 127.489 },
  '충청북도/충주시': { lat: 36.991, lng: 127.926 },
  // 대전
  '대전광역시/중구': { lat: 36.325, lng: 127.421 },
  '대전광역시/서구': { lat: 36.355, lng: 127.384 },
  '대전광역시/유성구': { lat: 36.362, lng: 127.356 },
  // 세종
  '세종특별자치시/세종시': { lat: 36.480, lng: 127.260 },
  // 전북
  '전북특별자치도/전주시': { lat: 35.824, lng: 127.148 },
  '전북특별자치도/익산시': { lat: 35.948, lng: 126.958 },
  '전북특별자치도/군산시': { lat: 35.968, lng: 126.737 },
  '전라북도/전주시': { lat: 35.824, lng: 127.148 },
  '전라북도/익산시': { lat: 35.948, lng: 126.958 },
  // 광주
  '광주광역시/서구': { lat: 35.146, lng: 126.851 },
  '광주광역시/북구': { lat: 35.175, lng: 126.912 },
  '광주광역시/남구': { lat: 35.133, lng: 126.903 },
  // 전남
  '전라남도/순천시': { lat: 34.950, lng: 127.487 },
  '전라남도/여수시': { lat: 34.760, lng: 127.662 },
  '전라남도/목포시': { lat: 34.812, lng: 126.392 },
  '전라남도/광양시': { lat: 34.940, lng: 127.695 },
  // 경북
  '경상북도/경산시': { lat: 35.825, lng: 128.741 },
  '경상북도/포항시': { lat: 36.019, lng: 129.343 },
  '경상북도/구미시': { lat: 36.120, lng: 128.344 },
  '경상북도/경주시': { lat: 35.856, lng: 129.225 },
  '경상북도/안동시': { lat: 36.569, lng: 128.725 },
  // 대구
  '대구광역시/중구': { lat: 35.870, lng: 128.606 },
  '대구광역시/달서구': { lat: 35.830, lng: 128.533 },
  // 경남
  '경상남도/창원시': { lat: 35.228, lng: 128.682 },
  '경상남도/김해시': { lat: 35.229, lng: 128.889 },
  '경상남도/진주시': { lat: 35.180, lng: 128.108 },
  // 부산
  '부산광역시/해운대구': { lat: 35.163, lng: 129.164 },
  '부산광역시/사상구': { lat: 35.153, lng: 128.983 },
  // 울산
  '울산광역시/남구': { lat: 35.544, lng: 129.330 },
  // 제주
  '제주특별자치도/제주시': { lat: 33.500, lng: 126.531 },
  '제주특별자치도/서귀포시': { lat: 33.254, lng: 126.560 },
}

/** 시/도 단위 기본 좌표 (시/군/구 매핑이 없을 때 폴백) */
const SIDO_COORDS: Record<string, { lat: number; lng: number }> = {
  '서울특별시': { lat: 37.566, lng: 126.978 },
  '부산광역시': { lat: 35.180, lng: 129.076 },
  '대구광역시': { lat: 35.871, lng: 128.601 },
  '인천광역시': { lat: 37.456, lng: 126.705 },
  '광주광역시': { lat: 35.160, lng: 126.852 },
  '대전광역시': { lat: 36.350, lng: 127.385 },
  '울산광역시': { lat: 35.539, lng: 129.311 },
  '세종특별자치시': { lat: 36.480, lng: 127.260 },
  '경기도': { lat: 37.275, lng: 127.009 },
  '강원특별자치도': { lat: 37.822, lng: 128.156 },
  '강원도': { lat: 37.822, lng: 128.156 },
  '충청북도': { lat: 36.636, lng: 127.491 },
  '충청남도': { lat: 36.659, lng: 126.673 },
  '전북특별자치도': { lat: 35.820, lng: 127.150 },
  '전라북도': { lat: 35.820, lng: 127.150 },
  '전라남도': { lat: 34.816, lng: 126.463 },
  '경상북도': { lat: 36.576, lng: 128.506 },
  '경상남도': { lat: 35.461, lng: 128.213 },
  '제주특별자치도': { lat: 33.500, lng: 126.531 },
}

/**
 * 시/도 + 시/군/구 정보로 좌표를 반환
 * 시/군/구 매핑 → 시/도 매핑 → 기본값 순으로 폴백
 */
function getCoordFromRegion(
  sido: string,
  sigungu: string
): { lat: number; lng: number } {
  // 시/군/구에서 '시' '군' '구' 앞부분만 매칭 시도 (예: "해룡면" 같은 하위 제거)
  const sigunguKey = `${sido}/${sigungu.split(' ')[0]}`
  if (SIGUNGU_COORDS[sigunguKey]) return SIGUNGU_COORDS[sigunguKey]
  if (SIDO_COORDS[sido]) return SIDO_COORDS[sido]
  return { lat: 36.5, lng: 127.5 }
}

// ─── 지도 좌표 변환 ─────────────────────────────────────────────

/**
 * 위도/경도를 SVG 좌표로 변환
 * 해안선 실제 범위에 맞추고, 좌우 라벨 공간 확보
 */
function geoToSvg(
  lat: number,
  lng: number,
  width: number,
  height: number
): { x: number; y: number } {
  // 해안선 데이터 실제 범위에 맞춤
  const minLat = 33.3
  const maxLat = 38.5
  const minLng = 125.9
  const maxLng = 129.7

  // 좌우 라벨 공간 확보용 패딩
  const padLeft = 120
  const padRight = 120
  const padTop = 25
  const padBottom = 25

  const x = padLeft + ((lng - minLng) / (maxLng - minLng)) * (width - padLeft - padRight)
  const y = padTop + ((maxLat - lat) / (maxLat - minLat)) * (height - padTop - padBottom)

  return { x, y }
}

/**
 * 남한 해안선 좌표 (위도, 경도)
 * 서해안 DMZ 부근에서 시계방향으로 순회
 */
const SOUTH_KOREA_OUTLINE: [number, number][] = [
  // DMZ 서쪽 ~ 서해안 북부
  [37.76, 126.08],
  [37.72, 126.22],
  [37.63, 126.35],
  [37.58, 126.48],
  [37.52, 126.55],
  [37.46, 126.58],
  [37.38, 126.63],
  // 인천/경기 서해안
  [37.28, 126.58],
  [37.18, 126.62],
  [37.05, 126.68],
  [36.95, 126.62],
  // 충남 서해안
  [36.85, 126.50],
  [36.78, 126.42],
  [36.68, 126.38],
  [36.58, 126.48],
  [36.48, 126.52],
  [36.35, 126.55],
  // 전북 서해안
  [36.18, 126.52],
  [36.05, 126.55],
  [35.92, 126.48],
  [35.78, 126.42],
  // 전남 서해안
  [35.60, 126.38],
  [35.42, 126.42],
  [35.25, 126.38],
  [35.10, 126.32],
  [34.98, 126.38],
  // 전남 남서단
  [34.88, 126.48],
  [34.78, 126.58],
  [34.72, 126.72],
  // 남해안 서쪽
  [34.68, 126.92],
  [34.72, 127.10],
  [34.68, 127.28],
  [34.72, 127.48],
  // 여수/남해
  [34.78, 127.65],
  [34.82, 127.82],
  [34.88, 127.98],
  [34.95, 128.12],
  // 통영/거제
  [35.02, 128.38],
  [35.05, 128.55],
  [35.00, 128.72],
  [35.05, 128.88],
  // 부산
  [35.10, 129.02],
  [35.18, 129.08],
  // 동해안 남부
  [35.32, 129.18],
  [35.52, 129.35],
  [35.75, 129.48],
  // 동해안 중부
  [36.02, 129.52],
  [36.25, 129.48],
  [36.52, 129.42],
  [36.78, 129.38],
  // 동해안 북부
  [37.02, 129.38],
  [37.25, 129.28],
  [37.48, 129.18],
  [37.72, 128.98],
  [37.88, 128.82],
  // DMZ 동쪽
  [38.30, 128.55],
  [38.32, 128.40],
  // DMZ 라인 (서쪽으로)
  [38.28, 128.05],
  [38.18, 127.65],
  [38.05, 127.38],
  [37.95, 127.15],
  [37.88, 126.92],
  [37.82, 126.68],
  [37.80, 126.42],
  [37.76, 126.08],
]

/** 제주도 해안선 좌표 */
const JEJU_OUTLINE: [number, number][] = [
  [33.52, 126.18],
  [33.55, 126.32],
  [33.52, 126.48],
  [33.48, 126.62],
  [33.45, 126.78],
  [33.48, 126.88],
  [33.52, 126.95],
  [33.50, 126.82],
  [33.42, 126.72],
  [33.38, 126.58],
  [33.40, 126.42],
  [33.42, 126.28],
  [33.48, 126.18],
  [33.52, 126.18],
]

/**
 * 좌표 배열을 SVG path 문자열로 변환
 */
function coordsToPath(
  coords: [number, number][],
  w: number,
  h: number
): string {
  return coords
    .map((c, i) => {
      const { x, y } = geoToSvg(c[0], c[1], w, h)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ') + ' Z'
}

/**
 * 각 창고의 라벨 위치 오프셋 (겹침 방지용)
 * dx, dy: 마커에서 라벨까지의 오프셋
 * anchor: 텍스트 정렬 방향
 */
const LABEL_OFFSETS: Record<string, { dx: number; dy: number; anchor: string }> = {
  '1':  { dx: -90, dy: -5, anchor: 'end' },       // 파주창고 (경기 북서)
  '2':  { dx: -90, dy: 12, anchor: 'end' },       // 서울사무실 (서울 강서)
  '4':  { dx: 80, dy: 5, anchor: 'start' },       // 충청도창고 (대전)
  '5':  { dx: 80, dy: 0, anchor: 'start' },       // 전남창고 (순천)
  '6':  { dx: -90, dy: 0, anchor: 'end' },        // 전북창고 (광주)
  '7':  { dx: -90, dy: -12, anchor: 'end' },      // 안성창고 (평택 포승)
  '8':  { dx: 75, dy: -12, anchor: 'start' },     // 강원(강릉)
  '9':  { dx: 75, dy: 10, anchor: 'start' },      // 강원(원주)
  '10': { dx: 75, dy: -5, anchor: 'start' },      // 강원(춘천)
  '11': { dx: -90, dy: -15, anchor: 'end' },      // 강원(연천)
  '12': { dx: 80, dy: 10, anchor: 'start' },      // 경상도창고 (경산)
  '13': { dx: -90, dy: 5, anchor: 'end' },        // 아산창고
  '14': { dx: -90, dy: 15, anchor: 'end' },       // 평택창고
}

/**
 * 수동 오프셋이 없는 새 창고용 자동 라벨 배치
 * 지도 중심 기준 왼쪽/오른쪽으로 라벨을 뻗어줌
 */
function autoLabelOffset(
  x: number,
  y: number,
  mapWidth: number
): { dx: number; dy: number; anchor: string } {
  const center = mapWidth / 2
  if (x < center) {
    return { dx: -90, dy: 0, anchor: 'end' }
  }
  return { dx: 80, dy: 0, anchor: 'start' }
}

/**
 * 한국 지도 SVG 컴포넌트
 * 각 창고 마커에 이름 라벨과 연결선 표시
 */
function KoreaMap({
  warehouses,
  selectedId,
  onMarkerClick,
}: {
  warehouses: Warehouse[]
  selectedId: string | null
  onMarkerClick: (id: string) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const w = 780
  const h = 700

  const mainPath = coordsToPath(SOUTH_KOREA_OUTLINE, w, h)
  const jejuPath = coordsToPath(JEJU_OUTLINE, w, h)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      {/* 배경 */}
      <rect width={w} height={h} fill="#f0f9ff" rx="8" />

      {/* 바다 패턴 */}
      <defs>
        <pattern id="sea" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.5" fill="#bfdbfe" opacity="0.5" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#sea)" rx="8" />

      {/* 본토 */}
      <path d={mainPath} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />

      {/* 제주도 */}
      <path d={jejuPath} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />

      {/* 연결선 + 라벨 (마커 아래 레이어) */}
      {warehouses.map((wh) => {
        if (!wh.latitude || !wh.longitude) return null
        const { x, y } = geoToSvg(wh.latitude, wh.longitude, w, h)

        // 수동 오프셋이 있으면 사용, 없으면 자동 계산
        const offset = LABEL_OFFSETS[wh.id] || autoLabelOffset(x, y, w)
        const labelX = x + offset.dx
        const labelY = y + offset.dy
        const isSelected = selectedId === wh.id
        const isHovered = hoveredId === wh.id

        return (
          <g key={`label-${wh.id}`}>
            {/* 마커 → 라벨 연결선 */}
            <line
              x1={x} y1={y}
              x2={labelX} y2={labelY}
              stroke={isSelected ? '#2563eb' : isHovered ? '#60a5fa' : '#94a3b8'}
              strokeWidth={isSelected ? 1.5 : 0.8}
              strokeDasharray={isSelected ? 'none' : '3,2'}
              opacity={isSelected ? 1 : 0.6}
            />
            {/* 라벨 배경 */}
            <rect
              x={offset.anchor === 'end' ? labelX - 72 : labelX - 4}
              y={labelY - 11}
              width={76} height={16} rx={3}
              fill={isSelected ? '#2563eb' : isHovered ? '#1e293b' : 'white'}
              stroke={isSelected ? '#2563eb' : '#cbd5e1'}
              strokeWidth={0.8}
              opacity={isSelected ? 1 : isHovered ? 0.95 : 0.85}
            />
            {/* 라벨 텍스트 */}
            <text
              x={offset.anchor === 'end' ? labelX - 36 : labelX + 34}
              y={labelY + 1}
              textAnchor="middle"
              fill={isSelected || isHovered ? 'white' : '#334155'}
              fontSize="10"
              fontWeight={isSelected ? '600' : '500'}
            >
              {wh.name}
            </text>
          </g>
        )
      })}

      {/* 창고 마커 (라벨 위에 렌더링) */}
      {warehouses.map((wh) => {
        if (!wh.latitude || !wh.longitude) return null
        const { x, y } = geoToSvg(wh.latitude, wh.longitude, w, h)
        const isSelected = selectedId === wh.id
        const isHovered = hoveredId === wh.id
        const active = isSelected || isHovered

        return (
          <g
            key={wh.id}
            onClick={() => onMarkerClick(wh.id)}
            onMouseEnter={() => setHoveredId(wh.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="cursor-pointer"
          >
            {/* 펄스 애니메이션 (선택 시) */}
            {isSelected && (
              <circle cx={x} cy={y} r={20} fill="none" stroke="#3b82f6" strokeWidth="2" opacity="0.4">
                <animate attributeName="r" from="10" to="24" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}

            {/* 외곽 글로우 */}
            {active && (
              <circle
                cx={x} cy={y} r={14}
                fill={isSelected ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)'}
              />
            )}

            {/* 마커 원 (크게) */}
            <circle
              cx={x} cy={y}
              r={isSelected ? 9 : 7}
              fill={isSelected ? '#1d4ed8' : '#3b82f6'}
              stroke="white" strokeWidth="2.5"
            />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * 소형 창고 카드 컴포넌트 (인라인 편집 포함)
 */
function WarehouseCard({
  warehouse,
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
  cardRef,
}: {
  warehouse: Warehouse
  isSelected: boolean
  onUpdate: (updated: Warehouse) => void
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: warehouse.name,
    address: warehouse.address,
    addressDetail: warehouse.addressDetail || '',
    managerName: warehouse.managerName || '',
    managerPhone: warehouse.managerPhone || '',
    latitude: warehouse.latitude,
    longitude: warehouse.longitude,
  })

  const handleEdit = () => {
    setEditData({
      name: warehouse.name,
      address: warehouse.address,
      addressDetail: warehouse.addressDetail || '',
      managerName: warehouse.managerName || '',
      managerPhone: warehouse.managerPhone || '',
      latitude: warehouse.latitude,
      longitude: warehouse.longitude,
    })
    setIsEditing(true)
  }

  // 다음 주소 검색 팝업 호출
  const handleSearchAddress = () => {
    openAddressSearch((result) => {
      const coord = getCoordFromRegion(result.sido, result.sigungu)
      setEditData((prev) => ({
        ...prev,
        address: result.address,
        latitude: coord.lat,
        longitude: coord.lng,
      }))
    })
  }

  const handleSave = () => {
    onUpdate({
      ...warehouse,
      name: editData.name,
      address: editData.address,
      addressDetail: editData.addressDetail,
      managerName: editData.managerName,
      managerPhone: editData.managerPhone,
      latitude: editData.latitude,
      longitude: editData.longitude,
    })
    setIsEditing(false)
  }

  return (
    <div
      ref={cardRef}
      onClick={() => !isEditing && onSelect(warehouse.id)}
      className={`rounded-lg border bg-card p-3 transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-md bg-blue-50/30'
          : 'hover:shadow-sm hover:border-gray-300'
      }`}
    >
      {isEditing ? (
        /* 편집 모드 */
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <Input
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            className="h-7 text-sm" placeholder="창고명"
          />
          <div
            onClick={handleSearchAddress}
            className="flex items-center gap-1.5 h-7 px-2 rounded-md border text-sm cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
          >
            <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className={editData.address ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
              {editData.address || '주소 검색...'}
            </span>
          </div>
          <Input
            value={editData.addressDetail}
            onChange={(e) => setEditData({ ...editData, addressDetail: e.target.value })}
            className="h-7 text-sm" placeholder="상세주소 (동/호수 등)"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              value={editData.managerName}
              onChange={(e) => setEditData({ ...editData, managerName: e.target.value })}
              className="h-7 text-sm" placeholder="담당자"
            />
            <Input
              value={editData.managerPhone}
              onChange={(e) => setEditData({ ...editData, managerPhone: e.target.value })}
              className="h-7 text-sm" placeholder="연락처"
            />
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleSave} className="flex-1 h-7 text-xs">
              <Check className="h-3 w-3 mr-1" />저장
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="flex-1 h-7 text-xs">
              <X className="h-3 w-3 mr-1" />취소
            </Button>
          </div>
        </div>
      ) : (
        /* 보기 모드 */
        <>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {warehouse.name}
            </h3>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button
                size="sm" variant="ghost"
                onClick={(e) => { e.stopPropagation(); handleEdit() }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="sm" variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`"${warehouse.name}" 창고를 삭제하시겠습니까?`)) {
                    onDelete(warehouse.id)
                  }
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-1.5 mb-1.5">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <span className="text-xs text-gray-600 leading-tight line-clamp-2">
              {warehouse.address}{warehouse.addressDetail ? `, ${warehouse.addressDetail}` : ''}
            </span>
          </div>

          {warehouse.managerName && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {warehouse.managerName}
              </span>
              {warehouse.managerPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />
                  {warehouse.managerPhone}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * 창고 추가 카드 컴포넌트
 * 클릭하면 입력 폼이 열려 새 창고를 추가할 수 있습니다.
 */
function AddWarehouseCard({ onAdd }: { onAdd: (wh: Warehouse) => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    addressDetail: '',
    managerName: '',
    managerPhone: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  })

  // 다음 주소 검색 팝업 호출
  const handleSearchAddress = () => {
    openAddressSearch((result) => {
      const coord = getCoordFromRegion(result.sido, result.sigungu)
      setFormData((prev) => ({
        ...prev,
        address: result.address,
        latitude: coord.lat,
        longitude: coord.lng,
      }))
    })
  }

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.address.trim()) return
    onAdd({
      id: String(Date.now()),
      name: formData.name,
      address: formData.address,
      addressDetail: formData.addressDetail,
      managerName: formData.managerName,
      managerPhone: formData.managerPhone,
      latitude: formData.latitude,
      longitude: formData.longitude,
    })
    setFormData({ name: '', address: '', addressDetail: '', managerName: '', managerPhone: '', latitude: undefined, longitude: undefined })
    setIsAdding(false)
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
      >
        <Plus className="h-4 w-4" />
        창고 추가
      </button>
    )
  }

  return (
    <div className="rounded-lg border-2 border-blue-400 bg-blue-50/20 p-3">
      <div className="space-y-2">
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="h-7 text-sm" placeholder="창고명 *"
          autoFocus
        />
        <div
          onClick={handleSearchAddress}
          className="flex items-center gap-1.5 h-7 px-2 rounded-md border text-sm cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
        >
          <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className={formData.address ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
            {formData.address || '주소 검색 *'}
          </span>
        </div>
        <Input
          value={formData.addressDetail}
          onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
          className="h-7 text-sm" placeholder="상세주소 (동/호수 등)"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <Input
            value={formData.managerName}
            onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
            className="h-7 text-sm" placeholder="담당자"
          />
          <Input
            value={formData.managerPhone}
            onChange={(e) => setFormData({ ...formData, managerPhone: e.target.value })}
            className="h-7 text-sm" placeholder="연락처"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm" onClick={handleAdd}
            disabled={!formData.name.trim() || !formData.address.trim()}
            className="flex-1 h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />추가
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsAdding(false)} className="flex-1 h-7 text-xs">
            <X className="h-3 w-3 mr-1" />취소
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(mockWarehouses)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const cardElements = useRef<Record<string, HTMLDivElement | null>>({})

  // 검색 필터
  const filteredWarehouses = warehouses.filter(
    (wh) =>
      wh.name.includes(searchTerm) ||
      wh.address.includes(searchTerm) ||
      (wh.managerName || '').includes(searchTerm)
  )

  // 좌우 분할: 왼쪽/오른쪽 카드 배열
  const mid = Math.ceil(filteredWarehouses.length / 2)
  const leftCards = filteredWarehouses.slice(0, mid)
  const rightCards = filteredWarehouses.slice(mid)

  // 마커/카드 클릭 시 선택 + 스크롤
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    const el = cardElements.current[id]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // 창고 정보 업데이트
  const handleUpdate = useCallback((updated: Warehouse) => {
    setWarehouses((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    )
  }, [])

  // 창고 삭제
  const handleDelete = useCallback((id: string) => {
    setWarehouses((prev) => prev.filter((w) => w.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  // 창고 추가
  const handleAdd = useCallback((wh: Warehouse) => {
    setWarehouses((prev) => [...prev, wh])
  }, [])

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 + 검색 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <WarehouseIcon className="h-6 w-6" />
              창고 관리
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredWarehouses.length}개 창고
            </p>
          </div>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="창고명, 주소, 담당자명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </div>

      {/* 메인 3컬럼 레이아웃: 카드 | 지도 | 카드 */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* 왼쪽 카드 */}
        <div className="space-y-3">
          {leftCards.map((wh) => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              isSelected={selectedId === wh.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSelect={handleSelect}
              cardRef={(el) => { cardElements.current[wh.id] = el }}
            />
          ))}
          <AddWarehouseCard onAdd={handleAdd} />
        </div>

        {/* 중앙 지도 */}
        <div className="w-[780px] sticky top-4">
          <Card className="overflow-hidden">
            <CardContent className="p-2">
              <KoreaMap
                warehouses={filteredWarehouses}
                selectedId={selectedId}
                onMarkerClick={handleSelect}
              />
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽 카드 */}
        <div className="space-y-3">
          {rightCards.map((wh) => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              isSelected={selectedId === wh.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSelect={handleSelect}
              cardRef={(el) => { cardElements.current[wh.id] = el }}
            />
          ))}
          <AddWarehouseCard onAdd={handleAdd} />
        </div>
      </div>

      {/* 모바일/태블릿: 지도 위 + 카드 그리드 아래 */}
      <div className="lg:hidden">
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-2">
            <div className="max-w-[600px] mx-auto">
              <KoreaMap
                warehouses={filteredWarehouses}
                selectedId={selectedId}
                onMarkerClick={handleSelect}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredWarehouses.map((wh) => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              isSelected={selectedId === wh.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSelect={handleSelect}
              cardRef={(el) => { cardElements.current[wh.id] = el }}
            />
          ))}
          <AddWarehouseCard onAdd={handleAdd} />
        </div>
      </div>
    </div>
  )
}
