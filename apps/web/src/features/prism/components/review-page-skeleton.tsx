"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ReviewPageSkeleton() {
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-3 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-[260px] shrink-0 border-r border-border p-3 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </aside>
        <div className="flex-1 min-w-0 p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <aside className="hidden xl:flex w-[320px] shrink-0 border-l border-border p-3 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </aside>
      </div>
    </div>
  )
}
