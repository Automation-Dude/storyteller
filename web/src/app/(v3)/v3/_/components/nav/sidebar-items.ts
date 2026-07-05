import * as icon from "@/icons"
import { type StyledIcon } from "@/icons"

import { type Permission } from "@/database/users"

export type SidebarGroup = "main" | "library"

type AppSidebarLabelKey = "home" | "books" | "alignmentQuality"
type LibraryLabelKey =
  | "Series.plain"
  | "Authors.plain"
  | "Narrators.plain"
  | "Translators.plain"
  | "Tags.plain"
  | "PublicationYear.plain"
  | "Rating.plain"
  | "Status.plain"
  | "Formats.plain"

type BuiltinBase = {
  key: string
  group: SidebarGroup
  icon: StyledIcon
  href: string
  // count lookup key in useLibraryCounts; omitted for entries without a badge
  countKey?: string
  // permission required to see / add this entry; omitted means everyone.
  permission?: Permission
}

// presentation metadata for a builtin nav entry. the DB stores only the stable
// `key`; everything else (icon, href, label, count) is resolved from here. the
// labelNs discriminant keeps labelKey precise so the matching translator
// validates it without casts.
export type BuiltinSidebarItem =
  | (BuiltinBase & { labelNs: "AppSidebar"; labelKey: AppSidebarLabelKey })
  | (BuiltinBase & { labelNs: "LibraryPage"; labelKey: LibraryLabelKey })

export const BUILTIN_SIDEBAR_ITEMS: BuiltinSidebarItem[] = [
  {
    key: "home",
    group: "main",
    icon: icon.Home,
    href: "/",
    labelNs: "AppSidebar",
    labelKey: "home",
  },
  {
    key: "books",
    group: "main",
    icon: icon.BookAlt,
    href: "/books",
    labelNs: "AppSidebar",
    labelKey: "books",
  },
  {
    key: "alignment-quality",
    group: "main",
    icon: icon.ReportAnalytics,
    href: "/quality",
    permission: "bookProcess",
    labelNs: "AppSidebar",
    labelKey: "alignmentQuality",
  },
  {
    key: "series",
    group: "library",
    icon: icon.List,
    href: "/series",
    countKey: "series",
    labelNs: "LibraryPage",
    labelKey: "Series.plain",
  },
  {
    key: "authors",
    group: "library",
    icon: icon.User,
    href: "/authors",
    countKey: "authors",
    labelNs: "LibraryPage",
    labelKey: "Authors.plain",
  },
  {
    key: "narrators",
    group: "library",
    icon: icon.Microphone2,
    href: "/narrators",
    countKey: "narrators",
    labelNs: "LibraryPage",
    labelKey: "Narrators.plain",
  },
  {
    key: "translators",
    group: "library",
    icon: icon.Language,
    href: "/translators",
    countKey: "translators",
    labelNs: "LibraryPage",
    labelKey: "Translators.plain",
  },
  {
    key: "tags",
    group: "library",
    icon: icon.Tag,
    href: "/tags",
    countKey: "tags",
    labelNs: "LibraryPage",
    labelKey: "Tags.plain",
  },
  {
    key: "publication-years",
    group: "library",
    icon: icon.Calendar,
    href: "/publication-years",
    countKey: "publicationYears",
    labelNs: "LibraryPage",
    labelKey: "PublicationYear.plain",
  },
  {
    key: "ratings",
    group: "library",
    icon: icon.Star,
    href: "/ratings",
    countKey: "ratings",
    labelNs: "LibraryPage",
    labelKey: "Rating.plain",
  },
  {
    key: "statuses",
    group: "library",
    icon: icon.CircleCheck,
    href: "/statuses",
    countKey: "statuses",
    labelNs: "LibraryPage",
    labelKey: "Status.plain",
  },
  {
    key: "formats",
    group: "library",
    icon: icon.Stack,
    href: "/formats",
    labelNs: "LibraryPage",
    labelKey: "Formats.plain",
  },
]

export const BUILTIN_SIDEBAR_MAP: Record<string, BuiltinSidebarItem> =
  Object.fromEntries(BUILTIN_SIDEBAR_ITEMS.map((item) => [item.key, item]))

// icons for entity-backed entries (collections / custom shelves)
export const COLLECTION_ICON = icon.Book
export const SHELF_ICON = icon.Bookmark
