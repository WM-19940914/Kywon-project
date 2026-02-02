"use client"

/**
 * 커스텀 알림 시스템 (alert/confirm 대체)
 *
 * 브라우저 기본 alert()와 confirm() 대신 사용하는 예쁜 중앙 모달입니다.
 * - showAlert(message, type): 성공/실패/경고/안내 알림
 * - showConfirm(message): 확인/취소 선택 다이얼로그
 *
 * 사용법:
 *   const { showAlert, showConfirm } = useAlert()
 *   showAlert('저장되었습니다!', 'success')
 *   const ok = await showConfirm('삭제하시겠습니까?')
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

// ─── 타입 정의 ───
type AlertType = "success" | "error" | "warning" | "info"

interface AlertState {
  open: boolean
  message: string
  type: AlertType
}

interface ConfirmState {
  open: boolean
  message: string
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void
  showConfirm: (message: string) => Promise<boolean>
}

// ─── Context 생성 ───
const AlertContext = createContext<AlertContextType | null>(null)

// ─── 아이콘 컴포넌트 (SVG) ───
function SuccessIcon() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
      <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </div>
  )
}

function ErrorIcon() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
      <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  )
}

function WarningIcon() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
      <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    </div>
  )
}

function InfoIcon() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
      <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    </div>
  )
}

function ConfirmIcon() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
      <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    </div>
  )
}

// ─── 타입별 아이콘 매핑 ───
const iconMap: Record<AlertType, () => React.ReactElement> = {
  success: SuccessIcon,
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
}

// ─── 타입별 버튼 색상 ───
const buttonColorMap: Record<AlertType, string> = {
  success: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500",
  error: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
  warning: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
  info: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
}

// ─── 타입별 제목 ───
const titleMap: Record<AlertType, string> = {
  success: "완료",
  error: "오류",
  warning: "주의",
  info: "안내",
}

// ─── Provider 컴포넌트 ───
export function AlertProvider({ children }: { children: React.ReactNode }) {
  // 알림 상태
  const [alert, setAlert] = useState<AlertState>({ open: false, message: "", type: "info" })
  // 확인 다이얼로그 상태
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, message: "" })
  // confirm 결과를 전달하기 위한 ref
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null)

  // 알림 표시
  const showAlert = useCallback((message: string, type: AlertType = "info") => {
    setAlert({ open: true, message, type })
  }, [])

  // 확인 다이얼로그 표시 (Promise 반환)
  const showConfirm = useCallback((message: string): Promise<boolean> => {
    setConfirm({ open: true, message })
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve
    })
  }, [])

  // 알림 닫기
  const closeAlert = useCallback(() => {
    setAlert(prev => ({ ...prev, open: false }))
  }, [])

  // 확인 다이얼로그 응답 처리
  const handleConfirm = useCallback((result: boolean) => {
    setConfirm(prev => ({ ...prev, open: false }))
    confirmResolveRef.current?.(result)
    confirmResolveRef.current = null
  }, [])

  const IconComponent = iconMap[alert.type]

  // Portal 대상 (document.body) — SSR 안전하게 처리
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  // 알림/확인 모달이 열릴 때 Radix Dialog의 포커스 트랩을 일시 비활성화
  useEffect(() => {
    if (!alert.open && !confirm.open) return

    // Radix는 [data-radix-focus-guard] 요소로 포커스를 가둠 — pointer-events 해제
    const guards = document.querySelectorAll('[data-radix-focus-guard]')
    guards.forEach(el => (el as HTMLElement).style.display = 'none')

    return () => {
      guards.forEach(el => (el as HTMLElement).style.display = '')
    }
  }, [alert.open, confirm.open])

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Portal로 document.body에 직접 렌더링 — Radix Dialog 포커스 트랩 우회 */}
      {portalTarget && createPortal(
        <>
          {/* ─── 알림 모달 (alert 대체) ─── */}
          {alert.open && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
              {/* 배경 오버레이 */}
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={closeAlert}
              />
              {/* 모달 본체 */}
              <div className="relative z-10 w-[90vw] max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
                {/* 아이콘 */}
                <IconComponent />
                {/* 제목 */}
                <h3 className="mt-4 text-center text-lg font-bold text-gray-900">
                  {titleMap[alert.type]}
                </h3>
                {/* 메시지 */}
                <p className="mt-2 text-center text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                  {alert.message}
                </p>
                {/* 확인 버튼 */}
                <button
                  onClick={closeAlert}
                  className={cn(
                    "mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
                    buttonColorMap[alert.type]
                  )}
                  autoFocus
                >
                  확인
                </button>
              </div>
            </div>
          )}

          {/* ─── 확인 다이얼로그 (confirm 대체) ─── */}
          {confirm.open && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
              {/* 배경 오버레이 */}
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => handleConfirm(false)}
              />
              {/* 모달 본체 */}
              <div className="relative z-10 w-[90vw] max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
                {/* 아이콘 */}
                <ConfirmIcon />
                {/* 제목 */}
                <h3 className="mt-4 text-center text-lg font-bold text-gray-900">
                  확인
                </h3>
                {/* 메시지 */}
                <p className="mt-2 text-center text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                  {confirm.message}
                </p>
                {/* 버튼 그룹 */}
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => handleConfirm(false)}
                    className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handleConfirm(true)}
                    className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    autoFocus
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        portalTarget
      )}
    </AlertContext.Provider>
  )
}

// ─── Hook ───
export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error("useAlert는 AlertProvider 내부에서만 사용할 수 있습니다.")
  }
  return context
}
