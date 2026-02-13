/**
 * 대시보드 — MeLEA 브랜드 로고 + 바로가기 버튼
 */

import Link from 'next/link'
import { ClipboardList, Wrench, ChevronRight } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="container mx-auto max-w-[800px] py-8 px-4 md:px-6 space-y-8">

      {/* ─── 로고/헤더 ─── */}
      <div className="text-center space-y-3 pb-2">
        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-xl px-5 py-3 shadow-lg" style={{ backgroundColor: '#E09520' }}>
            <span className="font-extrabold text-2xl leading-none" style={{ color: '#2D2519' }}>M</span>
            <span className="font-bold italic leading-none" style={{ color: '#FFFFFF', fontSize: '1.6rem', paddingRight: '2px' }}>e</span>
            <span className="font-extrabold text-2xl leading-none" style={{ color: '#2D2519' }}>LEA</span>
          </div>
        </div>
        <h1 className="text-xl font-bold text-slate-800">교원그룹 에어컨 발주관리 시스템</h1>
        <p className="text-sm text-slate-400">발주 접수부터 설치·정산까지 한 곳에서 관리합니다</p>
      </div>

      {/* ─── 바로가기 버튼 ─── */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/orders?action=new"
          className="group flex items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-orange-300 transition-all"
        >
          <div className="bg-orange-50 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <ClipboardList className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">발주 접수</h3>
            <p className="text-xs text-slate-400">새 발주 등록하기</p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
        </Link>

        <Link
          href="/as?action=new"
          className="group flex items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-blue-300 transition-all"
        >
          <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <Wrench className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AS 접수</h3>
            <p className="text-xs text-slate-400">AS 요청 등록하기</p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
        </Link>
      </div>

    </div>
  )
}
