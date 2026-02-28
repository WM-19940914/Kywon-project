/**
 * AS 관리 테이블 컴포넌트 (정렬 및 명칭 최적화 버전)
 */

'use client'

import type { ASRequest, ASRequestStatus } from '@/types/as'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { 
  MapPin, 
  } from 'lucide-react'
/** Props */
interface ASTableProps {
  requests: ASRequest[]
  activeTab: ASRequestStatus
  onRowClick: (req: ASRequest) => void
  onStatusChange?: (id: string, newStatus: ASRequestStatus) => void
  selectedIds?: Set<string>
  onSelectToggle?: (id: string) => void
  onSelectAll?: (checked: boolean) => void
}

/** 금액 포맷 */
function formatAmount(amount?: number): string {
  if (!amount || amount === 0) return '-'
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 정산월 포맷 */
function formatSettlementMonth(month?: string): string {
  if (!month) return '-'
  const parts = month.split('-')
  return parts.length < 2 ? month : `${parts[0]}년 ${parseInt(parts[1])}월`
}

export function ASTable({ requests, activeTab, onRowClick, onStatusChange, selectedIds, onSelectToggle, onSelectAll }: ASTableProps) {
  if (requests.length === 0) return null

  const allSelected = activeTab === 'completed' && selectedIds && requests.length > 0
    ? requests.every(r => selectedIds.has(r.id))
    : false

  return (
    <div className="overflow-x-auto overflow-y-visible">
      <table className="w-full min-w-[1250px] border-collapse text-left table-fixed">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            {activeTab === 'completed' && (
              <th className="w-10 px-2 py-4 text-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                  className="rounded-md border-slate-300 data-[state=checked]:bg-[#E09520] data-[state=checked]:border-[#E09520]"
                />
              </th>
            )}
            
            {/* 고정 컬럼 레이아웃 */}
            <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-28">접수일</th>
            <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-28 text-center">계열사</th>
            <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-44">사업자명</th>
            {activeTab === 'received' && (
              <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight min-w-[220px]">현장 주소</th>
            )}
            <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-36 text-center">접수자</th>
            
            {/* 상태별 중앙 컬럼 */}
            {activeTab === 'received' && (
              <>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-32">모델명</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-36">메모</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-28 text-center">정산예정월</th>
              </>
            )}
            
            {activeTab === 'in-progress' && (
              <>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-32 text-center">방문예정일</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-32 text-center">처리완료일</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-right w-28">삼성 AS 비용</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-right w-28">멜레아 접수비</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-36">메모</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-28 text-center">정산예정월</th>
              </>
            )}
            
            {activeTab === 'completed' && (
              <>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-28">모델명</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-32 text-center">처리완료일</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-right w-28">삼성 AS 비용</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-right w-28">멜레아 접수비</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-center w-32">소계</th>
              </>
            )}
            
            {activeTab === 'settled' && (
              <>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-28">모델명</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-44">AS 요청사유</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight w-32 text-center">처리완료일</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-right w-28">삼성 AS 비용</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-right w-28">멜레아 접수비</th>
                <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-center w-32">소계</th>
              </>
            )}

            {/* 관리 버튼 컬럼 (정산완료 제외) */}
            {activeTab !== 'settled' && (
              <th className="px-3 py-4 text-[12.5px] font-bold text-slate-500 uppercase tracking-tight text-center w-36">관리</th>
            )}
          </tr>
        </thead>
        
        <tbody className="divide-y divide-slate-100 bg-white">
          {requests.map((req) => (
            <tr
              key={req.id}
              className="group hover:bg-orange-50/20 transition-all duration-150 cursor-pointer"
              onClick={() => onRowClick(req)}
            >
              {activeTab === 'completed' && (
                <td className="px-2 py-4 text-center" onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds?.has(req.id) || false}
                    onCheckedChange={() => onSelectToggle?.(req.id)}
                    className="rounded-md border-slate-300 data-[state=checked]:bg-[#E09520] data-[state=checked]:border-[#E09520]"
                  />
                </td>
              )}

              {/* 1. 접수일 */}
              <td className="px-3 py-4 text-[13px] font-semibold text-slate-700 whitespace-nowrap">
                {req.receptionDate}
              </td>

              {/* 2. 계열사 — 중앙 정렬, 배경 제거 */}
              <td className="px-3 py-4 text-center">
                <span className="text-[12.5px] font-bold text-slate-600 truncate block">
                  {req.affiliate}
                </span>
              </td>

              {/* 3. 사업자명 */}
              <td className="px-3 py-4">
                <span className="text-[13.5px] font-bold text-slate-900 leading-tight block truncate">
                  {req.businessName}
                </span>
              </td>

              {/* 4. 현장 주소 (1단계에서만 노출) */}
              {activeTab === 'received' && (
                <td className="px-3 py-4">
                  <div className="flex items-start gap-1">
                    <MapPin className="h-3 w-3 text-slate-300 mt-0.5 shrink-0" />
                    <span className="text-[12px] text-slate-600 font-medium leading-tight line-clamp-2">
                      {req.address}
                    </span>
                  </div>
                </td>
              )}

              {/* 5. 접수자 — 중앙 정렬 */}
              <td className="px-3 py-4 text-center">
                <div className="flex flex-col items-center">
                  <div className="text-[12.5px] font-bold text-slate-700 truncate max-w-[120px]">
                    {req.contactName}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400">
                    {req.contactPhone}
                  </div>
                </div>
              </td>

              {/* [탭별 모델명/메모 데이터] */}
              {activeTab === 'received' && (
                <>
                  <td className="px-3 py-4 text-[12.5px] text-slate-600 font-bold truncate">
                    {req.modelName || '-'}
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-[11.5px] text-slate-400 font-medium italic truncate">
                      {req.notes || '-'}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-[11.5px] font-bold text-slate-600">
                      {formatSettlementMonth(req.settlementMonth)}
                    </span>
                  </td>
                </>
              )}

              {activeTab === 'in-progress' && (
                <>
                  <td className="px-3 py-4 text-center">
                    <span className="text-[12.5px] font-black text-orange-600 truncate block">
                      {req.visitDate || '미정'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-[12.5px] font-black text-slate-900 truncate block">
                      {req.processedDate || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="text-[13px] font-bold text-slate-700">{formatAmount(req.asCost)}</span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="text-[13px] font-bold text-slate-700">{formatAmount(req.receptionFee)}</span>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-[11.5px] text-slate-400 font-medium italic truncate">
                      {req.notes || '-'}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-[11.5px] font-bold text-slate-600">
                      {formatSettlementMonth(req.settlementMonth)}
                    </span>
                  </td>
                </>
              )}

              {activeTab === 'completed' && (
                <>
                  <td className="px-3 py-4 text-[12.5px] text-slate-600 font-bold truncate">
                    {req.modelName || '-'}
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-[12.5px] font-black text-slate-900">
                      {req.processedDate || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="text-[13px] font-bold text-slate-700">{formatAmount(req.asCost)}</span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="text-[13px] font-bold text-slate-700">{formatAmount(req.receptionFee)}</span>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="inline-flex flex-col items-center px-1">
                      <span className="text-[13.5px] font-black text-[#E09520]">
                        {formatAmount((req.asCost || 0) + (req.receptionFee || 0))}
                      </span>
                    </div>
                  </td>
                </>
              )}

              {activeTab === 'settled' && (
                <>
                  <td className="px-3 py-4 text-[12.5px] text-slate-600 font-bold truncate">
                    {req.modelName || '-'}
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-[12px] text-slate-600 font-medium leading-tight line-clamp-2">
                      {req.asReason || '-'}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-[12.5px] font-black text-slate-900">
                      {req.processedDate || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="text-[13px] font-bold text-slate-700">{formatAmount(req.asCost)}</span>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span className="text-[13px] font-bold text-slate-700">{formatAmount(req.receptionFee)}</span>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="inline-flex flex-col items-center px-2 py-1">
                      <span className="text-[13.5px] font-black text-[#E09520]">{formatAmount((req.asCost || 0) + (req.receptionFee || 0))}</span>
                    </div>
                  </td>
                </>
              )}

              {/* 관리 버튼 (정산완료 탭 제외) */}
              {activeTab !== 'settled' && (
                <td className="px-3 py-4 text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    {activeTab === 'received' && (
                      <Button 
                        size="sm" 
                        className="h-7 px-2 rounded-md bg-[#E09520] hover:bg-[#c87d1a] text-white font-black text-[11px] min-w-[65px]"
                        onClick={() => onStatusChange?.(req.id, 'in-progress')}
                      >
                        접수완료
                      </Button>
                    )}
                    {activeTab === 'in-progress' && (
                      <Button 
                        size="sm" 
                        className="h-7 px-2 rounded-md bg-[#E09520] hover:bg-[#c87d1a] text-white font-black text-[11px] min-w-[65px]"
                        onClick={() => onStatusChange?.(req.id, 'completed')}
                      >
                        처리완료
                      </Button>
                    )}
                    {activeTab === 'completed' && (
                      <Button 
                        size="sm" 
                        className="h-7 px-2 rounded-md bg-slate-800 hover:bg-slate-900 text-white font-black text-[11px] min-w-[65px]"
                        onClick={() => onStatusChange?.(req.id, 'settled')}
                      >
                        정산확정
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
