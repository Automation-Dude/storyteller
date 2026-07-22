import { type Field } from "@/fields"

// the single source of truth for the library's facet sections (the sidebar's
// "by author / by series / ..." dimensions). server code (facet lists, counts)
// and client code (section pages, sidebar) both key off this registry, each
// through a `satisfies Record<FacetSection, ...>` so adding a section here
// surfaces every required implementation as a type error.

export type FacetSectionDef = {
  /**
   * URL segment served by the generic /[section] page. null = the section has
   * no generic page (a bespoke route renders it, or it is embedded elsewhere).
   */
  slug: string | null
  /** base of the LibraryPage translation keys: `<labelBase>.{plain,by,none}` */
  labelBase: string
  /** whether the sidebar shows a distinct-value count badge for this section */
  badge: boolean
  /**
   * the field condition meaning "book has no value along this facet", used
   * for the "(no X)" bucket. null = the section has no none bucket.
   */
  none: { field: Field; qualifier?: string } | null
}

export const FACET_SECTION_REGISTRY = {
  series: {
    slug: "series",
    labelBase: "Series",
    badge: true,
    none: { field: "series" },
  },
  authors: {
    slug: "authors",
    labelBase: "Authors",
    badge: true,
    none: { field: "creators", qualifier: "aut" },
  },
  narrators: {
    slug: "narrators",
    labelBase: "Narrators",
    badge: true,
    none: { field: "creators", qualifier: "nrt" },
  },
  translators: {
    slug: "translators",
    labelBase: "Translators",
    badge: true,
    none: { field: "creators", qualifier: "trl" },
  },
  tags: {
    slug: "tags",
    labelBase: "Tags",
    badge: true,
    none: { field: "tags" },
  },
  collections: {
    // collections keep a bespoke route (nested /collections/[uuid])
    slug: null,
    labelBase: "Collections",
    badge: false,
    none: { field: "collections" },
  },
  statuses: {
    slug: "statuses",
    labelBase: "Status",
    badge: true,
    none: { field: "status" },
  },
  publicationYears: {
    slug: "publication-years",
    labelBase: "PublicationYear",
    badge: true,
    none: { field: "publicationDate" },
  },
  ratings: {
    slug: "ratings",
    labelBase: "Rating",
    badge: true,
    none: { field: "userRating" },
  },
  formats: {
    slug: "formats",
    labelBase: "Formats",
    badge: false,
    none: null,
  },
  grades: {
    // rendered inside the /quality page, no standalone route
    slug: null,
    labelBase: "Grades",
    badge: false,
    none: null,
  },
  shelves: {
    // bespoke route (preselects a shelf from its own url)
    slug: null,
    labelBase: "Shelves",
    badge: false,
    none: null,
  },
  identifiers: {
    slug: "identifiers",
    labelBase: "Identifier",
    badge: true,
    none: { field: "identifiers" },
  },
} as const satisfies Record<string, FacetSectionDef>

export type FacetSection = keyof typeof FACET_SECTION_REGISTRY

export const FACET_SECTIONS = Object.keys(
  FACET_SECTION_REGISTRY,
) as FacetSection[]

export function isFacetSection(value: string): value is FacetSection {
  return value in FACET_SECTION_REGISTRY
}

/** sections whose sidebar entry shows a distinct-value count badge. */
export type BadgeFacetSection = {
  [S in FacetSection]: (typeof FACET_SECTION_REGISTRY)[S]["badge"] extends true
    ? S
    : never
}[FacetSection]

export const BADGE_FACET_SECTIONS = FACET_SECTIONS.filter(
  (s) => FACET_SECTION_REGISTRY[s].badge,
) as BadgeFacetSection[]

/** sections served by the generic /[section] page, keyed by slug. */
export const FACET_SECTION_SLUGS: Partial<Record<string, FacetSection>> =
  Object.fromEntries(
    FACET_SECTIONS.flatMap((s) => {
      const slug = FACET_SECTION_REGISTRY[s].slug
      return slug ? [[slug, s]] : []
    }),
  )
