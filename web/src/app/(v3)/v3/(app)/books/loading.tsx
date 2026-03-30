import { BookCardSkeleton } from "@v3/_/components/books/BookCardSkeleton"
import { SiteHeader } from "@v3/_/components/site-header"
import { ScrollArea } from "@v3/_/components/ui/scroll-area"

export default function BookPageLoading() {
  return (
    <>
      <SiteHeader breadcrumbs={[{ label: "Books" }]} />
      <ScrollArea className="flex max-h-svh flex-1 flex-col">
        <div className="grid max-w-screen grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 transition-opacity duration-200">
          {Array.from({ length: 40 }).map((_, i) => (
            <BookCardSkeleton key={i} />
          ))}
        </div>
      </ScrollArea>
    </>
  )
}
