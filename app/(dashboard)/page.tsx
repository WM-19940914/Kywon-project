/**
 * 브랜드 웰컴 페이지 (메인 홈)
 *
 * 로그인 첫 화면 — 시스템 데이터(건수/금액) 없이
 * MeLEA 브랜드 로고 + 바로가기 카드로 구성된 깔끔한 랜딩 페이지
 *
 * - DB 조회 없음 (서버 컴포넌트, 정적 렌더링)
 * - 사이드바 메뉴와 동일한 역할 그룹별 바로가기 카드
 * - 반응형: 데스크톱 3~4열 / 모바일 2열 → 1열
 */

import Link from 'next/link'
import {
  ClipboardList,
  Wrench,
  Archive,
  FileText,
} from 'lucide-react'

/** 바로가기 카드 하나의 타입 */
interface QuickLinkCard {
  title: string       // 메뉴명
  description: string // 한 줄 설명
  href: string        // 이동할 경로
  icon: React.ElementType
  iconColor: string   // 아이콘 텍스트 색상
  iconBg: string      // 아이콘 배경 색상
}

/** 카드 그룹 (역할별) */
interface CardGroup {
  groupTitle: string
  cards: QuickLinkCard[]
}

/** 바로가기 카드 데이터 (교원그룹) */
const cardGroups: CardGroup[] = [
  {
    groupTitle: '교원그룹',
    cards: [
      {
        title: '신규 발주',
        description: '에어컨 설치 발주 접수하기',
        href: '/orders?action=new',
        icon: ClipboardList,
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-50',
      },
      {
        title: 'AS 접수',
        description: 'AS 요청 접수하기',
        href: '/as?action=new',
        icon: Wrench,
        iconColor: 'text-slate-500',
        iconBg: 'bg-slate-100',
      },
      {
        title: '철거보관 장비',
        description: '철거 후 보관 중인 장비 조회',
        href: '/kyowon/stored-equipment',
        icon: Archive,
        iconColor: 'text-violet-600',
        iconBg: 'bg-violet-50',
      },
      {
        title: '단가표',
        description: '교원 전용 장비 단가 조회',
        href: '/kyowon/price-table',
        icon: FileText,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50',
      },
    ],
  },
]

export default function WelcomePage() {

  return (
    <div className="container mx-auto max-w-[1200px] py-8 px-4 md:px-6 space-y-10">

      {/* ─── 바로가기 카드 (역할 그룹별) ─── */}
      <div className="space-y-8">
        {cardGroups.map((group) => (
          <div key={group.groupTitle}>
            {/* 그룹 소제목 */}
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
              {group.groupTitle}
            </h2>

            {/* 카드 그리드: 모바일 2열 → md 3열 → lg 4열 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {group.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 hover:shadow-md hover:border-slate-300 transition-all"
                >
                  {/* 아이콘 */}
                  <div className={`${card.iconBg} w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>

                  {/* 메뉴명 */}
                  <h3 className="text-sm font-bold text-slate-800 mb-0.5">
                    {card.title}
                  </h3>

                  {/* 한 줄 설명 */}
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {card.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ─── 3. 하단 안내 ─── */}
      <div className="text-center pb-4">
        <p className="text-xs text-slate-300">
          에어컨 설치 발주 관리 시스템
        </p>
      </div>
    </div>
  )
}
