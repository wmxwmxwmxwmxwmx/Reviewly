"use client"

import type { ReactNode } from "react"

import type { AIProvider } from "@/features/prism/contexts/ai-settings-context"
import { cn } from "@/lib/utils"

type ProviderIconProps = {
  provider: AIProvider
  className?: string
}

function IconFrame({
  className,
  children,
  bgClassName,
}: {
  className?: string
  children: ReactNode
  bgClassName: string
}) {
  return (
    <span
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-[4px] overflow-hidden",
        bgClassName,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function ProviderIcon({ provider, className }: ProviderIconProps) {
  switch (provider) {
    case "anthropic":
      return (
        <IconFrame bgClassName="bg-[#CC785C]" className={className}>
          <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
            <path
              fill="#fff"
              d="M12 3.5 4.5 19h3.2l1.1-2.6h6.4l1.1 2.6H19.5L12 3.5zm0 5.8 2.3 5.4H9.7L12 9.3z"
            />
          </svg>
        </IconFrame>
      )
    case "openai":
      return (
        <IconFrame bgClassName="bg-[#10A37F]" className={className}>
          <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
            <path
              fill="#fff"
              d="M12 4.2c-.8 0-1.5.2-2.1.6-.6-.3-1.3-.5-2-.5-2.2 0-4 1.8-4 4 0 .7.2 1.4.5 2-.4.6-.6 1.3-.6 2.1 0 2.2 1.8 4 4 4 .8 0 1.5-.2 2.1-.6.6.3 1.3.5 2 .5 2.2 0 4-1.8 4-4 0-.8-.2-1.5-.5-2.1.4-.6.6-1.3.6-2.1 0-2.2-1.8-4-4-4zm0 2.2c1 0 1.8.8 1.8 1.8s-.8 1.8-1.8 1.8-1.8-.8-1.8-1.8.8-1.8 1.8-1.8z"
            />
          </svg>
        </IconFrame>
      )
    case "google":
      return (
        <IconFrame bgClassName="bg-white" className={className}>
          <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
            <path fill="#4285F4" d="M12 11.2v2.9h4.1c-.2 1-1.2 2.9-4.1 2.9-2.5 0-4.5-2.1-4.5-4.7s2-4.7 4.5-4.7c1.4 0 2.3.6 2.8 1.1l1.9-1.8C15.8 5.6 14.1 5 12 5 7.9 5 4.5 8.4 4.5 12.5S7.9 20 12 20c3.5 0 5.8-2.5 5.8-6 0-.4 0-.7-.1-1.1H12z" />
          </svg>
        </IconFrame>
      )
    case "deepseek":
      return (
        <IconFrame bgClassName="bg-[#4D6BFE]" className={className}>
          <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
            <path
              fill="#fff"
              d="M6.5 7.5c0-1.1.9-2 2-2h7c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-7c-1.1 0-2-.9-2-2v-9zm3 1.5v6h6v-6h-6zm1.5 1.5h3v3h-3v-3z"
            />
          </svg>
        </IconFrame>
      )
    case "openrouter":
      return (
        <IconFrame bgClassName="bg-[#6366F1]" className={className}>
          <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
            <path
              fill="#fff"
              d="M7 7h4v4H7V7zm6 0h4v4h-4V7zM7 13h4v4H7v-4zm6 0h4v4h-4v-4z"
            />
          </svg>
        </IconFrame>
      )
    case "custom":
    default:
      return (
        <IconFrame bgClassName="bg-surface-4 border border-border" className={className}>
          <svg viewBox="0 0 24 24" className="size-2.5 text-muted-foreground" aria-hidden>
            <path
              fill="currentColor"
              d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm-1 3h2v6h-2V8zm0 7h2v2h-2v-2z"
            />
          </svg>
        </IconFrame>
      )
  }
}
