# MeLEA — 에어컨 발주 관리 시스템

교원그룹 전국 에어컨 발주 접수부터 장비 배송, 설치, 견적, 정산까지 원스톱으로 관리하는 웹 애플리케이션입니다.

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

---

## 배경

기존에는 **엑셀 + 전화 + 카카오톡**으로 흩어진 발주·배송·설치·정산 업무를 수작업으로 처리했습니다.
이 시스템은 각 역할(교원/멜레아/에스원)이 **한 곳에서 입력하면 나머지가 자동 연결**되도록 설계되었습니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **발주 관리** | 칸반보드 기반 발주 접수·진행·완료 추적 |
| **배송 관리** | 구성품별 개별 주문번호·배송상태 관리, SET 모델 그룹핑 |
| **재고 관리** | 창고별 재고 현황, 입고/출고 이벤트 기록 |
| **설치 관리** | 설치일정 입력, 설치완료 처리 |
| **견적서 작성** | 단가표 연동, 단위절사/VAT 자동 계산, 실시간 자동저장 |
| **정산 관리** | 월별 정산지 자동 생성, 에스원 설치비 정산 |
| **보관장비 관리** | 철거보관 장비 추적 (창고·기간) |
| **AS 관리** | AS 접수·처리·완료 추적 |

---

## 사용자 역할

| 역할 | 주요 업무 |
|------|----------|
| **교원그룹** | 발주 접수, AS 요청 |
| **멜레아 (관리자)** | 견적서 작성, 삼성 장비 발주, 배송 추적, 재고/보관장비 관리, 월별 정산 |
| **에스원ENG (설치팀)** | 설치일정 입력, 설치비 입력 |

---

## 업무 흐름

```
교원그룹 발주 접수
  │
  ├─ 신규설치 → 삼성에 장비 발주 → 배송관리 (발주대기 → 배송중 → 입고완료)
  │                                  └─ 입고 시 창고 재고에 자동 반영
  ├─ 철거보관 → 보관장비 관리 (창고 위치 추적)
  │
  ├─ 견적서 작성 (판매가) + 장비비/설치비 입력 (원가) → 마진 자동 계산
  │
  └─ 설치 완료 → 월별 정산지 자동 생성
```

---

## 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS + shadcn/ui
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth (역할별 로그인)
- **파일 저장**: Supabase Storage (현장 사진 등)
- **PDF 생성**: jsPDF + jspdf-autotable
- **엑셀 처리**: SheetJS (xlsx)
- **지도**: 카카오맵 API (창고 위치)
- **배포**: Vercel

---

## 프로젝트 구조

```
app/
├── (dashboard)/            # 로그인 후 대시보드 영역
│   ├── page.tsx            # 메인 대시보드
│   ├── orders/             # 발주 관리 (칸반보드)
│   ├── as/                 # AS 관리
│   ├── settlements/        # 정산 관리
│   ├── price-table/        # 연간 단가표
│   ├── mellea/             # 멜레아 전용
│   │   ├── delivery/       #   배송 관리
│   │   ├── schedule/       #   설치 관리
│   │   ├── inventory/      #   재고 관리
│   │   ├── warehouses/     #   창고 관리
│   │   ├── billing/        #   매입 관리
│   │   ├── s1-settlement/  #   에스원 정산
│   │   └── stored-equipment/ # 보관장비 관리
│   └── kyowon/             # 교원 전용
│       ├── price-table/    #   교원 단가표
│       ├── prepurchase/    #   선구매 관리
│       └── stored-equipment/ # 보관장비 조회
├── login/                  # 로그인 페이지
├── layout.tsx              # 루트 레이아웃
├── error.tsx               # 전역 에러 페이지
├── not-found.tsx           # 404 페이지
└── loading.tsx             # 전역 로딩 화면

components/
├── orders/                 # 발주 관련 컴포넌트
├── delivery/               # 배송 관련 컴포넌트
├── schedule/               # 설치 관련 컴포넌트
├── quotes/                 # 견적서 관련 컴포넌트
├── billing/                # 매입 관련 컴포넌트
├── inventory/              # 재고 관련 컴포넌트
├── stored-equipment/       # 보관장비 관련 컴포넌트
├── warehouses/             # 창고 관련 컴포넌트
├── as/                     # AS 관련 컴포넌트
└── ui/                     # shadcn/ui 공통 컴포넌트

lib/
├── supabase/               # Supabase 클라이언트·DAL·미들웨어
│   ├── client.ts           #   브라우저용 클라이언트
│   ├── server.ts           #   서버용 클라이언트
│   ├── dal.ts              #   Data Access Layer (DB 조회/수정)
│   ├── middleware.ts        #   인증 미들웨어
│   ├── storage.ts          #   파일 업로드/다운로드
│   └── transforms.ts       #   snake_case ↔ camelCase 변환
├── auth/                   # 역할별 권한 제어
├── pdf/                    # PDF 생성 (견적서)
├── price-table.ts          # 연간 단가표 데이터
├── excel-export.ts         # 엑셀 내보내기
├── kakao-map.ts            # 카카오맵 SDK 로드
└── utils.ts                # 공통 유틸리티

types/
├── order.ts                # 발주·견적·정산 타입
├── warehouse.ts            # 창고·재고 타입
├── as.ts                   # AS 타입
├── prepurchase.ts          # 선구매 타입
└── kakao-maps.d.ts         # 카카오맵 타입 선언
```

---

## 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/WM-19940914/Kywon-project.git
cd Kywon-project
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 파일을 열고 실제 값을 입력합니다:

```env
# Supabase (https://app.supabase.com에서 확인)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 카카오맵 (https://developers.kakao.com에서 발급)
NEXT_PUBLIC_KAKAO_MAP_KEY=your-kakao-map-key
```

---

## 데이터베이스 구조

```
orders (발주) ─┬─ order_items (발주 내역)
               ├─ equipment_items (구성품/배송 정보)
               ├─ installation_costs (설치비)
               └─ customer_quotes → quote_items (견적서)

warehouses (창고)
warehouse_inventory (창고별 재고)
stored_equipment (철거보관 장비)
settlements (월별 정산)
```

---

## 주요 화면

- **대시보드**: 전체 발주 현황 요약, 최근 활동
- **발주 관리**: 칸반보드로 접수/진행/완료 상태를 한눈에 관리
- **배송 관리**: 발주대기 → 배송중 → 입고완료 탭별 구성품 추적
- **설치 관리**: 설치일정 배정, 설치완료 처리, 정산 상태 확인
- **견적서**: 단가표 기반 자동 계산, 실시간 저장, PDF 내보내기
- **정산 관리**: 월별 정산지 자동 집계, 엑셀 내보내기
- **창고 관리**: 카카오맵 기반 창고 위치 표시, 재고 현황
