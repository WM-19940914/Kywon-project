/**
 * AS 관리 테이블 컴포넌트
 *
 * 탭별로 다른 컬럼을 표시합니다:
 *   AS접수: 접수일 / 계열사 / 사업자명 / 주소 / 담당자 / 연락처 / AS사유
 *   AS처리중: 접수일 / 사업자명 / 삼성AS센터 / AS기사 / 방문예정일 / 총금액
 *   정산대기: 체크박스 / 접수일 / 계열사 / 사업자명 / 담당자 / 모델명 / AS사유 / 처리일 / AS비용 / 접수비 / 처리내역 / 합계 / 정산년월
 *   정산완료: 접수일 / 계열사 / 사업자명 / 담당자 / 모델명 / AS사유 / 처리일 / AS비용 / 접수비 / 처리내역 / 합계 / 정산년월
 */

'use client'

import type { ASRequest, ASRequestStatus } from '@/types/as'
import { AS_STATUS_LABELS, AS_STATUS_COLORS } from '@/types/as'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

/** Props */
interface ASTableProps {
  requests: ASRequest[]
  activeTab: ASRequestStatus
  onRowClick: (req: ASRequest) => void
  /** 정산대기 탭: 선택된 ID 목록 */
  selectedIds?: Set<string>
  /** 정산대기 탭: 개별 체크박스 토글 */
  onSelectToggle?: (id: string) => void
  /** 정산대기 탭: 전체 선택/해제 */
  onSelectAll?: (checked: boolean) => void
}

/** 날짜 포맷 (YYYY-MM-DD 그대로 표시) */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  return dateStr
}

