"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { NavView } from "@/features/prism/components/sidebar"

interface NavigationContextValue {
  activeView: NavView
  navigate: (view: NavView) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({
  activeView,
  navigate,
  children,
}: NavigationContextValue & { children: ReactNode }) {
  return (
    <NavigationContext.Provider value={{ activeView, navigate }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider")
  }
  return context
}
