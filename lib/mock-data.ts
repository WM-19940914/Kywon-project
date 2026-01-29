/**
 * 테스트용 더미 데이터 (조직/진행상태 중심)
 *
 * 실제 데이터베이스 연결 전에 화면을 미리 보기 위한 가짜 데이터입니다.
 * 나중에 Supabase 연결하면 이 파일은 삭제해도 돼요!
 */

import type { Order } from '@/types/order'

export const mockOrders: Order[] = [
  // 1. 접수중 - 구몬 화곡지국 (긴 이름 테스트!)
  {
    id: '1',
    documentNumber: 'DOC-2024-001',
    address: '서울시 강서구 화곡로 123',
    orderDate: '2024-01-15',
    orderNumber: 'ORD-20240115-001',
    affiliate: 'Wells 영업',
    businessName: 'Wells 영업 센트럴파크시티역 화교빌딩 센트럴파크지점',
    status: 'received',
    items: [
      {
        id: '1-1',
        workType: '신규설치',
        category: '시스템에어컨',
        model: 'AR-123',
        size: '18평',
        quantity: 2
      },
      {
        id: '1-2',
        workType: '철거폐기',
        category: '벽걸이에어컨',
        model: 'OLD-001',
        size: '9평',
        quantity: 1
      }
    ],
    notes: '주말 시공 요청. 오전 10시 이후 작업 가능',
    createdAt: '2024-01-15T09:00:00Z'
  },

  // 2. 진행중 - Wells 영업 춘천지사
  {
    id: '2',
    documentNumber: 'DOC-2024-002',
    address: '강원도 춘천시 중앙로 456',
    orderDate: '2024-01-16',
    orderNumber: 'ORD-20240116-001',
    affiliate: 'Wells 영업',
    businessName: 'Wells 영업 춘천지사',
    status: 'in-progress',
    items: [
      {
        id: '2-1',
        workType: '신규설치',
        category: '천장형에어컨',
        model: 'AR-456',
        size: '24평',
        quantity: 3
      }
    ],
    notes: '층고 3.5m, 사다리차 필요',
    createdAt: '2024-01-16T10:30:00Z'
  },

  // 3. 진행중 - 교육플랫폼 본사
  {
    id: '3',
    documentNumber: 'DOC-2024-003',
    address: '경기도 성남시 분당구 판교역로 789',
    orderDate: '2024-01-17',
    orderNumber: 'ORD-20240117-001',
    affiliate: '교육플랫폼',
    businessName: '교육플랫폼 본사',
    status: 'in-progress',
    items: [
      {
        id: '3-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AR-789',
        size: '12평',
        quantity: 5
      }
    ],
    notes: '사무실 전체 교체',
    createdAt: '2024-01-17T14:20:00Z'
  },

  // 4. 완료 (정산대기) - Wells 서비스 인천센터
  {
    id: '4',
    documentNumber: 'DOC-2024-004',
    address: '인천시 연수구 송도국제대로 321',
    orderDate: '2024-01-18',
    orderNumber: 'ORD-20240118-001',
    affiliate: 'Wells 서비스',
    businessName: 'Wells 서비스 인천센터',
    status: 'completed',
    items: [
      {
        id: '4-1',
        workType: '신규설치',
        category: '벽걸이에어컨',
        model: 'AR-321',
        size: '9평',
        quantity: 4
      }
    ],
    notes: '신축 건물, 배관 작업 완료됨',
    createdAt: '2024-01-18T11:15:00Z',
    completionDate: '2024-01-22',
    settlementMonth: '2024-01'
  },

  // 5. 정산완료 - 구몬 마포지국
  {
    id: '5',
    documentNumber: 'DOC-2024-005',
    address: '서울시 마포구 상암동 654',
    orderDate: '2024-01-10',
    orderNumber: 'ORD-20240110-001',
    affiliate: '구몬',
    businessName: '구몬 마포지국',
    status: 'settled',
    items: [
      {
        id: '5-1',
        workType: '신규설치',
        category: '시스템에어컨',
        model: 'AR-654',
        size: '30평',
        quantity: 1
      },
      {
        id: '5-2',
        workType: '철거보관',
        category: '시스템에어컨',
        model: 'OLD-002',
        size: '30평',
        quantity: 1
      }
    ],
    notes: '펜트하우스, 실외기 옥상 설치',
    createdAt: '2024-01-10T09:45:00Z',
    completionDate: '2024-01-20',
    settlementDate: '2024-01-25',
    settlementMonth: '2024-01',
    quoteAmount: 3200000,
    actualCost: 3280000
  },

  // 6. 접수중 - 기타 대한냉난방
  {
    id: '6',
    documentNumber: 'DOC-2024-006',
    address: '경기도 고양시 일산동구 중앙로 987',
    orderDate: '2024-01-20',
    orderNumber: 'ORD-20240120-001',
    affiliate: '기타',
    businessName: '대한냉난방',
    status: 'received',
    items: [
      {
        id: '6-1',
        workType: '이전설치',
        category: '벽걸이에어컨',
        model: 'AR-987',
        size: '9평',
        quantity: 3
      }
    ],
    notes: '기존 에어컨 철거 후 설치',
    createdAt: '2024-01-20T16:00:00Z'
  },

  // 7. 진행중 - 구몬 송파지국
  {
    id: '7',
    documentNumber: 'DOC-2024-007',
    address: '서울시 송파구 올림픽로 147, 상가 1층',
    orderDate: '2024-01-21',
    orderNumber: 'ORD-20240121-001',
    affiliate: '구몬',
    businessName: '구몬 송파지국',
    status: 'in-progress',
    items: [
      {
        id: '7-1',
        workType: '신규설치',
        category: '천장형에어컨',
        model: 'AR-147',
        size: '36평',
        quantity: 2
      }
    ],
    notes: '영업시간 외 작업 필수 (저녁 8시 이후)',
    createdAt: '2024-01-21T13:30:00Z'
  },

  // 8. 완료 (정산대기) - Wells 영업 수원지사
  {
    id: '8',
    documentNumber: 'DOC-2024-008',
    address: '경기도 수원시 영통구 광교중앙로 258',
    orderDate: '2024-01-12',
    orderNumber: 'ORD-20240112-001',
    affiliate: 'Wells 영업',
    businessName: 'Wells 영업 수원지사',
    status: 'completed',
    items: [
      {
        id: '8-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AR-258',
        size: '12평',
        quantity: 2
      }
    ],
    notes: '친환경 모델, 정부 보조금 대상',
    createdAt: '2024-01-12T10:00:00Z',
    completionDate: '2024-01-26',
    settlementMonth: '2024-01'
  },

  // 9. 진행중 - 교육플랫폼 강서지사
  {
    id: '9',
    documentNumber: 'DOC-2024-009',
    address: '서울시 강서구 공항대로 369',
    orderDate: '2024-01-23',
    orderNumber: 'ORD-20240123-001',
    affiliate: '교육플랫폼',
    businessName: '교육플랫폼 강서지사',
    status: 'in-progress',
    items: [
      {
        id: '9-1',
        workType: '신규설치',
        category: '벽걸이에어컨',
        model: 'AR-369',
        size: '6평',
        quantity: 1
      }
    ],
    notes: '원룸형, 간단 설치',
    createdAt: '2024-01-23T15:20:00Z'
  },

  // 10. 정산완료 - Wells 서비스 여의도센터
  {
    id: '10',
    documentNumber: 'DOC-2024-010',
    address: '서울시 영등포구 여의도동 753, 오피스 빌딩 12층',
    orderDate: '2024-01-08',
    orderNumber: 'ORD-20240108-001',
    affiliate: 'Wells 서비스',
    businessName: 'Wells 서비스 여의도센터',
    status: 'settled',
    items: [
      {
        id: '10-1',
        workType: '신규설치',
        category: '시스템에어컨',
        model: 'AR-753',
        size: '48평',
        quantity: 1
      },
      {
        id: '10-2',
        workType: '신규설치',
        category: '천장형에어컨',
        model: 'AR-754',
        size: '18평',
        quantity: 3
      }
    ],
    notes: '사무실용 대형, 시스템 에어컨',
    createdAt: '2024-01-08T08:30:00Z',
    completionDate: '2024-01-18',
    settlementDate: '2024-01-24',
    settlementMonth: '2024-01',
    quoteAmount: 5800000,
    actualCost: 5750000
  },

  // 11. 정산완료 - 구몬 강남지국 (작년 12월)
  {
    id: '11',
    documentNumber: 'DOC-2023-099',
    address: '서울시 강남구 테헤란로 427, 위워크 2층',
    orderDate: '2023-12-15',
    orderNumber: 'ORD-20231215-001',
    affiliate: '구몬',
    businessName: '구몬 강남지국',
    status: 'settled',
    items: [
      {
        id: '11-1',
        workType: '신규설치',
        category: '벽걸이에어컨',
        model: 'AR-427',
        size: '12평',
        quantity: 3
      }
    ],
    notes: '공유 오피스, 3개 룸',
    createdAt: '2023-12-15T09:00:00Z',
    completionDate: '2023-12-22',
    settlementDate: '2023-12-28',
    settlementMonth: '2023-12',
    quoteAmount: 2400000,
    actualCost: 2350000
  },

  // 12. 정산완료 - 교육플랫폼 분당지사 (작년 12월)
  {
    id: '12',
    documentNumber: 'DOC-2023-098',
    address: '경기도 성남시 분당구 정자일로 95',
    orderDate: '2023-12-10',
    orderNumber: 'ORD-20231210-001',
    affiliate: '교육플랫폼',
    businessName: '교육플랫폼 분당지사',
    status: 'settled',
    items: [
      {
        id: '12-1',
        workType: '이전설치',
        category: '스탠드에어컨',
        model: 'AR-095',
        size: '9평',
        quantity: 2
      }
    ],
    notes: '층간 이동 작업',
    createdAt: '2023-12-10T14:00:00Z',
    completionDate: '2023-12-18',
    settlementDate: '2023-12-26',
    settlementMonth: '2023-12',
    quoteAmount: 800000,
    actualCost: 820000
  },

  // 13. 정산완료 - Wells 영업 부산지사 (작년 11월)
  {
    id: '13',
    documentNumber: 'DOC-2023-085',
    address: '부산시 해운대구 센텀중앙로 78',
    orderDate: '2023-11-20',
    orderNumber: 'ORD-20231120-001',
    affiliate: 'Wells 영업',
    businessName: 'Wells 영업 부산지사',
    status: 'settled',
    items: [
      {
        id: '13-1',
        workType: '신규설치',
        category: '천장형에어컨',
        model: 'AR-078',
        size: '24평',
        quantity: 2
      },
      {
        id: '13-2',
        workType: '철거폐기',
        category: '천장형에어컨',
        model: 'OLD-003',
        size: '24평',
        quantity: 2
      }
    ],
    notes: '기존 장비 전부 철거 후 교체',
    createdAt: '2023-11-20T10:30:00Z',
    completionDate: '2023-11-28',
    settlementDate: '2023-11-30',
    settlementMonth: '2023-11',
    quoteAmount: 4200000,
    actualCost: 4180000
  }
]
