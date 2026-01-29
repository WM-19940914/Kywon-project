# 에어컨 설치 발주 관리 시스템

## 프로젝트 개요
- **목적**: 삼성전자 에어컨 설비 발주 접수 → 견적 → 정산까지 통합 관리
- **현재 문제**: 구식 웹사이트 + 엑셀 이중 작업으로 인한 비효율
- **해결 방안**: 현대적 웹 애플리케이션으로 원스톱 처리

---

## 기술 스택

### Frontend
- **Next.js 14** (App Router 방식)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (UI 컴포넌트 라이브러리)

### Backend & Database
- **Supabase** (PostgreSQL 기반)
  - Database: 발주 데이터 저장
  - Authentication: 로그인/회원가입
  - Storage: 견적서 PDF 파일 업로드
  - Real-time: 실시간 데이터 업데이트

### 배포
- **Vercel** (프론트엔드 호스팅)

---

## 프로젝트 구조

```
first/
├── app/                    # Next.js App Router 페이지
│   ├── (auth)/            # 로그인 관련
│   ├── orders/            # 발주 관련 페이지
│   ├── dashboard/         # 대시보드
│   └── layout.tsx
├── components/            # 재사용 가능한 컴포넌트
│   ├── ui/               # shadcn/ui 컴포넌트
│   └── orders/           # 발주 관련 컴포넌트
├── lib/                   # 유틸리티 함수
│   ├── supabase.ts       # Supabase 클라이언트
│   └── utils.ts
├── types/                 # TypeScript 타입 정의
└── public/               # 정적 파일
```

---

## 데이터 구조 (개략)

### 주요 관리 데이터
- **발주 정보**: 문서번호, 주소, 발주일, 주문번호, 시공업체, 진행상태
- **장비 정보**: 모델명, 실내기/실외기 수량, 특이사항
- **견적 정보**: 견적서 파일, 금액 (Phase 2)
- **사용자 정보**: 로그인 계정, 권한

> 📌 **참고**: 상세한 테이블 구조는 구현 단계에서 함께 설계합니다

---

## 코딩 규칙

### 1. 주석 작성 (매우 중요!)
- **모든 컴포넌트**: 상단에 용도 설명 주석
- **함수**: 파라미터와 리턴값 설명
- **복잡한 로직**: 단계별 설명 주석
- **API 호출**: 어떤 데이터를 가져오는지 명시

예시:
```typescript
/**
 * 발주 목록을 가져오는 함수
 * @param page - 현재 페이지 번호
 * @param limit - 한 페이지당 항목 수
 * @returns 발주 데이터 배열
 */
async function getOrders(page: number, limit: number) {
  // Supabase에서 발주 목록 조회
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .range((page - 1) * limit, page * limit - 1)

  return data
}
```

### 2. 컴포넌트 작성
- **클라이언트 컴포넌트**: 'use client' 명시
- **서버 컴포넌트**: 기본값 (App Router)
- **파일명**: kebab-case (order-list.tsx)
- **컴포넌트명**: PascalCase (OrderList)

### 3. Supabase 사용
- **환경변수**: .env.local에 API 키 저장
- **타입 안전성**: TypeScript 타입 정의 활용
- **에러 처리**: 모든 DB 호출에 try-catch

---

## Phase별 구현 계획

### Phase 1: MVP (현재 목표)
- [ ] 발주 접수 페이지
- [ ] 발주 목록 대시보드
- [ ] 검색/필터링 기능
- [ ] 로그인/회원가입

### Phase 2: 확장 기능
- [ ] 견적서 업로드 (PDF)
- [ ] 월별 정산 페이지
- [ ] 엑셀 다운로드

### Phase 3: 고급 기능
- [ ] 설치 사진 업로드
- [ ] 권한 관리
- [ ] 알림 기능

---

## 개발 원칙

### 사용자 배경 고려
- **초보 개발자 친화적**: 코드에 자세한 한글 주석
- **단계별 구현**: 한 번에 하나씩 기능 추가
- **에러 설명**: 에러 발생 시 원인과 해결 방법 명시

### 주의사항
- **데이터 보안**: Supabase Row Level Security 활용
- **파일 업로드**: 용량 제한 설정
- **날짜 처리**: 한국 시간대(KST) 사용
