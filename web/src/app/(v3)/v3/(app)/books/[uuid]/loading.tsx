import { SiteHeader } from "@v3/_/components/site-header"
import { Separator } from "@v3/_/components/ui/separator"
import { Skeleton } from "@v3/_/components/ui/skeleton"

export default function BookDetailsSkeleton() {
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
          <div className="flex flex-col gap-8 md:flex-row">
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
          <Separator className="my-8" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}
