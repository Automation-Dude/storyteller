import {
  IconBook2,
  IconBook,
  IconBookmark,
  IconCalendar,
  IconCircleCheck,
  IconHome,
  IconLanguage,
  IconList,
  IconMicrophone2,
  IconReportAnalytics,
  IconStack2,
  IconStar,
  IconTag,
  IconUser,
  type TablerIcon,
} from "@tabler/icons-react"

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
  icon: TablerIcon
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
    icon: IconHome,
    href: "/",
    labelNs: "AppSidebar",
    labelKey: "home",
  },
  {
    key: "books",
    group: "main",
    icon: IconBook,
    href: "/books",
    labelNs: "AppSidebar",
    labelKey: "books",
  },
  {
    key: "alignment-quality",
    group: "main",
    icon: IconReportAnalytics,
    href: "/quality",
    permission: "bookProcess",
    labelNs: "AppSidebar",
    labelKey: "alignmentQuality",
  },
  {
    key: "series",
    group: "library",
    icon: IconList,
    href: "/series",
    countKey: "series",
    labelNs: "LibraryPage",
    labelKey: "Series.plain",
  },
  {
    key: "authors",
    group: "library",
    icon: IconUser,
    href: "/authors",
    countKey: "authors",
    labelNs: "LibraryPage",
    labelKey: "Authors.plain",
  },
  {
    key: "narrators",
    group: "library",
    icon: IconMicrophone2,
    href: "/narrators",
    countKey: "narrators",
    labelNs: "LibraryPage",
    labelKey: "Narrators.plain",
  },
  {
    key: "translators",
    group: "library",
    icon: IconLanguage,
    href: "/translators",
    countKey: "translators",
    labelNs: "LibraryPage",
    labelKey: "Translators.plain",
  },
  {
    key: "tags",
    group: "library",
    icon: IconTag,
    href: "/tags",
    countKey: "tags",
    labelNs: "LibraryPage",
    labelKey: "Tags.plain",
  },
  {
    key: "publication-years",
    group: "library",
    icon: IconCalendar,
    href: "/publication-years",
    countKey: "publicationYears",
    labelNs: "LibraryPage",
    labelKey: "PublicationYear.plain",
  },
  {
    key: "ratings",
    group: "library",
    icon: IconStar,
    href: "/ratings",
    countKey: "ratings",
    labelNs: "LibraryPage",
    labelKey: "Rating.plain",
  },
  {
    key: "statuses",
    group: "library",
    icon: IconCircleCheck,
    href: "/statuses",
    countKey: "statuses",
    labelNs: "LibraryPage",
    labelKey: "Status.plain",
  },
  {
    key: "formats",
    group: "library",
    icon: IconStack2,
    href: "/formats",
    labelNs: "LibraryPage",
    labelKey: "Formats.plain",
  },
]

export const BUILTIN_SIDEBAR_MAP: Record<string, BuiltinSidebarItem> =
  Object.fromEntries(BUILTIN_SIDEBAR_ITEMS.map((item) => [item.key, item]))

// icons for entity-backed entries (collections / custom shelves)
export const COLLECTION_ICON = IconBook2
export const SHELF_ICON = IconBookmark
