import { type BookWithRelations } from "@/database/books"

/**
 * The book metadata a Kobo expects from a store API.
 *
 * A Kobo reads its library from a store rather than from the files on its USB
 * partition, so a self-hosted library has to answer the same shape Kobo's own
 * store does. The device is unforgiving here: fields it does not recognise are
 * ignored, but ones it expects and cannot find make a book silently fail to
 * appear, so the shape below mirrors what the reference implementations send
 * rather than a tidied-up subset.
 *
 * Kobo identifies a book by several ids that, for us, are all the same book:
 * there is one revision of one work, so the book's uuid stands in for each.
 */

/** Kobo's own placeholder category/genre; it wants one and does not use ours. */
const DEFAULT_CATEGORY = "00000000-0000-0000-0000-000000000001"

export type KoboDownloadUrl = {
  Format: "EPUB3" | "EPUB" | "KEPUB" | "EPUB3FL"
  Size: number
  Url: string
  /** Kobo accepts "Generic" or "Android". */
  Platform: "Generic"
}

export type KoboMetadata = Record<string, unknown>

/** Kobo timestamps are ISO 8601; a missing date is left out rather than faked. */
function koboTimestamp(value: string | null): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString()
}

/**
 * Kobo wants a stable id per series so it can group books. Derive it from the
 * name so the same series lands in the same group across syncs, without us
 * having to store an id we otherwise have no use for.
 */
function seriesId(name: string): string {
  // A UUIDv5-shaped value derived from the name. Kobo only requires stability
  // and uniqueness, not a registered namespace.
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (Math.imul(31, hash) + name.charCodeAt(i)) | 0
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0")
  return `${hex}-0000-5000-a000-${hex}00000000`.slice(0, 36)
}

export function buildKoboMetadata(
  book: BookWithRelations,
  downloadUrls: KoboDownloadUrl[],
): KoboMetadata {
  const authors = book.authors.map((author) => author.name)
  // Kobo shows one series per book; ours is always an array, possibly empty.
  const series = book.series[0]

  const metadata: KoboMetadata = {
    // One work, one revision: the book's uuid is every id Kobo asks for.
    EntitlementId: book.uuid,
    RevisionId: book.uuid,
    CrossRevisionId: book.uuid,
    WorkId: book.uuid,
    CoverImageId: book.uuid,

    Title: book.title,
    Description: book.description ?? "",
    Language: book.language ?? "en",
    DownloadUrls: downloadUrls,

    Categories: [DEFAULT_CATEGORY],
    Genre: DEFAULT_CATEGORY,
    ExternalIds: [],
    PhoneticPronunciations: {},

    // Ours is a library, not a shop, but the device still expects a price.
    CurrentDisplayPrice: { CurrencyCode: "USD", TotalAmount: 0 },
    CurrentLoveDisplayPrice: { TotalAmount: 0 },
    IsEligibleForKoboLove: false,
    IsInternetArchive: false,
    IsPreOrder: false,
    IsSocialEnabled: true,

    Publisher: { Imprint: "", Name: "" },
  }

  if (authors.length) {
    metadata["ContributorRoles"] = authors.map((name) => ({ Name: name }))
    metadata["Contributors"] = authors
  }

  const published = koboTimestamp(book.publicationDate)
  if (published) metadata["PublicationDate"] = published

  if (series?.name) {
    const number = series.position ?? undefined
    metadata["Series"] = {
      Name: series.name,
      Number: number ?? 0,
      NumberFloat: number ?? 0,
      Id: seriesId(series.name),
    }
  }

  return metadata
}

/**
 * Tell a device a book is no longer its to read.
 *
 * Sent when a book leaves the device's shelf. Without this a shelf could only
 * ever grow: taking a book back would leave it sitting on the device forever,
 * and "remove it from her shelf" would quietly do nothing.
 */
export function buildRemovedEntitlement(
  bookUuid: string,
  lastModified: string,
): Record<string, unknown> {
  return {
    ChangedEntitlement: {
      BookEntitlement: {
        Accessibility: "Full",
        ActivePeriod: { From: lastModified },
        Created: lastModified,
        CrossRevisionId: bookUuid,
        Id: bookUuid,
        IsRemoved: true,
        IsHiddenFromArchive: true,
        IsLocked: false,
        LastModified: lastModified,
        OriginCategory: "Imported",
        RevisionId: bookUuid,
        Status: "Active",
      },
    },
  }
}

/**
 * Wrap metadata as a "new entitlement": how a Kobo is told a book is now in its
 * library. Active + not archived is what makes it appear and be downloadable.
 */
export function buildNewEntitlement(
  book: BookWithRelations,
  downloadUrls: KoboDownloadUrl[],
  lastModified: string,
): Record<string, unknown> {
  return {
    NewEntitlement: {
      BookEntitlement: {
        Accessibility: "Full",
        ActivePeriod: { From: lastModified },
        Created: lastModified,
        CrossRevisionId: book.uuid,
        Id: book.uuid,
        IsRemoved: false,
        IsHiddenFromArchive: false,
        IsLocked: false,
        LastModified: lastModified,
        OriginCategory: "Imported",
        RevisionId: book.uuid,
        Status: "Active",
      },
      BookMetadata: buildKoboMetadata(book, downloadUrls),
      ReadingState: {
        EntitlementId: book.uuid,
        Created: lastModified,
        LastModified: lastModified,
        // The device supplies its own state as she reads; we only assert the
        // book is unread until it tells us otherwise.
        StatusInfo: { LastModified: lastModified, Status: "ReadyToRead" },
      },
    },
  }
}
