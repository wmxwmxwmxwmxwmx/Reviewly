"use client"

import type { ComponentProps } from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

type GovernanceRuleSwitchProps = ComponentProps<typeof SwitchPrimitive.Root>

/** High-contrast switch for dark governance table panels. */
export function GovernanceRuleSwitch({ className, ...props }: GovernanceRuleSwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ai-blue/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "data-[state=checked]:border-ai-blue data-[state=checked]:bg-ai-blue",
        "data-[state=unchecked]:border-border-strong data-[state=unchecked]:bg-surface-4",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-3.5 rounded-full shadow-sm ring-0 transition-transform",
          "bg-white",
          "data-[state=checked]:translate-x-4",
          "data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  )
}
