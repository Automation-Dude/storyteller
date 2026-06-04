import { cn } from "@/cn"
import { SiteHeader } from "@v3/_/components/site-header"
import { Skeleton } from "@v3/_/components/ui/skeleton"

export const BookDetailsSkeleton = ({ compact }: { compact?: boolean }) => {
  if (compact) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="bg-muted/30 flex flex-col items-center gap-4 px-6 pt-7 pb-5">
          <Skeleton className="h-52 w-36 rounded-lg" />
          <div className="flex w-full flex-col items-center gap-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
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
        <div className="mx-auto max-w-5xl p-6">
          <div className={cn("flex flex-col gap-8", "md:flex-row")}>
            <Skeleton className="h-80 w-52 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-5 w-40" />
              <div className="flex-1" />
              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
          <div className="bg-border my-8 h-px" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}
