# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 에어컨 설치 발주 관리 시스템 (멜레아)

## 프로젝트 개요
- **목적**: 교원그룹 전국 에어컨 발주 접수 → 장비 배송 → 설치 → 견적 → 정산까지 원스톱 관리
- **현재 문제**: 엑셀 + 전화 + 카톡으로 흩어진 업무를 수작업으로 처리하는 비효율
- **해결 방안**: 각 역할(교원/멜레아/에스원)이 한 곳에서 입력하면 나머지가 자동 연결되는 웹앱
- **사용자**: 개발 완전 초보자 — 코드 설명은 한글로 친절하게

---

## 개발 명령어

```bash
npx next dev -p 3002     # 개발 서버 시작 (⚠️ 반드시 포트 3002 — 카카오 API 등록 포트)
                         # npm run dev는 포트 미지정(3000)이므로 사용 금지
npm run build            # 프로덕션 빌드 (TypeScript 에러 시 실패)
npm run start            # 프로덕션 서버 실행
npm run lint             # ESLint 검사
```

- **테스트**: 테스트 프레임워크 미도입 — 테스트 명령어 없음

### 환경 변수 (`.env.local` 필요)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 공개 키
- `NEXT_PUBLIC_KAKAO_MAP_KEY` — 카카오 지도 JavaScript 키

---

## 아키텍처

### 기술 스택
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS** + **shadcn/ui** (new-york 스타일)
- **Supabase** (PostgreSQL + Auth + Storage) — 서울 리전(ap-northeast-2)
- **Vercel** 배포
- **주요 라이브러리**: exceljs(엑셀 내보내기), jspdf+jspdf-autotable(견적서 PDF), html2canvas(화면 캡처), sonner(토스트 알림), lucide-react(아이콘)

### Windows 환경 특이사항
- `next.config.mjs`에서 dev 모드 시 webpack 캐시를 memory로 강제 설정 (Windows 파일 캐시 깨짐 방지)
- bash에서 괄호 포함 경로는 반드시 큰따옴표: `"app/(dashboard)/..."`

### 핵심 구조
```
app/
├── login/                    # 로그인 페이지 (서버 액션으로 인증)
├── (dashboard)/              # 보호된 대시보드 (middleware로 인증 체크)
│   ├── layout.tsx            # 서버 컴포넌트 — 유저 프로필 fetch
│   ├── dashboard-shell.tsx   # 클라이언트 — 사이드바 + 역할별 메뉴 필터링
│   ├── orders/               # 발주 관리 (칸반보드)
│   ├── mellea/               # 멜레아 전용 (배송/재고/설치/정산)
│   ├── kyowon/               # 교원 전용 (사전구매/보관장비/단가표)
│   └── admin/                # 관리자 전용

lib/
├── supabase/
│   ├── dal.ts                # ⭐ 데이터 접근 계층 (모든 DB CRUD — 87KB)
│   ├── client.ts             # 브라우저용 Supabase 클라이언트
│   ├── server.ts             # 서버용 Supabase 클라이언트
│   ├── storage.ts            # 파일 업로드/다운로드 (현장사진)
│   └── transforms.ts         # snake_case(DB) ↔ camelCase(TS) 변환
├── auth/
│   ├── roles.ts              # 역할 정의 + 메뉴 접근 권한
│   ├── route-access.ts       # URL별 접근 규칙 (middleware에서 사용)
│   └── user-context.tsx      # React Context (useUser 훅)
├── menu-items.ts             # 사이드바 메뉴 구조
├── price-table.ts            # 연간 단가표 데이터
├── excel-export.ts           # 엑셀 내보내기 (31KB)
└── pdf/                      # 견적서 PDF 생성

components/
├── ui/                       # shadcn/ui 래퍼 (import: @/components/ui/...)
├── orders/                   # 발주 관련 (칸반 카드, 상세, 폼)
├── delivery/                 # 배송 관련 (테이블, 상세, 단가표)
├── schedule/                 # 설치 관련 (일정 테이블, 현장사진)
├── quotes/                   # 견적서 (자동저장 다이얼로그)
├── inventory/                # 재고 (창고별 현황)
├── billing/                  # 매입 (삼성 구매, 월별 요약)
└── stored-equipment/         # 철거 보관장비

types/
├── order.ts                  # ⭐ 핵심 타입 (Order, OrderItem, EquipmentItem 등 — 30KB)
├── warehouse.ts              # 창고/재고 타입
├── as.ts                     # AS 요청 타입
└── kakao-maps.d.ts           # 카카오 지도 전역 타입
```

