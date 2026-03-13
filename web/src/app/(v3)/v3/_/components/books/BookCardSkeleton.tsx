import { Skeleton } from "../ui/skeleton"

export function BookCardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-[2/3] rounded-lg" />
      <div className="mt-2 flex flex-col gap-1 px-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}
