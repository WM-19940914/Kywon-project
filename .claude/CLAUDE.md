# 에어컨 설치 발주 관리 시스템 (멜레아)

## 프로젝트 개요
- **목적**: 교원그룹 전국 에어컨 발주 접수 → 장비 배송 → 설치 → 견적 → 정산까지 원스톱 관리
- **현재 문제**: 엑셀 + 전화 + 카톡으로 흩어진 업무를 수작업으로 처리하는 비효율
- **해결 방안**: 각 역할(교원/멜레아/에스원)이 한 곳에서 입력하면 나머지가 자동 연결되는 웹앱
- **사용자**: 개발 완전 초보자 — 코드 설명은 한글로 친절하게

---

## 사용자 역할별 업무

| 사용자 | 주요 업무 |
|--------|----------|
| **교원그룹** | 발주 접수, AS 요청 |
| **멜레아 (본인)** | 견적서 작성, 삼성 장비 발주, 배송 추적, 재고/보관장비 관리, 월별 정산 |
| **에스원ENG (설치팀)** | 설치일정 입력, 설치비 입력 |
| **경영팀** | 정산 자료 확인/승인 |

---

## 핵심 업무 흐름

```
교원그룹 발주 접수 (orders)
  │
  ├─ 신규설치 → 삼성에 장비 발주 → 배송관리(발주대기→배송중→입고완료)
  │                                    └─ 입고 시 창고 재고에 자동 반영
  ├─ 철거보관 → 보관장비 관리 (어느 창고에 보관중인지 추적)
  │
  ├─ 견적서 작성 (판매가) + 장비비/설치비 입력 (원가) → 마진 자동 계산
  │
  ├─ 에스원 설치일정 입력 + 설치비 엑셀 대신 직접 입력
  │
  └─ 설치 완료 → 월별 정산지 자동 생성 (경영팀 자료 제출)
```

---

## 기술 스택

### Frontend
- **Next.js 14** (App Router 방식)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (UI 컴포넌트 라이브러리)

### Backend & Database (추후 연동)
- **Supabase** (PostgreSQL 기반)
  - Database: 관계형 데이터 저장
  - Authentication: 역할별 로그인
  - Storage: 견적서 PDF 업로드
  - Real-time: 실시간 업데이트

### 배포
- **Vercel** (프론트엔드 호스팅)

---

## 현재 구현 상태 (2026-02-06 기준)

### 구현 완료
- [x] **발주 관리** (`/orders`) — 칸반보드 + 발주 등록/수정/상세 + 발주취소 기능
- [x] **배송 관리** (`/mellea/delivery`) — 테이블 리스트 + 아코디언 구성품 상세
  - 상태 탭: 발주대기(기본) / 배송중 / 입고완료
  - 구성품별 개별 주문번호 관리
  - 매입처 뱃지 표시 (기본: 삼성전자)
  - 모델명: 구성품명 + 부품모델명 (SET모델은 미표시)
  - SET 모델 구성품 좌측 세로 컬러바 그룹핑
- [x] **재고 관리** (`/mellea/inventory`) — 창고별 재고 현황 + 재고이벤트(입고/출고) 기록
- [x] **설치 관리** (`/mellea/schedule`) — 설치일정 테이블 + 설치완료 탭
- [x] **연간 단가표** (`/price-table`) — SET 모델 + 구성품 조회
- [x] **견적서 작성** — 장비/설치비 입력 + 단가표 연동 + 단위절사/VAT 자동 계산 + 실시간 자동저장
- [x] **에스원 정산관리** (`/mellea/s1-settlement`) — 멜레아↔에스원 월별 설치비 정산
  - 3탭 구조: 미정산 / 정산 진행중 / 정산 완료
  - 체크박스 일괄 상태 변경, 개별 되돌리기
- [x] **과거내역 패널** — 정산완료된 발주 조회
- [x] **사이드바 메뉴** — 역할 그룹별 메뉴 배치 (교원/멜레아/에스원/공통)
- [x] **Supabase DB 연동** — 테이블 생성 SQL, DAL 함수 구현 완료

### 미구현 (추후 작업)
- [ ] **AS 관리** (`/as`) — 메뉴만 배치 (준비중)
- [ ] **설치비 관리** (`/mellea/install-cost`) — 메뉴만 배치 (준비중)
- [ ] **배송정보 입력/수정 모달** 개선 — 구성품별 개별 주문번호 체계에 맞게 수정
- [ ] **카카오 알림톡** — 발주접수/배송완료/일정확인 등 알림 (카카오 비즈니스 채널)
- [ ] **역할별 권한 제어** — 멜레아/에스원/교원 각자 화면만 접근
- [ ] **카카오 지도 API** — 창고 위치 지도 표시 (현재 SVG)
- [ ] **월별 정산 자동화** — 견적+배송+설치비 데이터 합산 → 정산지 자동 생성