### 인증 흐름
1. `middleware.ts` — 모든 요청에서 Supabase 세션 확인
2. 미인증 → `/login` 리다이렉트
3. 인증 후 `isRouteAllowed(role, path)` 로 역할별 접근 제어
4. 로그인: 사용자이름 입력 → 내부에서 `{username}@mellea.local`로 변환

### 역할 체계 (5종)
- `admin` — 전체 접근
- `melea` — 배송/재고/설치/정산/견적 등 운영 전반
- `s1eng` — 배송/설치/정산 (에스원 설치팀)
- `kyowon` — 발주/AS/정산/단가표 (교원그룹)
- `affiliate` — 발주/AS/보관장비/단가표 (계열사)

### DAL 패턴 (데이터 접근 계층)
- **모든 DB 호출**은 `lib/supabase/dal.ts` 한 파일에 집중
- 컴포넌트에서 직접 Supabase 쿼리 금지 → DAL 함수 호출
- DB는 snake_case, TypeScript는 camelCase → `transforms.ts`로 자동 변환

---

## 사용자 역할별 업무

| 사용자 | 주요 업무 |
|--------|----------|
| **교원그룹** | 발주 접수, AS 요청 |
| **멜레아 (본인)** | 견적서 작성, 삼성 장비 발주, 배송 추적, 재고/보관장비 관리, 월별 정산 |
| **에스원ENG (설치팀)** | 설치일정 입력, 설치비 입력 |
| **경영팀** | 정산 자료 확인/승인 |

## 핵심 업무 흐름
```
교원그룹 발주 접수 (orders)
  ├─ 신규설치 → 삼성에 장비 발주 → 배송관리(발주대기→배송중→입고완료)
  │                                    └─ 입고 시 창고 재고에 자동 반영
  ├─ 철거보관 → 보관장비 관리 (어느 창고에 보관중인지 추적)
  ├─ 견적서 작성 (판매가) + 장비비/설치비 입력 (원가) → 마진 자동 계산
  ├─ 에스원 설치일정 입력 + 설치비 직접 입력
  └─ 설치 완료 → 월별 정산지 자동 생성
```

---

## 데이터 구조

### 핵심 테이블 관계
```
orders (발주) ─┬─ order_items (발주 내역, 1:N)
               ├─ equipment_items (구성품/배송 정보, 1:N)
               ├─ installation_costs (설치비, 1:N)
               └─ customer_quotes → quote_items (견적서, 1:1:N)

warehouses (창고 목록)
warehouse_inventory (창고별 재고 — 입고/출고 기록)
stored_equipment (철거보관 장비)
settlements (월별 정산)
user_profiles (사용자 — Auth UUID 연결)
```

### 주요 타입 (types/order.ts)
- `Order` — 발주 정보 (중심 테이블)
- `OrderItem` — 발주 내역 (작업종류/품목/모델/수량)
- `EquipmentItem` — 구성품별 배송 정보 (주문번호/배송상태/창고/매입처 개별 관리)
- `InstallationCost` — 설치비 항목
- `CustomerQuote` / `QuoteItem` — 소비자용 견적서
- `OrderStatus` — `received → in-progress → completed → settled → cancelled`
- `DeliveryStatus` — `pending → in-transit → delivered`
- `S1SettlementStatus` — `unsettled → in-progress → settled`

---

## 코딩 규칙

### 1. 주석 작성 (매우 중요!)
- **모든 컴포넌트**: 상단에 용도 설명 주석
- **함수**: 파라미터와 리턴값 설명
- **복잡한 로직**: 단계별 설명 주석

### 2. 컴포넌트 작성
- **클라이언트 컴포넌트**: 'use client' 명시
- **파일명**: kebab-case (order-list.tsx)
- **컴포넌트명**: PascalCase (OrderList)

### 3. 개발 원칙
- **초보 개발자 친화적**: 코드에 자세한 한글 주석
- **단계별 구현**: 한 번에 하나씩 기능 추가
- **날짜 처리**: 한국 시간대(KST) 사용