/** 금액 포맷 */
function formatAmount(amount?: number): string {
  if (!amount || amount === 0) return '-'
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 정산월 포맷 ("2026-02" → "2026년 2월") */
function formatSettlementMonth(month?: string): string {
  if (!month) return '-'
  const parts = month.split('-')
  if (parts.length < 2) return month
  return `${parts[0]}년 ${parseInt(parts[1])}월`
}

export function ASTable({ requests, activeTab, onRowClick, selectedIds, onSelectToggle, onSelectAll }: ASTableProps) {
  if (requests.length === 0) return null

  // 정산대기 탭에서 전체 선택 여부
  const allSelected = activeTab === 'completed' && selectedIds
    ? requests.every(r => selectedIds.has(r.id))
    : false

  return (
    <>
      {/* ===== 데스크톱 테이블 ===== */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <table className="w-full" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
          <thead className="bg-muted/80">
            {/* 탭별 다른 헤더 */}
            {activeTab === 'received' && (
              <tr>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '90px' }}>접수일</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '80px' }}>계열사</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '140px' }}>사업자명</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '140px' }}>주소</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '65px' }}>담당자</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '115px' }}>연락처</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '140px' }}>AS사유</th>
              </tr>
            )}
            {activeTab === 'in-progress' && (
              <tr>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '90px' }}>접수일</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '80px' }}>계열사</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '130px' }}>사업자명</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '110px' }}>삼성AS센터</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '70px' }}>AS기사</th>
                <th className="text-center p-2.5 text-sm font-medium text-brick-600" style={{ width: '90px' }}>방문예정일</th>
                <th className="text-left p-2.5 text-sm font-medium" style={{ width: '140px' }}>처리내역</th>
                <th className="text-right p-2.5 text-sm font-medium" style={{ width: '80px' }}>AS비용</th>
                <th className="text-right p-2.5 text-sm font-medium" style={{ width: '70px' }}>접수비</th>
                <th className="text-right p-2.5 text-sm font-medium" style={{ width: '120px' }}>합계(부가세별도)</th>
              </tr>
            )}
            {activeTab === 'completed' && (
              <tr>
                {/* 전체 선택 체크박스 */}
                <th className="p-2.5 text-center" style={{ width: '40px' }}>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                  />
                </th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '90px' }}>접수일</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '80px' }}>계열사</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '120px' }}>사업자명</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '65px' }}>담당자</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '80px' }}>모델명</th>
                <th className="text-left p-2.5 text-xs font-medium">AS사유</th>
                <th className="text-center p-2.5 text-xs font-medium" style={{ width: '90px' }}>처리일</th>
                <th className="text-right p-2.5 text-xs font-medium" style={{ width: '75px' }}>AS비용</th>
                <th className="text-right p-2.5 text-xs font-medium" style={{ width: '65px' }}>접수비</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '120px' }}>처리내역</th>
                <th className="text-right p-2.5 text-xs font-medium" style={{ width: '110px' }}>합계(부가세별도)</th>
                <th className="text-center p-2.5 text-xs font-medium" style={{ width: '80px' }}>정산년월</th>
              </tr>
            )}
            {activeTab === 'settled' && (
              <tr>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '90px' }}>접수일</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '80px' }}>계열사</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '120px' }}>사업자명</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '65px' }}>담당자</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '80px' }}>모델명</th>
                <th className="text-left p-2.5 text-xs font-medium">AS사유</th>
                <th className="text-center p-2.5 text-xs font-medium" style={{ width: '90px' }}>처리일</th>
                <th className="text-right p-2.5 text-xs font-medium" style={{ width: '75px' }}>AS비용</th>
                <th className="text-right p-2.5 text-xs font-medium" style={{ width: '65px' }}>접수비</th>
                <th className="text-left p-2.5 text-xs font-medium" style={{ width: '120px' }}>처리내역</th>
                <th className="text-right p-2.5 text-xs font-medium" style={{ width: '110px' }}>합계(부가세별도)</th>
                <th className="text-center p-2.5 text-xs font-medium" style={{ width: '80px' }}>정산년월</th>
              </tr>
            )}
          </thead>
          <tbody>
            {requests.map(req => (
              <tr
                key={req.id}
                className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer"
                onClick={() => onRowClick(req)}
              >
                {/* === AS접수 탭 === */}
                {activeTab === 'received' && (
                  <>
                    <td className="p-2.5 text-sm whitespace-nowrap">{formatDate(req.receptionDate)}</td>
                    <td className="p-2.5 text-sm text-gray-600 truncate">{req.affiliate || '-'}</td>
                    <td className="p-2.5"><p className="text-sm font-semibold truncate">{req.businessName}</p></td>
                    <td className="p-2.5"><p className="text-xs text-gray-500 truncate" title={`${req.address || ''}${req.detailAddress ? ', ' + req.detailAddress : ''}`}>{req.address || '-'}{req.detailAddress ? `, ${req.detailAddress}` : ''}</p></td>
                    <td className="p-2.5 text-sm text-gray-600 truncate">{req.contactName || '-'}</td>
                    <td className="p-2.5 text-sm text-gray-600 whitespace-nowrap">{req.contactPhone || '-'}</td>
                    <td className="p-2.5"><p className="text-sm text-gray-600 truncate" title={req.asReason || ''}>{req.asReason || '-'}</p></td>
                  </>
                )}

                {/* === AS처리중 탭 === */}
                {activeTab === 'in-progress' && (
                  <>
                    <td className="p-2.5 text-sm whitespace-nowrap">{formatDate(req.receptionDate)}</td>
                    <td className="p-2.5 text-sm text-gray-600 truncate">{req.affiliate || '-'}</td>
                    <td className="p-2.5"><p className="text-sm font-semibold truncate">{req.businessName}</p></td>
                    <td className="p-2.5 text-sm text-gray-600 truncate">{req.samsungAsCenter || '-'}</td>
                    <td className="p-2.5 text-sm text-gray-600 truncate">{req.technicianName || '-'}</td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      {req.visitDate ? (
                        <span className="text-sm font-bold text-brick-600">{formatDate(req.visitDate)}</span>
                      ) : (
                        <span className="text-sm text-gray-400">미정</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      {req.processingDetails
                        ? <p className="text-sm text-gray-500 truncate">{req.processingDetails}</p>
                        : <span className="text-sm text-gray-400">-</span>
                      }
                    </td>
                    <td className="p-2.5 text-right text-sm text-gray-600 whitespace-nowrap">
                      {req.asCost ? formatAmount(req.asCost) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="p-2.5 text-right text-sm text-gray-600 whitespace-nowrap">
                      {req.receptionFee ? formatAmount(req.receptionFee) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="p-2.5 text-right text-sm font-bold text-teal-700 whitespace-nowrap">
                      {req.totalAmount ? formatAmount(req.totalAmount) : <span className="text-sm text-gray-400 font-normal">-</span>}
                    </td>
                  </>
                )}

                {/* === 정산대기 탭 (체크박스 포함) === */}
                {activeTab === 'completed' && (
                  <>
                    <td className="p-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds?.has(req.id) || false}
                        onCheckedChange={() => onSelectToggle?.(req.id)}
                      />
                    </td>
                    <td className="p-2.5 text-xs whitespace-nowrap">{formatDate(req.receptionDate)}</td>
                    <td className="p-2.5 text-xs text-gray-600 truncate">{req.affiliate || '-'}</td>
                    <td className="p-2.5"><p className="text-xs font-semibold truncate">{req.businessName}</p></td>
                    <td className="p-2.5 text-xs text-gray-600 truncate">{req.contactName || '-'}</td>
                    <td className="p-2.5 text-xs text-gray-600 truncate">{req.modelName || '-'}</td>
                    <td className="p-2.5"><p className="text-xs text-gray-600 truncate" title={req.asReason || ''}>{req.asReason || '-'}</p></td>
                    <td className="p-2.5 text-center text-xs whitespace-nowrap">{formatDate(req.processedDate)}</td>
                    <td className="p-2.5 text-right text-xs text-gray-600 whitespace-nowrap">{formatAmount(req.asCost)}</td>
                    <td className="p-2.5 text-right text-xs text-gray-600 whitespace-nowrap">{formatAmount(req.receptionFee)}</td>
                    <td className="p-2.5"><p className="text-xs text-gray-500 truncate" title={req.processingDetails || ''}>{req.processingDetails || '-'}</p></td>
                    <td className="p-2.5 text-right text-xs font-bold text-teal-700 whitespace-nowrap">{formatAmount(req.totalAmount)}</td>
                    <td className="p-2.5 text-center">
                      <span className="text-xs font-medium text-gray-700">{formatSettlementMonth(req.settlementMonth)}</span>
                    </td>
                  </>
                )}

                {/* === 정산완료 탭 (정산대기와 동일 열, 체크박스 없음) === */}
                {activeTab === 'settled' && (
                  <>
                    <td className="p-2.5 text-xs whitespace-nowrap">{formatDate(req.receptionDate)}</td>
                    <td className="p-2.5 text-xs text-gray-600 truncate">{req.affiliate || '-'}</td>
                    <td className="p-2.5"><p className="text-xs font-semibold truncate">{req.businessName}</p></td>
                    <td className="p-2.5 text-xs text-gray-600 truncate">{req.contactName || '-'}</td>
                    <td className="p-2.5 text-xs text-gray-600 truncate">{req.modelName || '-'}</td>
                    <td className="p-2.5"><p className="text-xs text-gray-600 truncate" title={req.asReason || ''}>{req.asReason || '-'}</p></td>
                    <td className="p-2.5 text-center text-xs whitespace-nowrap">{formatDate(req.processedDate)}</td>
                    <td className="p-2.5 text-right text-xs text-gray-600 whitespace-nowrap">{formatAmount(req.asCost)}</td>
                    <td className="p-2.5 text-right text-xs text-gray-600 whitespace-nowrap">{formatAmount(req.receptionFee)}</td>
                    <td className="p-2.5"><p className="text-xs text-gray-500 truncate" title={req.processingDetails || ''}>{req.processingDetails || '-'}</p></td>
                    <td className="p-2.5 text-right text-xs font-bold text-teal-700 whitespace-nowrap">{formatAmount(req.totalAmount)}</td>
                    <td className="p-2.5 text-center">
                      <span className="text-xs font-medium text-olive-700">{formatSettlementMonth(req.settlementMonth)}</span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== 모바일 카드 리스트 ===== */}
      <div className="md:hidden space-y-3">
        {requests.map(req => (
          <div
            key={req.id}
            className="border rounded-lg bg-white p-4 space-y-2 cursor-pointer hover:border-gray-300 transition-colors"
            onClick={() => onRowClick(req)}
          >
            {/* 상단: (정산대기: 체크박스) + 사업자명 + 상태 뱃지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeTab === 'completed' && (
                  <div onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds?.has(req.id) || false}
                      onCheckedChange={() => onSelectToggle?.(req.id)}
                    />
                  </div>
                )}
                <h3 className="font-semibold text-sm truncate">{req.businessName}</h3>
              </div>
              <Badge className={`${AS_STATUS_COLORS[req.status]} text-[10px] border`}>
                {AS_STATUS_LABELS[req.status]}
              </Badge>
            </div>

            {/* AS접수: 담당자/연락처 + AS사유 */}
            {activeTab === 'received' && (
              <>
                {(req.contactName || req.contactPhone) && (
                  <p className="text-xs text-gray-500 truncate">
                    {req.contactName || ''}{req.contactName && req.contactPhone ? ' · ' : ''}{req.contactPhone || ''}
                  </p>
                )}
                {req.asReason && <p className="text-xs text-gray-400 truncate">AS사유: {req.asReason}</p>}
              </>
            )}

            {/* AS처리중: 센터 + 기사 + 처리내역 */}
            {activeTab === 'in-progress' && (
              <>
                {req.samsungAsCenter && <p className="text-xs text-gray-500">{req.samsungAsCenter}</p>}
                {req.technicianName && <p className="text-xs text-gray-500">기사: {req.technicianName}</p>}
                {req.processingDetails && <p className="text-xs text-gray-400 truncate">{req.processingDetails}</p>}
              </>
            )}

            {/* 정산대기/정산완료: 금액 + 정산월 */}
            {(activeTab === 'completed' || activeTab === 'settled') && (
              <>
                {req.totalAmount ? (
                  <p className="text-sm font-bold text-teal-700">{formatAmount(req.totalAmount)}</p>
                ) : null}
                {req.settlementMonth && (
                  <p className="text-xs text-gray-500">정산: {formatSettlementMonth(req.settlementMonth)}</p>
                )}
              </>
            )}

            {/* 하단 정보 */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span>{formatDate(req.receptionDate)}</span>
                <span className="text-gray-300">|</span>
                <span>{req.affiliate}</span>
              </div>
              {/* 방문예정일 (접수/처리중) */}
              {(activeTab === 'received' || activeTab === 'in-progress') && req.visitDate && (
                <span className="font-bold text-brick-600">방문 {formatDate(req.visitDate)}</span>
              )}
              {/* 총금액 (처리중) */}
              {activeTab === 'in-progress' && (
                <span className="font-medium text-gray-700">{formatAmount(req.totalAmount)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
