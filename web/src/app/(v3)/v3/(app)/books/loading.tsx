import { ScrollArea } from "@/app/(v3)/v3/_/components/ui/scroll-area"

import { BookCardSkeleton } from "@/app/(v3)/v3/_/components/books/BookCardSkeleton"
import { SiteHeader } from "@/app/(v3)/v3/_/components/site-header"

export default function BookPageLoading() {
  return (
    <>
      <SiteHeader breadcrumbs={[{ label: "Books" }]} />
      <ScrollArea className="flex max-h-svh flex-1 flex-col">
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(160px,_1fr))] gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      </ScrollArea>
    </>
  )
}
