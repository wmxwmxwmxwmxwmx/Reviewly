"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { AuthUser } from "@reviewly/shared"

import { fetchAuthMe, fetchGithubLoginUrl, logoutAuth } from "@/lib/api/auth"
import { PrismApiError } from "@/lib/api/client"
import {
  clearAuthSession,
  clearAuthToken,
  getAuthToken,
  isAuthBypassEnabled,
  setAuthToken,
} from "@/lib/auth/storage"

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  switchAccount: () => Promise<void>
  setTokenFromCallback: (token: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const bypass = isAuthBypassEnabled()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (bypass) {
      try {
        const me = await fetchAuthMe()
        setUser(me)
        setToken(null)
      } catch {
        setUser(null)
      }
      return
    }
    const stored = getAuthToken()
    if (!stored) {
      setUser(null)
      setToken(null)
      return
    }
    setToken(stored)
    try {
      const me = await fetchAuthMe()
      setUser(me)
    } catch (e: unknown) {
      if (e instanceof PrismApiError && e.status === 401) {
        clearAuthToken()
        setToken(null)
      }
      setUser(null)
    }
  }, [bypass])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refreshUser()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  const login = useCallback(async () => {
    const { url } = await fetchGithubLoginUrl()
    window.location.href = url
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutAuth()
    } catch {
      /* ignore */
    }
    clearAuthSession()
    setToken(null)
    setUser(null)
  }, [])

  const switchAccount = useCallback(async () => {
    clearAuthSession()
    setToken(null)
    setUser(null)
    await login()
  }, [login])

  const setTokenFromCallback = useCallback(
    async (newToken: string) => {
      setAuthToken(newToken)
      setToken(newToken)
      await refreshUser()
    },
    [refreshUser],
  )

  const isAuthenticated = bypass ? Boolean(user) : Boolean(user && token)

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated,
      login,
      logout,
      switchAccount,
      setTokenFromCallback,
      refreshUser,
    }),
    [user, token, loading, isAuthenticated, login, logout, switchAccount, setTokenFromCallback, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
