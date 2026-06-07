import { SiteHeader } from "@v3/_/components/site-header"
import { Skeleton } from "@v3/_/components/ui/skeleton"

import { cn } from "@/cn"

export const BookDetailsSkeleton = ({ compact }: { compact?: boolean }) => {
  if (compact) {
    return (
      <div className="flex flex-1 flex-col">
        {/* panel header bar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* hero section */}
            <div className="bg-muted/30 flex flex-col items-center gap-5 px-6 pt-7 pb-5 text-center">
              <Skeleton className="h-[200px] w-[150px] rounded-lg" />

              <div className="flex w-full flex-col items-center gap-1.5">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-0.5 h-3 w-2/5" />
                <Skeleton className="h-3 w-1/3" />

                <div className="mt-1 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-4 rounded-full" />
                  ))}
                </div>
              </div>

              <div className="flex w-full justify-center gap-2">
                <Skeleton className="h-8 w-24 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>

            {/* content sections */}
            <div className="flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>

              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="h-6 w-18 rounded-full" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        breadcrumbs={[
          { label: "Books", url: "/books" },
          { label: "Loading..." },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                "bg-muted/30 flex flex-col gap-8 px-6 pt-7 pb-5",
                "md:h-80 md:flex-row md:items-center",
              )}
            >
              <Skeleton className="h-64 w-44 shrink-0 self-center rounded-lg" />

              <div className="flex flex-1 flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="mt-1 h-3 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>

                <div className="flex-1" />

                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-md" />
                  <Skeleton className="h-8 w-16 rounded-md" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>

              <div className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="h-6 w-18 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
