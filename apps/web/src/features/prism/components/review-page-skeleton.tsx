"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ReviewPageSkeleton() {
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="shrink-0 border-t border-border px-4 py-2 flex gap-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
      <div className="shrink-0 border-t border-border px-4 py-3">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