### 4. 자동 적용 규칙 (명령어 없이 항상 적용)

#### 커밋 시
- 커밋 메시지는 **항상 한국어**로 작성 (영어, 이모지, conventional commit prefix 금지)
- 기능명/개선사항을 간결하게 나열, 쉼표로 구분 (한 줄 70자 이내)
- `.env.local` 등 민감 파일은 커밋 대상에서 자동 제외
- 커밋 전 반드시 사용자에게 메시지 확인받기

#### 배포/빌드 시
- 코드 작성 완료 후 `npm run build`로 빌드 에러 여부 자동 확인
- 에러 발견 시 즉시 수정 제안

#### DB 작업 시
- 테이블 변경은 `.claude/agents/supabase-helper.md` 규칙 참조
- DAL 함수는 `lib/supabase/dal.ts`에만 작성
- snake_case(DB) ↔ camelCase(TS) 변환 필수

#### UI 작성 시
- 새 컴포넌트 작성 후 모바일/데스크톱 반응형 확인
- shadcn/ui 컴포넌트 import 경로: `@/components/ui/...`
- 상태 뱃지 색상: 기존 패턴과 통일 (회색/주황/초록/파랑)

#### 코드 수정 시 개발 서버 안정성 (매우 중요!)
- 여러 파일을 동시에 수정하지 말고, **한 파일씩 저장**하여 HMR이 안정적으로 작동하게 유도
- 타입 파일(`types/`)이나 공통 파일(`lib/`) 수정 시 연쇄 리빌드 실패 가능성 높음 → 해당 파일 먼저 수정 완료 후 컴포넌트 수정
- 코드 수정 후 사용자가 "서버 에러", "안 열려", "흰 화면", "깨져" 등 보고하면 즉시 다음 실행:
  1. `.next` 캐시 삭제: `rm -rf .next`
  2. 개발 서버 재시작: `npm run dev`
  3. 그래도 안 되면 `node_modules/.cache` 삭제 후 재시작
- 큰 구조 변경(파일명 변경, 컴포넌트 분리 등) 후에는 **자동으로 서버 재시작** 실행

---

## Tailwind 커스텀 색상
| 이름 | 용도 | HEX |
|------|------|-----|
| `teal` | Primary (차분한 청록) | #5B8E7D |
| `carrot` | Secondary (따뜻한 주황) | #F3933F |
| `olive` | Tertiary (자연 녹색) | #8CB369 |
| `gold` | Accent (따뜻한 노랑) | #e0c030 |
| `brick` | Alert/Error (따뜻한 빨강) | #BC4B51 |

## MeLEA 브랜드 로고 스타일
- **배경색**: `#E09520` (오렌지), **M/LEA**: `#2D2519` (다크 브라운) bold, **e**: 화이트 이탤릭
- **뱃지 형태**: `px-3 py-1.5 rounded-md shadow-sm`

---

## 현재 구현 상태

### 구현 완료
- 발주 관리 (`/orders`) — 칸반보드 + 등록/수정/상세/취소
- 배송 관리 (`/mellea/delivery`) — 3탭(발주대기/배송중/입고완료) + SET 컬러바 그룹핑
- 재고 관리 (`/mellea/inventory`) — 창고별 현황 + 입출고 기록
- 설치 관리 (`/mellea/schedule`) — 일정 테이블 + 현장사진 업로드
- 견적서 작성 — 단가표 연동 + VAT 자동 계산 + 1초 debounce 자동저장
- 에스원 정산관리 (`/mellea/s1-settlement`) — 3탭(미정산/진행중/완료)
- 매입 관리 (`/mellea/billing`) — 삼성 구매/월별 요약/지출결의서
- 보관장비 관리 (`/mellea/stored-equipment`)
- 창고 관리 (`/mellea/warehouses`) — 카카오 지도 연동 (WIP)
- AS 관리 (`/as`) — 테이블 + 등록/상세
- 과거내역 패널 — 정산완료 발주 조회
- 사이드바 — 역할별 메뉴 필터링
- Supabase Auth 로그인 + 역할별 접근 제어

### 미구현
- 카카오 알림톡 연동
- 월별 정산 자동화 (견적+배송+설치비 합산)
