/**
 * 대시보드 — MeLEA 브랜드 로고 + 발주/AS 접수 카드
 * 교원그룹 담당자가 로그인 후 바로 행동할 수 있도록 직관적 카드 디자인
 */

import Link from 'next/link'
import { ClipboardList, Wrench, ArrowRight, Lightbulb } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="container mx-auto max-w-[860px] py-8 px-4 md:px-6 md:py-12 space-y-8 md:space-y-10">

      {/* ─── 로고/헤더 (간소화) ─── */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          {/* MeLEA 로고 — 약간 축소 */}
          <div className="inline-flex items-center rounded-lg px-3.5 py-2 shadow-md" style={{ backgroundColor: '#E09520' }}>
            <span className="font-extrabold text-lg leading-none" style={{ color: '#2D2519' }}>M</span>
            <span className="font-bold italic leading-none" style={{ color: '#FFFFFF', fontSize: '1.25rem', paddingRight: '1.5px' }}>e</span>
            <span className="font-extrabold text-lg leading-none" style={{ color: '#2D2519' }}>LEA</span>
          </div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800">교원그룹 에어컨 발주관리 시스템</h1>
        </div>
        <p className="text-sm text-slate-400">발주 접수부터 설치·정산까지 한 곳에서 관리합니다</p>
      </div>

      {/* ─── 바로가기 카드 ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">

        {/* 발주 접수 카드 */}
        <Link
          href="/orders?action=new"
          className="group flex flex-col items-center bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-6 md:p-8 hover:shadow-lg hover:border-carrot-400 hover:-translate-y-1 transition-all duration-200"
        >
          {/* 아이콘 (배경 원형, 64px) */}
          <div className="w-16 h-16 rounded-full bg-carrot-50 flex items-center justify-center mb-4 group-hover:bg-carrot-100 transition-colors">
            <ClipboardList className="h-8 w-8 text-carrot-500" />
          </div>

          {/* 제목 + 부제 */}
          <h3 className="text-xl font-bold text-slate-800 mb-1">발주 접수</h3>
          <p className="text-sm text-slate-400 mb-5">새 발주를 등록합니다</p>

          {/* CTA 버튼 */}
          <span className="inline-flex items-center gap-2 bg-carrot-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg group-hover:bg-carrot-600 transition-colors">
            발주 등록하기
            <ArrowRight className="h-4 w-4" />
          </span>

          {/* 주의사항 (카드 안 하단) */}
          <div className="w-full mt-6 pt-4 border-t border-slate-100">
            <div className="flex gap-2 items-start">
              <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-slate-500 leading-relaxed">
                사전견적은 다량 설치, 천정형, 복잡한 공사환경일 때만 요청해 주세요. 추가비용은 설치기사님이 현장에서 안내드립니다.
              </p>
            </div>
          </div>
        </Link>

        {/* AS 접수 카드 */}
        <Link
          href="/as?action=new"
          className="group flex flex-col items-center bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-6 md:p-8 hover:shadow-lg hover:border-teal-400 hover:-translate-y-1 transition-all duration-200"
        >
          {/* 아이콘 (배경 원형, 64px) */}
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
            <Wrench className="h-8 w-8 text-teal-500" />
          </div>

          {/* 제목 + 부제 */}
          <h3 className="text-xl font-bold text-slate-800 mb-1">AS 접수</h3>
          <p className="text-sm text-slate-400 mb-5">AS 요청을 등록합니다</p>

          {/* CTA 버튼 */}
          <span className="inline-flex items-center gap-2 bg-teal-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg group-hover:bg-teal-600 transition-colors">
            AS 등록하기
            <ArrowRight className="h-4 w-4" />
          </span>

          {/* 주의사항 (카드 안 하단) */}
          <div className="w-full mt-6 pt-4 border-t border-slate-100">
            <div className="flex gap-2 items-start">
              <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-slate-500 leading-relaxed">
                AS 접수 전 에어컨 차단기 리셋은 꼭 해주세요.
              </p>
            </div>
          </div>
        </Link>

      </div>

    </div>
  )
}
