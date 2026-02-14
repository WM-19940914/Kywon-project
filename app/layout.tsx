/**
 * 루트 레이아웃 — 모든 페이지의 최상위 HTML 구조를 정의합니다
 *
 * - <html lang="ko"> 한국어 설정
 * - Inter 폰트 로드 (Google Fonts)
 * - 카카오맵 SDK 사전 로드 (beforeInteractive)
 * - 전역 CSS (globals.css) 적용
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "에어컨 발주 관리 시스템",
  description: "에어컨 설비 발주 접수, 견적, 정산 통합 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* 카카오 지도 SDK — autoload=false로 수동 초기화 */}
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&libraries=services&autoload=false`}
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