---

## 데이터 구조 (Supabase 설계 예정)

### 핵심 테이블 관계
```
orders (발주) ─┬─ order_items (발주 내역, 1:N)
               ├─ equipment_items (구성품/배송 정보, 1:N)
               ├─ installation_costs (설치비, 1:N)
               └─ customer_quotes → quote_items (견적서, 1:1:N)

warehouses (창고 목록)
warehouse_inventory (창고별 재고 — 입고/출고 기록)
stored_equipment (철거보관 장비 — 어느 창고, 언제부터)
settlements (월별 정산)
```

### 주요 타입 (types/order.ts)
- `Order` — 발주 정보 (중심 테이블)
- `OrderItem` — 발주 내역 (작업종류/품목/모델/수량)
- `EquipmentItem` — 구성품별 배송 정보 (주문번호/배송상태/창고/매입처 개별 관리)
- `InstallationCost` — 설치비 항목
- `CustomerQuote` — 소비자용 견적서 (원가 미포함)
- `DeliveryStatus` — 배송상태 (pending/in-transit/delivered)
- `OrderStatus` — 진행상태 (received/in-progress/completed/settled)

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

---

## 최근 작업 로그

### 오늘 완료한 작업
- **배송관리 탭별 안내 문구 추가** (`app/(dashboard)/mellea/delivery/page.tsx`)
  - 발주대기 / 배송중 / 입고완료 각 탭 클릭 시 해당 탭 설명 문구 1줄 표시
  - 발주대기 탭에 MeLEA 브랜드 로고 뱃지 삽입 (인라인 스타일)
    - 오렌지 배경(`#E09520`) + M/LEA 다크(`#2D2519`) + e 화이트 이탤릭
    - "이 페이지는 멜레아가 관리하는 공간"임을 시각적으로 전달
  - 안내 문구 내용:
    - 발주대기: `[MeLEA 뱃지] 삼성전자에 주문을 넣기 전 단계입니다. 구성품별 주문번호와 배송일정을 입력하세요.`
    - 배송중: `삼성전자에서 출발한 장비입니다. 설치팀은 입고 일정을 확인하세요.`
    - 입고완료: `창고에 입고 완료된 장비입니다.`

### MeLEA 브랜드 로고 스타일 가이드
- **배경색**: `#E09520` (오렌지)
- **M, LEA 글자색**: `#2D2519` (다크 브라운), `font-extrabold`, `text-sm`
- **e 글자색**: 화이트, 이탤릭, `fontSize: 1rem` (M/LEA보다 살짝 큼)
- **e 간격**: `paddingRight: 1.5px`로 L과의 간격 확보
- **뱃지 형태**: `px-3 py-1.5 rounded-md shadow-sm`

### 2026-02-01 작업 내용
- **SET 모델 구성품 좌측 세로 컬러바 그룹핑** (`components/delivery/delivery-table.tsx`)
  - `SET_GROUP_COLORS` 6색 순환 (blue, violet, emerald, amber, pink, cyan)
  - `computeSetModelGroups()` 함수: 연속된 같은 setModel 행을 그룹으로 묶어 색상 할당
  - 모델명 셀(`<td>`) 좌측에 `borderLeft: 4px solid {color}` 적용 (데스크톱)
  - 모바일 카드는 카드 전체 좌측 borderLeft 적용
  - setModel 없는 수동 입력 행은 컬러바 없음
- **단가표 Sheet SET 모델명 전달** (`components/delivery/delivery-price-table-sheet.tsx`)
  - `onSelectSet` 콜백에 `setModel` 파라미터 추가
  - SET 선택 시 각 구성품에 `setModel` 필드 자동 저장
- **아코디언 우측 삭제 버튼 제거** — 좌측 삭제 버튼만 유지
- **행추가 버튼 개선** — `행추가` / `3행 추가[스탠드]` / `4행 추가[벽걸이]`

### 2026-02-03 작업 내용
- **사이드바 메뉴명 변경** (`lib/menu-items.ts`)
  - `설치 관리/ 견적 및 정산 관리` → `설치 관리/견적 관리`
- **에스원 정산관리 페이지 신규 생성** (`app/(dashboard)/mellea/s1-settlement/page.tsx`)
  - 멜레아 ↔ 에스원(설치팀) 간 월별 설치비 정산 관리
  - 3탭 구조: 미정산 / 정산 진행중 / 정산 완료
  - 월 선택기 (설치완료일 기준 YYYY-MM 필터)
  - 체크박스 일괄 상태 변경 (미정산→진행중, 진행중→완료)
  - 개별 되돌리기 (진행중→미정산)
  - 통계 카드: 건수, 설치비 합계, 전체 현황
  - 정산 업무: 매달 20~29일경 진행, 애매한 건은 미정산에 남김
