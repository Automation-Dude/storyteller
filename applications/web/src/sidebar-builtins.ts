// single source of truth for the builtin sidebar entries. the DB only stores
// deviations from this list (an item hidden or moved by the user); anything
// without a row is assumed to sit in its default group, in this order. adding
// a new builtin here is enough to surface it for every user -- no migration.
// presentation metadata (icons, hrefs, labels) lives in
// app/(v3)/v3/_/components/nav/sidebar-items.ts, keyed by these keys.

export type SidebarBuiltinGroup = "main" | "library"

export type SidebarBuiltin = {
  key: string
  group: SidebarBuiltinGroup
}

export const SIDEBAR_BUILTINS = [
  { key: "home", group: "main" },
  { key: "books", group: "main" },
  { key: "alignment-quality", group: "main" },
  { key: "library-audit", group: "main" },
  { key: "series", group: "library" },
  { key: "authors", group: "library" },
  { key: "narrators", group: "library" },
  { key: "translators", group: "library" },
  { key: "tags", group: "library" },
  { key: "publication-years", group: "library" },
  { key: "ratings", group: "library" },
  { key: "statuses", group: "library" },
  { key: "formats", group: "library" },
  { key: "identifiers", group: "library" },
] as const satisfies readonly SidebarBuiltin[]

export type SidebarBuiltinKey = (typeof SIDEBAR_BUILTINS)[number]["key"]

export const SIDEBAR_BUILTIN_KEYS = new Set<string>(
  SIDEBAR_BUILTINS.map((b) => b.key),
)

export function builtinGroupFor(key: string): SidebarBuiltinGroup | null {
  return SIDEBAR_BUILTINS.find((b) => b.key === key)?.group ?? null
}
