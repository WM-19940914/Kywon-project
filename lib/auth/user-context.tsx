/**
 * 사용자 컨텍스트 — 로그인한 사용자의 역할 정보를 하위 컴포넌트에 전달
 *
 * DashboardShell에서 Provider로 감싸고,
 * 각 페이지에서 useUserProfile() 훅으로 사용합니다.
 */

'use client'

import { createContext, useContext } from 'react'
import type { UserProfile } from '@/lib/auth/roles'

const UserContext = createContext<UserProfile | null>(null)

export function UserProvider({ user, children }: { user: UserProfile; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

/** 현재 로그인한 사용자 프로필 조회 */
export function useUserProfile(): UserProfile | null {
  return useContext(UserContext)
}
