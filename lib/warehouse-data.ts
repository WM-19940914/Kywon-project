/**
 * 창고 더미 데이터
 *
 * 실제 데이터베이스 연결 전에 테스트용으로 사용하는 창고 데이터입니다.
 */

import type { Warehouse } from '@/types/warehouse'

export const mockWarehouses: Warehouse[] = [
  // 1. 파주 창고
  {
    id: '1',
    name: '파주 창고',
    address: '경기도 파주시 문산읍 당동리 123-45',
    managerName: '김철수',
    managerPhone: '010-1234-5678',
    capacity: 500,
    currentStock: 320,
    notes: '주차 공간 넉넉함. 지게차 2대 보유',
    createdAt: '2024-01-01T09:00:00Z'
  },

  // 2. 강원도 창고
  {
    id: '2',
    name: '강원도 창고',
    address: '강원도 원주시 지정면 간현로 567-8',
    managerName: '박영희',
    managerPhone: '010-2345-6789',
    capacity: 300,
    currentStock: 180,
    notes: '산간 지역. 겨울철 제설 필요',
    createdAt: '2024-01-01T09:00:00Z'
  },

  // 3. 대전 창고
  {
    id: '3',
    name: '대전 창고',
    address: '대전광역시 유성구 테크노2로 234',
    managerName: '이민수',
    managerPhone: '010-3456-7890',
    capacity: 400,
    currentStock: 250,
    notes: '물류센터 인근. 고속도로 진입 용이',
    createdAt: '2024-01-01T09:00:00Z'
  }
]