- **설치완료 탭에 정산 상태 열 추가** (`components/schedule/schedule-table.tsx`)
  - 설치완료 탭에서만 견적서 열 옆에 정산 뱃지 표시
  - 미정산(회색) / 진행중(주황) / 완료(초록)
  - 데스크톱 테이블 + 모바일 카드 모두 적용
- **타입 추가** (`types/order.ts`)
  - `S1SettlementStatus` 타입: `'unsettled' | 'in-progress' | 'settled'`
  - `S1_SETTLEMENT_STATUS_LABELS`, `S1_SETTLEMENT_STATUS_COLORS` 상수
  - Order에 `s1SettlementStatus`, `s1SettlementMonth` 필드 추가
- **DAL 함수 추가** (`lib/supabase/dal.ts`)
  - `updateS1SettlementStatus()` — 개별 정산 상태 변경
  - `batchUpdateS1SettlementStatus()` — 일괄 정산 상태 변경
- **사이드바 메뉴 추가** — "멜레아 · 에스원" 그룹에 에스원 정산관리 메뉴 (Receipt 아이콘)
- **shadcn checkbox 컴포넌트 설치** (`components/ui/checkbox.tsx`)

### 2026-02-03 야간 작업 내용
- **설치관리 테이블 열너비 고정** (`components/schedule/schedule-table.tsx`)
  - `table-layout: fixed` 적용, `min-w-[1450px]`
  - 설치예정일(편집) 열 120px, 현장명 180px, 현장주소 180px 등 재조정
  - 장비 상태 열을 견적서 옆(설치 상태 왼쪽)으로 이동
  - 견적서 버튼 컴팩트 세로 레이아웃 (80px)
  - DateInput 글자 크기 축소 (`!text-[10px]`, `max-w-[120px]`)
- **견적서 실시간 자동저장** (`components/quotes/quote-create-dialog.tsx`)
  - 저장 버튼 제거 → 1초 debounce 자동저장
  - 하단에 "입력 시 자동 저장" / "저장 중..." / "자동 저장됨" 상태 표시
  - 바깥 클릭 시 닫힘 방지 (`onInteractOutside`)
  - 우측 상단 X 닫기 버튼 추가
- **발주 등록 주소검색 개선** (`components/orders/order-form.tsx`)
  - 상세주소 자동채움(건물명/법정동) 제거 → 빈 칸 유지

### 2026-02-04 작업 내용
- **MCP 서버 설정** (`.cursor/mcp.json`)
  - Supabase, Context7, GitHub 3개 서버 연동
- **Claude 에이전트/명령어 추가**
  - `.claude/agents/supabase-helper.md` — DB 작업 전문 에이전트
  - `.claude/agents/ui-reviewer.md` — UI 검수 에이전트
  - `.claude/commands/commit.md` — 한글 커밋 자동 생성
  - `.claude/commands/deploy.md` — 배포 전 점검

### 2026-02-05 작업 내용
- **발주취소 기능** (`components/orders/order-detail-dialog.tsx`)
  - 발주 상세에서 취소 버튼 추가
  - 취소된 발주는 별도 상태로 관리
- **재고관리 페이지 신규** (`app/(dashboard)/mellea/inventory/page.tsx`)
  - 창고별 재고 현황 조회
  - `inventory-warehouse-view.tsx` 컴포넌트 (575줄)
- **재고이벤트 테이블** (`supabase/001_create_tables.sql`)
  - 입고/출고 기록 추적 테이블 추가
- **배송관리 버튼 정리** (`components/delivery/delivery-table.tsx`)
  - UI 개선, 버튼 배치 정리
- **과거내역 패널 개선** (`components/orders/settled-history-panel.tsx`)
  - 정산완료된 발주 조회 기능 강화
- **데이터 임포트 스크립트**
  - `scripts/import-orders.js` — 발주 데이터 일괄 임포트
  - `scripts/create-template.js` — 임포트용 템플릿 생성
- **DAL 함수 대폭 확장** (`lib/supabase/dal.ts`)
  - 재고 관련 CRUD 함수 추가 (178줄+)

### 이어서 할 작업 (미정)
- 배송중/입고완료 탭에도 MeLEA 또는 역할별 로고 뱃지 추가 검토
- 배송정보 입력/수정 모달 개선
- 실제 운영 데이터 임포트 및 테스트
