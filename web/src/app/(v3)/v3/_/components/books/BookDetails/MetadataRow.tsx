"use client"
import { cn } from "@/cn"

// function FormatBadges({ book }: { book: BookWithRelations }) {
//   const hasEbook = book.ebook !== null
//   const hasAudiobook = book.audiobook !== null
//   const isSynced =
//     book.readaloud !== null && book.readaloud.status === "ALIGNED"
//   return (
//     <div className="flex flex-wrap gap-2">
//       {isSynced && (
//         <Badge className="gap-1 bg-orange-500 text-white hover:bg-orange-600">
//           <IconReadaloud className="size-6" />
//           ReadAloud
//         </Badge>
//       )}
//       {hasEbook && (
//         <Badge variant="secondary" className="gap-1">
//           <IconBook className="h-3 w-3" />
//           Ebook
//         </Badge>
//       )}
//       {hasAudiobook && (
//         <Badge variant="secondary" className="gap-1">
//           <IconHeadphones className="h-3 w-3" />
//           Audiobook
//         </Badge>
//       )}
//     </div>
//   )
// }
export function MetadataRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  className?: string
}) {
  if (!children) return null

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-muted-foreground font-sans text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}
