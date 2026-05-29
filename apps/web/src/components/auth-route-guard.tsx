"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/features/prism/contexts/auth-context"
import { isAuthBypassEnabled } from "@/lib/auth/storage"

const PUBLIC_PATHS = ["/login", "/auth/callback"]

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function AuthRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()
  const bypass = isAuthBypassEnabled()
  const isPublic = isPublicPath(pathname)

  useEffect(() => {
    if (loading) return
    if (!isPublic && !isAuthenticated && !bypass) {
      router.replace("/login")
      return
    }
    if (pathname === "/login" && isAuthenticated) {
      router.replace("/")
    }
  }, [loading, isAuthenticated, isPublic, pathname, router, bypass])

  if (loading && !isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        加载中…
      </div>
    )
  }

  if (!isPublic && !isAuthenticated && !bypass && !loading) {
    return null
  }

  return <>{children}</>
}
