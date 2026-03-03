


## 개발자 배경 및 작업 가이드 (중요)

- 이 프로젝트의 요청자는 비전공자입니다.
- 코드 한 줄도 읽지 못하며, 영어를 이해하지 못합니다.
- 개발 개념(로직, 상태관리, 비동기, 타입 등)에 대한 배경지식이 없습니다.
- 따라서 모든 수정 및 추가 작업은 아래 기준을 반드시 따릅니다.

### 코드 작성 규칙

1. 반드시 한글 주석을 매우 자세하게 작성합니다.
   - "왜 이 코드를 쓰는지"
   - "무슨 역할을 하는지"
   - "수정하면 어떤 영향이 있는지"
   를 설명합니다.

2. 기존 로직을 함부로 리팩토링하지 않습니다.
   - 요청한 부분만 최소 수정합니다.
   - 구조 변경이 필요하면 먼저 설명 후 진행합니다.

3. 코드를 생략하지 않습니다.
   - "기존 코드 유지" 같은 말 대신 전체 수정 파일을 제공합니다.

4. 초보자 기준으로 설명합니다.
   - 개발 용어는 사용하지 않거나,
   - 사용 시 반드시 한글로 풀어서 설명합니다.

5. 파일 위치를 정확히 명시합니다.
   예:  
   app/dashboard/orders/page.tsx 수정

6. Supabase, 환경변수, 권한, 마이그레이션 관련 수정은
   무엇을 왜 바꾸는지 단계별로 설명합니다.

7. 에러가 날 가능성이 있는 부분은
   "왜 에러가 나는지 + 어떻게 해결하는지" 함께 설명합니다.

8. UI 수정 시:
   - 수정 전 / 수정 후 동작 차이를 설명합니다.
   - 영향받는 화면 경로를 명시합니다.

9. 절대 영어로 설명하지 않습니다.

10. 코드 외에도
    - "이 작업의 전체 흐름"
    - "지금 이 작업이 프로젝트에서 어떤 의미인지"
    를 같이 설명합니다.


# Repository Guidelines

## 프로젝트 구조 및 모듈 구성
- `app/`: Next.js App Router 라우트. 주요 화면은 `(dashboard)`와 `login`에 분리되어 있습니다.
- `components/`: 도메인별 UI (`orders`, `delivery`, `billing`, `stored-equipment`)와 공통 UI(`components/ui`)를 관리합니다.
- `lib/`: 비즈니스 로직과 외부 연동 코드(`lib/supabase/*`, 인증/권한, PDF/엑셀 유틸)를 둡니다.
- `types/`: 공유 TypeScript 타입 정의를 관리합니다.
- `supabase/`: 마이그레이션 SQL 파일을 순서대로 저장합니다.
- `scripts/`: 데이터 파싱/가공/내보내기용 일회성 실행 스크립트입니다.
- `public/`: 정적 에셋(폰트 포함)을 보관합니다.

## 빌드, 테스트, 개발 명령어
- `npm run dev`: 로컬 개발 서버 실행.
- `npm run build`: 프로덕션 빌드 생성(타입/프레임워크 검사 포함).
- `npm run start`: 빌드 결과 실행.
- `npm run lint`: ESLint(Next.js 규칙) 검사.
- 스크립트 예시: `node scripts/parse-excel.js`, `node scripts/export-price-table.js`.

## 코딩 스타일 및 네이밍 규칙
- 기본 스택은 TypeScript + React + Next.js 14(App Router)입니다.
- 들여쓰기는 2칸을 유지하고, 기존 TS/TSX 파일의 세미콜론/문자열 스타일을 따릅니다.
- 파일명은 `kebab-case`(예: `delivery-price-table-sheet.tsx`)를 사용합니다.
- 컴포넌트/타입은 PascalCase, 변수/함수는 camelCase를 사용합니다.
- 경로는 깊은 상대경로보다 `@/*` 별칭 import를 우선합니다.
- 재사용 가능한 UI는 `components/ui`, 도메인 로직은 각 기능 폴더 또는 `lib/`에 배치합니다.

## 테스트 가이드
- 현재 `package.json`에 전용 단위테스트 스크립트는 없습니다.
- PR 전 최소 검증: `npm run lint`와 `npm run build`.
- 기능 변경 시 영향 라우트(예: `/dashboard/orders`, `/dashboard/mellea/delivery`)의 수동 검증 결과를 PR에 기록합니다.
- 자동 테스트를 추가할 때는 `*.test.ts` 또는 `*.test.tsx` 네이밍을 사용합니다.

## 커밋 및 Pull Request 가이드
- 커밋 메시지는 기존 이력처럼 짧고 명확하게 작성하고, 필요 시 접두사(`feat:`, `bugfix:`, `ui:`)를 사용합니다.
- 커밋은 한 가지 논리 변경 단위로 분리하고, 영향 영역(예: 정산, 배송, 빌드)을 제목에 드러냅니다.
- PR에는 목적, 변경 파일/라우트, `supabase/` SQL 변경사항, 환경변수 변경 여부, UI 변경 스크린샷, lint/build 결과를 포함합니다.

## 보안 및 설정 팁
- `.env.local`과 서비스 롤 키는 절대 커밋하지 않습니다.
- 환경변수 키는 `.env.example`과 동일하게 유지합니다.
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_KAKAO_MAP_KEY`)
- Supabase Storage 정책과 SQL 마이그레이션은 운영 반영 전 최소 권한 원칙으로 검토합니다.


---