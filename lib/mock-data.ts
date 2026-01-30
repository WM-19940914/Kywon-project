/**
 * 테스트용 더미 데이터 (조직/진행상태 중심)
 *
 * 실제 데이터베이스 연결 전에 화면을 미리 보기 위한 가짜 데이터입니다.
 * 나중에 Supabase 연결하면 이 파일은 삭제해도 돼요!
 *
 * 장비 구성품은 연간 단가표(price-table.ts)의 SET 모델명 기준으로 작성되었습니다.
 * 각 구성품은 개별 주문번호(orderNumber)를 가지며, 매입처(supplier)는 기본 삼성전자입니다.
 */

import type { Order } from '@/types/order'

/**
 * 오늘 기준 상대 날짜 생성 헬퍼
 * @param offset - 오늘로부터의 일수 차이 (양수: 미래, 음수: 과거)
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 */
function relativeDate(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const mockOrders: Order[] = [
  // ──────────────────────────────────────────────────────
  // 1. 접수중 - Wells 영업 센트럴파크 (배송지연)
  //    SET: AP072BAPPBH2S (스탠드 18평) × 2대
  // ──────────────────────────────────────────────────────
  {
    id: '1',
    documentNumber: 'DOC-2024-001',
    address: '서울시 강서구 화곡로 123',
    orderDate: relativeDate(-10),
    affiliate: 'Wells 영업',
    businessName: 'Wells 영업 센트럴파크시티역 화교빌딩 센트럴파크지점',
    contactName: '김영희',
    contactPhone: '010-1234-5678',
    status: 'received',
    items: [
      {
        id: '1-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP072BAPPBH2S',
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
    createdAt: relativeDate(-10) + 'T09:00:00Z',
    deliveryStatus: 'in-transit',
    requestedDeliveryDate: relativeDate(-2),
    samsungOrderNumber: 'SO-2026-001',
    equipmentItems: [
      // SET 1: AP072BAPPBH2S (18평 스탠드) - 1번째
      {
        id: 'eq-1-1',
        setModel: 'AP072BAPPBH2S',
        componentName: '실외기',
        componentModel: 'AC072BXAPBH5',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-001',
        orderDate: relativeDate(-10),
        requestedDeliveryDate: relativeDate(-2),
        quantity: 1,
        unitPrice: 728857,
        totalPrice: 728857,
        warehouseId: '1',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-1-2',
        setModel: 'AP072BAPPBH2S',
        componentName: '실내기',
        componentModel: 'AP072BNPPBH1',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-001',
        orderDate: relativeDate(-10),
        requestedDeliveryDate: relativeDate(-2),
        quantity: 1,
        unitPrice: 417457,
        totalPrice: 417457,
        warehouseId: '1',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-1-3',
        setModel: 'AP072BAPPBH2S',
        componentName: '자재박스',
        componentModel: 'FPH-1458XS1',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-001',
        orderDate: relativeDate(-10),
        requestedDeliveryDate: relativeDate(-2),
        quantity: 1,
        unitPrice: 71286,
        totalPrice: 71286,
        warehouseId: '1',
        deliveryStatus: 'in-transit'
      },
      // SET 2: AP072BAPPBH2S (18평 스탠드) - 2번째 (주문번호 다름!)
      {
        id: 'eq-1-4',
        setModel: 'AP072BAPPBH2S',
        componentName: '실외기',
        componentModel: 'AC072BXAPBH5',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-001-2',
        orderDate: relativeDate(-10),
        requestedDeliveryDate: relativeDate(-2),
        quantity: 1,
        unitPrice: 728857,
        totalPrice: 728857,
        warehouseId: '1',
        deliveryStatus: 'pending'
      },
      {
        id: 'eq-1-5',
        setModel: 'AP072BAPPBH2S',
        componentName: '실내기',
        componentModel: 'AP072BNPPBH1',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-001-2',
        orderDate: relativeDate(-10),
        quantity: 1,
        unitPrice: 417457,
        totalPrice: 417457,
        warehouseId: '1',
        deliveryStatus: 'pending'
      },
      {
        id: 'eq-1-6',
        setModel: 'AP072BAPPBH2S',
        componentName: '자재박스',
        componentModel: 'FPH-1458XS1',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-001-2',
        orderDate: relativeDate(-10),
        quantity: 1,
        unitPrice: 71286,
        totalPrice: 71286,
        warehouseId: '1',
        deliveryStatus: 'pending'
      }
    ]
  },

  // ──────────────────────────────────────────────────────
  // 2. 진행중 - Wells 영업 춘천지사 (오늘 입고 예정)
  //    SET: AP083BAPPBH2S (스탠드 23평) × 3대
  // ──────────────────────────────────────────────────────
  {
    id: '2',
    documentNumber: 'DOC-2024-002',
    address: '강원도 춘천시 중앙로 456',
    orderDate: relativeDate(-14),
    affiliate: 'Wells 영업',
    businessName: 'Wells 영업 춘천지사',
    contactName: '박민수',
    contactPhone: '010-2345-6789',
    status: 'in-progress',
    items: [
      {
        id: '2-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP083BAPPBH2S',
        size: '23평',
        quantity: 3
      }
    ],
    notes: '층고 3.5m, 사다리차 필요',
    createdAt: relativeDate(-14) + 'T10:30:00Z',
    deliveryStatus: 'in-transit',
    requestedDeliveryDate: relativeDate(0),
    confirmedDeliveryDate: relativeDate(0),
    samsungOrderNumber: 'SO-2026-002',
    equipmentItems: [
      {
        id: 'eq-2-1',
        setModel: 'AP083BAPPBH2S',
        componentName: '실외기',
        componentModel: 'AP083BXPPBH3',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-002',
        orderDate: relativeDate(-14),
        requestedDeliveryDate: relativeDate(0),
        confirmedDeliveryDate: relativeDate(0),
        quantity: 3,
        unitPrice: 744621,
        totalPrice: 2233863,
        warehouseId: '2',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-2-2',
        setModel: 'AP083BAPPBH2S',
        componentName: '실내기',
        componentModel: 'AP083BNPPBH1',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-002',
        orderDate: relativeDate(-14),
        requestedDeliveryDate: relativeDate(0),
        confirmedDeliveryDate: relativeDate(0),
        quantity: 3,
        unitPrice: 462568,
        totalPrice: 1387704,
        warehouseId: '2',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-2-3',
        setModel: 'AP083BAPPBH2S',
        componentName: '자재박스',
        componentModel: 'FPH-3858XS5',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-002',
        orderDate: relativeDate(-14),
        requestedDeliveryDate: relativeDate(0),
        confirmedDeliveryDate: relativeDate(0),
        quantity: 3,
        unitPrice: 116411,
        totalPrice: 349233,
        warehouseId: '2',
        deliveryStatus: 'in-transit'
      }
    ]
  },

  // ──────────────────────────────────────────────────────
  // 3. 진행중 - 교육플랫폼 본사 (오늘 입고 예정)
  //    SET: AP052BAPPBH2S (스탠드 13평) × 5대
  // ──────────────────────────────────────────────────────
  {
    id: '3',
    documentNumber: 'DOC-2024-003',
    address: '경기도 성남시 분당구 판교역로 789',
    orderDate: relativeDate(-7),
    affiliate: '교육플랫폼',
    businessName: '교육플랫폼 본사',
    contactName: '최지훈',
    contactPhone: '010-3456-7890',
    status: 'in-progress',
    items: [
      {
        id: '3-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP052BAPPBH2S',
        size: '13평',
        quantity: 5
      }
    ],
    notes: '사무실 전체 교체',
    createdAt: relativeDate(-7) + 'T14:20:00Z',
    deliveryStatus: 'in-transit',
    requestedDeliveryDate: relativeDate(0),
    confirmedDeliveryDate: relativeDate(0),
    samsungOrderNumber: 'SO-2026-003',
    equipmentItems: [
      {
        id: 'eq-3-1',
        setModel: 'AP052BAPPBH2S',
        componentName: '실외기',
        componentModel: 'AP052BXPPBH3',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-003',
        orderDate: relativeDate(-7),
        requestedDeliveryDate: relativeDate(0),
        confirmedDeliveryDate: relativeDate(0),
        quantity: 5,
        unitPrice: 651559,
        totalPrice: 3257795,
        warehouseId: '4',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-3-2',
        setModel: 'AP052BAPPBH2S',
        componentName: '실내기',
        componentModel: 'AP052BNPPBH1',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-003',
        orderDate: relativeDate(-7),
        requestedDeliveryDate: relativeDate(0),
        confirmedDeliveryDate: relativeDate(0),
        quantity: 5,
        unitPrice: 338472,
        totalPrice: 1692360,
        warehouseId: '4',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-3-3',
        setModel: 'AP052BAPPBH2S',
        componentName: '자재박스',
        componentModel: 'FPH-1412XS3',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-003-B',
        orderDate: relativeDate(-7),
        requestedDeliveryDate: relativeDate(0),
        confirmedDeliveryDate: relativeDate(0),
        quantity: 5,
        unitPrice: 86669,
        totalPrice: 433345,
        warehouseId: '4',
        deliveryStatus: 'in-transit'
      }
    ]
  },

  // ──────────────────────────────────────────────────────
  // 4. 완료 - Wells 서비스 인천센터 (입고완료)
  //    SET: AR60F09C13WS (벽걸이 9평) × 4대
  // ──────────────────────────────────────────────────────
  {
    id: '4',
    documentNumber: 'DOC-2024-004',
    address: '인천시 연수구 송도국제대로 321',
    orderDate: relativeDate(-20),
    affiliate: 'Wells 서비스',
    businessName: 'Wells 서비스 인천센터',
    contactName: '정수진',
    contactPhone: '010-4567-8901',
    status: 'completed',
    items: [
      {
        id: '4-1',
        workType: '신규설치',
        category: '벽걸이에어컨',
        model: 'AR60F09C13WS',
        size: '9평',
        quantity: 4
      }
    ],
    notes: '신축 건물, 배관 작업 완료됨',
    createdAt: relativeDate(-20) + 'T11:15:00Z',
    deliveryStatus: 'delivered',
    requestedDeliveryDate: relativeDate(-15),
    confirmedDeliveryDate: relativeDate(-15),
    samsungOrderNumber: 'SO-2026-004',
    completionDate: relativeDate(-10),
    settlementMonth: '2024-01',
    equipmentItems: [
      {
        id: 'eq-4-1',
        setModel: 'AR60F09C13WS',
        componentName: '실외기',
        componentModel: 'AR60F09C13WXKO',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-004',
        orderDate: relativeDate(-20),
        requestedDeliveryDate: relativeDate(-15),
        confirmedDeliveryDate: relativeDate(-15),
        quantity: 4,
        unitPrice: 466692,
        totalPrice: 1866768,
        warehouseId: '1',
        deliveryStatus: 'delivered'
      },
      {
        id: 'eq-4-2',
        setModel: 'AR60F09C13WS',
        componentName: '실내기',
        componentModel: 'AR60F09C13WNKO',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-004',
        orderDate: relativeDate(-20),
        requestedDeliveryDate: relativeDate(-15),
        confirmedDeliveryDate: relativeDate(-15),
        quantity: 4,
        unitPrice: 254885,
        totalPrice: 1019540,
        warehouseId: '1',
        deliveryStatus: 'delivered'
      },
      {
        id: 'eq-4-3',
        setModel: 'AR60F09C13WS',
        componentName: '자재박스',
        componentModel: 'FRH-1438NH3',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-004',
        orderDate: relativeDate(-20),
        requestedDeliveryDate: relativeDate(-15),
        confirmedDeliveryDate: relativeDate(-15),
        quantity: 4,
        unitPrice: 28207,
        totalPrice: 112828,
        warehouseId: '1',
        deliveryStatus: 'delivered'
      },
      {
        id: 'eq-4-4',
        setModel: 'AR60F09C13WS',
        componentName: '리모컨',
        componentModel: 'ARR-WK8F',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-004-R',
        orderDate: relativeDate(-20),
        requestedDeliveryDate: relativeDate(-15),
        confirmedDeliveryDate: relativeDate(-15),
        quantity: 4,
        unitPrice: 24616,
        totalPrice: 98464,
        warehouseId: '1',
        deliveryStatus: 'delivered'
      }
    ]
  },

  // ──────────────────────────────────────────────────────
  // 5. 정산완료 - 구몬 마포지국 (입고완료)
  //    SET: AP110BAPPBH2S (스탠드 30평 단상) × 1대
  // ──────────────────────────────────────────────────────
  {
    id: '5',
    documentNumber: 'DOC-2024-005',
    address: '서울시 마포구 상암동 654',
    orderDate: relativeDate(-30),
    affiliate: '구몬',
    businessName: '구몬 마포지국',
    contactName: '이영호',
    contactPhone: '010-5678-9012',
    status: 'settled',
    items: [
      {
        id: '5-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP110BAPPBH2S',
        size: '30평',
        quantity: 1
      },
      {
        id: '5-2',
        workType: '철거보관',
        category: '스탠드에어컨',
        model: 'OLD-002',
        size: '30평',
        quantity: 1
      }
    ],
    notes: '펜트하우스, 실외기 옥상 설치',
    createdAt: relativeDate(-30) + 'T09:45:00Z',
    deliveryStatus: 'delivered',
    requestedDeliveryDate: relativeDate(-25),
    confirmedDeliveryDate: relativeDate(-25),
    samsungOrderNumber: 'SO-2026-005',
    completionDate: relativeDate(-20),
    settlementDate: relativeDate(-15),
    settlementMonth: '2024-01',
    quoteAmount: 3200000,
    actualCost: 3280000
  },

  // ──────────────────────────────────────────────────────
  // 6. 접수중 - 대한냉난방 (발주대기 - 배송정보 없음)
  //    SET: AR60F09C13WS (벽걸이 9평) × 3대
  // ──────────────────────────────────────────────────────
  {
    id: '6',
    documentNumber: 'DOC-2024-006',
    address: '경기도 고양시 일산동구 중앙로 987',
    orderDate: relativeDate(-3),
    affiliate: '기타',
    businessName: '대한냉난방',
    contactName: '송미경',
    contactPhone: '010-6789-0123',
    status: 'received',
    items: [
      {
        id: '6-1',
        workType: '이전설치',
        category: '벽걸이에어컨',
        model: 'AR60F09C13WS',
        size: '9평',
        quantity: 3
      }
    ],
    notes: '기존 에어컨 철거 후 설치',
    createdAt: relativeDate(-3) + 'T16:00:00Z',
    deliveryStatus: 'pending',
    requestedDeliveryDate: relativeDate(5)
  },

  // ──────────────────────────────────────────────────────
  // 7. 진행중 - 구몬 송파지국 (내일 입고 예정)
  //    SET: AP145BAPPHH2S (스탠드 40평) × 2대
  // ──────────────────────────────────────────────────────
  {
    id: '7',
    documentNumber: 'DOC-2024-007',
    address: '서울시 송파구 올림픽로 147, 상가 1층',
    orderDate: relativeDate(-8),
    affiliate: '구몬',
    businessName: '구몬 송파지국',
    contactName: '강동현',
    contactPhone: '010-7890-1234',
    status: 'in-progress',
    items: [
      {
        id: '7-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP145BAPPHH2S',
        size: '40평',
        quantity: 2
      }
    ],
    notes: '영업시간 외 작업 필수 (저녁 8시 이후)',
    createdAt: relativeDate(-8) + 'T13:30:00Z',
    deliveryStatus: 'in-transit',
    requestedDeliveryDate: relativeDate(1),
    confirmedDeliveryDate: relativeDate(1),
    samsungOrderNumber: 'SO-2026-007',
    equipmentItems: [
      {
        id: 'eq-7-1',
        setModel: 'AP145BAPPHH2S',
        componentName: '실외기',
        componentModel: 'AC145BXAPHH5',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-007',
        orderDate: relativeDate(-8),
        requestedDeliveryDate: relativeDate(1),
        confirmedDeliveryDate: relativeDate(1),
        quantity: 2,
        unitPrice: 1032356,
        totalPrice: 2064712,
        warehouseId: '1',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-7-2',
        setModel: 'AP145BAPPHH2S',
        componentName: '실내기',
        componentModel: 'AP145BNPPHH1',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-007',
        orderDate: relativeDate(-8),
        requestedDeliveryDate: relativeDate(1),
        confirmedDeliveryDate: relativeDate(1),
        quantity: 2,
        unitPrice: 823628,
        totalPrice: 1647256,
        warehouseId: '1',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-7-3',
        setModel: 'AP145BAPPHH2S',
        componentName: '자재박스',
        componentModel: 'FPH-3858XS5',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-007',
        orderDate: relativeDate(-8),
        requestedDeliveryDate: relativeDate(1),
        quantity: 2,
        unitPrice: 116416,
        totalPrice: 232832,
        warehouseId: '1',
        deliveryStatus: 'in-transit'
      }
    ]
  },

  // ──────────────────────────────────────────────────────
  // 8. 완료 - Wells 영업 수원지사 (입고완료)
  //    SET: AP060BAPPBH2S (스탠드 15평) × 2대
  // ──────────────────────────────────────────────────────
  {
    id: '8',
    documentNumber: 'DOC-2024-008',
    address: '경기도 수원시 영통구 광교중앙로 258',
    orderDate: relativeDate(-25),
    affiliate: 'Wells 영업',
    businessName: 'Wells 영업 수원지사',
    contactName: '윤서연',
    contactPhone: '010-8901-2345',
    status: 'completed',
    items: [
      {
        id: '8-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP060BAPPBH2S',
        size: '15평',
        quantity: 2
      }
    ],
    notes: '친환경 모델, 정부 보조금 대상',
    createdAt: relativeDate(-25) + 'T10:00:00Z',
    deliveryStatus: 'delivered',
    requestedDeliveryDate: relativeDate(-20),
    confirmedDeliveryDate: relativeDate(-20),
    samsungOrderNumber: 'SO-2026-008',
    completionDate: relativeDate(-15),
    settlementMonth: '2024-01'
  },

  // ──────────────────────────────────────────────────────
  // 9. 진행중 - 교육플랫폼 강서지사 (발주대기 - 주문번호 미입력)
  //    SET: AR60F07C14WS (벽걸이 7평) × 1대
  // ──────────────────────────────────────────────────────
  {
    id: '9',
    documentNumber: 'DOC-2024-009',
    address: '서울시 강서구 공항대로 369',
    orderDate: relativeDate(-5),
    affiliate: '교육플랫폼',
    businessName: '교육플랫폼 강서지사',
    contactName: '한재민',
    contactPhone: '010-9012-3456',
    status: 'in-progress',
    items: [
      {
        id: '9-1',
        workType: '신규설치',
        category: '벽걸이에어컨',
        model: 'AR60F07C14WS',
        size: '7평',
        quantity: 1
      }
    ],
    notes: '원룸형, 간단 설치',
    createdAt: relativeDate(-5) + 'T15:20:00Z',
    deliveryStatus: 'pending',
    requestedDeliveryDate: relativeDate(3)
  },

  // ──────────────────────────────────────────────────────
  // 10. 정산완료 - Wells 서비스 여의도센터 (입고완료)
  //     SET: AP290DAPDHH1S (스탠드 83평) × 1대 + AR60F16C14WS (벽걸이 16평) × 3대
  // ──────────────────────────────────────────────────────
  {
    id: '10',
    documentNumber: 'DOC-2024-010',
    address: '서울시 영등포구 여의도동 753, 오피스 빌딩 12층',
    orderDate: relativeDate(-40),
    affiliate: 'Wells 서비스',
    businessName: 'Wells 서비스 여의도센터',
    contactName: '임하늘',
    contactPhone: '010-0123-4567',
    status: 'settled',
    items: [
      {
        id: '10-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP290DAPDHH1S',
        size: '83평',
        quantity: 1
      },
      {
        id: '10-2',
        workType: '신규설치',
        category: '벽걸이에어컨',
        model: 'AR60F16C14WS',
        size: '16평',
        quantity: 3
      }
    ],
    notes: '사무실용 대형, 시스템 에어컨',
    createdAt: relativeDate(-40) + 'T08:30:00Z',
    deliveryStatus: 'delivered',
    requestedDeliveryDate: relativeDate(-35),
    confirmedDeliveryDate: relativeDate(-35),
    samsungOrderNumber: 'SO-2026-010',
    completionDate: relativeDate(-30),
    settlementDate: relativeDate(-25),
    settlementMonth: '2024-01',
    quoteAmount: 5800000,
    actualCost: 5750000
  },

  // ──────────────────────────────────────────────────────
  // 11. 정산완료 - 구몬 강남지국 (작년 12월)
  //     SET: AR60F13C13WS (벽걸이 13평) × 3대
  // ──────────────────────────────────────────────────────
  {
    id: '11',
    documentNumber: 'DOC-2023-099',
    address: '서울시 강남구 테헤란로 427, 위워크 2층',
    orderDate: '2023-12-15',
    affiliate: '구몬',
    businessName: '구몬 강남지국',
    contactName: '오준석',
    contactPhone: '010-1111-2222',
    status: 'settled',
    items: [
      {
        id: '11-1',
        workType: '신규설치',
        category: '벽걸이에어컨',
        model: 'AR60F13C13WS',
        size: '13평',
        quantity: 3
      }
    ],
    notes: '공유 오피스, 3개 룸',
    createdAt: '2023-12-15T09:00:00Z',
    deliveryStatus: 'delivered',
    requestedDeliveryDate: '2023-12-18',
    confirmedDeliveryDate: '2023-12-18',
    completionDate: '2023-12-22',
    settlementDate: '2023-12-28',
    settlementMonth: '2023-12',
    quoteAmount: 2400000,
    actualCost: 2350000
  },

  // ──────────────────────────────────────────────────────
  // 12. 정산완료 - 교육플랫폼 분당지사 (작년 12월)
  // ──────────────────────────────────────────────────────
  {
    id: '12',
    documentNumber: 'DOC-2023-098',
    address: '경기도 성남시 분당구 정자일로 95',
    orderDate: '2023-12-10',
    affiliate: '교육플랫폼',
    businessName: '교육플랫폼 분당지사',
    contactName: '신유진',
    contactPhone: '010-2222-3333',
    status: 'settled',
    items: [
      {
        id: '12-1',
        workType: '이전설치',
        category: '스탠드에어컨',
        model: 'AP060BAPPBH2S',
        size: '15평',
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

  // ──────────────────────────────────────────────────────
  // 13. 정산완료 - Wells 영업 부산지사 (작년 11월)
  //     SET: AP130BAPPHH2S (스탠드 36평 삼상) × 2대
  // ──────────────────────────────────────────────────────
  {
    id: '13',
    documentNumber: 'DOC-2023-085',
    address: '부산시 해운대구 센텀중앙로 78',
    orderDate: '2023-11-20',
    affiliate: 'Wells 영업',
    businessName: 'Wells 영업 부산지사',
    contactName: '배승현',
    contactPhone: '010-3333-4444',
    status: 'settled',
    items: [
      {
        id: '13-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP130BAPPHH2S',
        size: '36평',
        quantity: 2
      },
      {
        id: '13-2',
        workType: '철거폐기',
        category: '스탠드에어컨',
        model: 'OLD-003',
        size: '36평',
        quantity: 2
      }
    ],
    notes: '기존 장비 전부 철거 후 교체',
    createdAt: '2023-11-20T10:30:00Z',
    deliveryStatus: 'delivered',
    requestedDeliveryDate: '2023-11-23',
    confirmedDeliveryDate: '2023-11-23',
    completionDate: '2023-11-28',
    settlementDate: '2023-11-30',
    settlementMonth: '2023-11',
    quoteAmount: 4200000,
    actualCost: 4180000
  },

  // ──────────────────────────────────────────────────────
  // 14. 진행중 - Wells 서비스 광주센터 (이번 주 입고 예정)
  //     SET: AP110BAPPHH2S (스탠드 30평 삼상) × 2대
  // ──────────────────────────────────────────────────────
  {
    id: '14',
    documentNumber: 'DOC-2024-014',
    address: '광주광역시 서구 상무중앙로 110',
    orderDate: relativeDate(-6),
    affiliate: 'Wells 서비스',
    businessName: 'Wells 서비스 광주센터',
    contactName: '장미래',
    contactPhone: '010-4444-5555',
    status: 'in-progress',
    items: [
      {
        id: '14-1',
        workType: '신규설치',
        category: '스탠드에어컨',
        model: 'AP110BAPPHH2S',
        size: '30평',
        quantity: 2
      }
    ],
    notes: '사무실 2개층 설치',
    createdAt: relativeDate(-6) + 'T09:00:00Z',
    deliveryStatus: 'in-transit',
    requestedDeliveryDate: relativeDate(4),
    confirmedDeliveryDate: relativeDate(4),
    samsungOrderNumber: 'SO-2026-014',
    equipmentItems: [
      {
        id: 'eq-14-1',
        setModel: 'AP110BAPPHH2S',
        componentName: '실외기',
        componentModel: 'AC110BXAPHH3',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-014',
        orderDate: relativeDate(-6),
        requestedDeliveryDate: relativeDate(4),
        confirmedDeliveryDate: relativeDate(4),
        quantity: 2,
        unitPrice: 857482,
        totalPrice: 1714964,
        warehouseId: '5',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-14-2',
        setModel: 'AP110BAPPHH2S',
        componentName: '실내기',
        componentModel: 'AP110RNPPHH1',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-014',
        orderDate: relativeDate(-6),
        requestedDeliveryDate: relativeDate(4),
        confirmedDeliveryDate: relativeDate(4),
        quantity: 2,
        unitPrice: 682601,
        totalPrice: 1365202,
        warehouseId: '5',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-14-3',
        setModel: 'AP110BAPPHH2S',
        componentName: '자재박스',
        componentModel: 'FPH-3858XS5',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-014',
        orderDate: relativeDate(-6),
        requestedDeliveryDate: relativeDate(4),
        confirmedDeliveryDate: relativeDate(4),
        quantity: 2,
        unitPrice: 116417,
        totalPrice: 232834,
        warehouseId: '5',
        deliveryStatus: 'in-transit'
      }
    ]
  },

  // ──────────────────────────────────────────────────────
  // 15. 접수중 - 구몬 대구지국 (이번 주 입고 예정)
  //     SET: AR60F11C13WS (벽걸이 11평) × 2대
  // ──────────────────────────────────────────────────────
  {
    id: '15',
    documentNumber: 'DOC-2024-015',
    address: '대구광역시 수성구 달구벌대로 2200',
    orderDate: relativeDate(-4),
    affiliate: '구몬',
    businessName: '구몬 대구지국',
    contactName: '조하늘',
    contactPhone: '010-5555-6666',
    status: 'received',
    items: [
      {
        id: '15-1',
        workType: '신규설치',
        category: '벽걸이에어컨',
        model: 'AR60F11C13WS',
        size: '11평',
        quantity: 2
      }
    ],
    notes: '1층 상가, 주차 편리',
    createdAt: relativeDate(-4) + 'T11:00:00Z',
    deliveryStatus: 'in-transit',
    requestedDeliveryDate: relativeDate(5),
    samsungOrderNumber: 'SO-2026-015',
    equipmentItems: [
      {
        id: 'eq-15-1',
        setModel: 'AR60F11C13WS',
        componentName: '실외기',
        componentModel: 'AR60F11C13WXKO',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-015',
        orderDate: relativeDate(-4),
        requestedDeliveryDate: relativeDate(5),
        quantity: 2,
        unitPrice: 523123,
        totalPrice: 1046246,
        warehouseId: '5',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-15-2',
        setModel: 'AR60F11C13WS',
        componentName: '실내기',
        componentModel: 'AR60F11C13WNKO',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-015',
        orderDate: relativeDate(-4),
        requestedDeliveryDate: relativeDate(5),
        quantity: 2,
        unitPrice: 289769,
        totalPrice: 579538,
        warehouseId: '5',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-15-3',
        setModel: 'AR60F11C13WS',
        componentName: '자재박스',
        componentModel: 'FRH-1412NA3',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-015',
        orderDate: relativeDate(-4),
        requestedDeliveryDate: relativeDate(5),
        quantity: 2,
        unitPrice: 39491,
        totalPrice: 78982,
        warehouseId: '5',
        deliveryStatus: 'in-transit'
      },
      {
        id: 'eq-15-4',
        setModel: 'AR60F11C13WS',
        componentName: '리모컨',
        componentModel: 'ARR-WK8F',
        supplier: '삼성전자',
        orderNumber: 'SO-2026-015-R',
        orderDate: relativeDate(-4),
        requestedDeliveryDate: relativeDate(5),
        quantity: 2,
        unitPrice: 24617,
        totalPrice: 49234,
        warehouseId: '5',
        deliveryStatus: 'in-transit'
      }
    ]
  }
]
