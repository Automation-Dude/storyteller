import { randomUUID } from "node:crypto"
import { basename, dirname, extname, sep } from "node:path"

import { NextResponse } from "next/server"

import { deleteAssets } from "@/assets/fs"
import { filepathFolder, scan } from "@/assets/library/scanner/scan"
import { type Candidate } from "@/assets/library/scanner/types"
import { isAudioFile, isZipArchive } from "@/audio"
import { withHasPermission } from "@/auth/auth"
import {
  type GetBooksOptions,
  deleteBook,
  getBook,
  getBooks,
} from "@/database/books"
import { type ImportMode } from "@/database/settingsTypes"
import { shelfFilterSchema } from "@/shelves"
import { SORTABLE_FIELDS, type SortField } from "@/sort"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

/**
 * @summary List all books in the library
 * @desc Use the `alignedOnly` param to limit results to books that
 *       have been aligned by Storyteller successfully.
 */
export const GET = withHasPermission("bookList")(async (request) => {
  const limitParam = request.nextUrl.searchParams.get("limit")
  const offsetParam = request.nextUrl.searchParams.get("offset")
  const orderByParam = request.nextUrl.searchParams.get("orderBy")
  const orderDirectionParam = request.nextUrl.searchParams.get("orderDirection")
  const searchParam = request.nextUrl.searchParams.get("search")
  const collectionParam = request.nextUrl.searchParams.get("collection")
  const seriesParam = request.nextUrl.searchParams.get("series")
  const mediaFilterParam = request.nextUrl.searchParams.get("mediaFilter")
  const statusParam = request.nextUrl.searchParams.get("status")
  const filterParam = request.nextUrl.searchParams.get("filter")

  const opts: GetBooksOptions = {}

  if (filterParam) {
    let parsed: unknown
    try {
      parsed = JSON.parse(filterParam)
    } catch {
      return NextResponse.json({ error: "Invalid filter" }, { status: 400 })
    }
    if (parsed.type === "condition") {
      parsed = {
        type: "and",
        children: [parsed],
      }
    }
    const validated = shelfFilterSchema.safeParse(parsed)
    if (!validated.success) {
      console.log(parsed)
      console.error(validated.error)
      return NextResponse.json(
        { error: validated.error.message },
        { status: 400 },
      )
    }
    opts.filter = validated.data
  }

  if (limitParam) {
    opts.limit = parseInt(limitParam)
  }

  if (offsetParam) {
    opts.offset = parseInt(offsetParam)
  }

  if (
    orderByParam &&
    (SORTABLE_FIELDS as readonly string[]).includes(orderByParam)
  ) {
    opts.orderBy = orderByParam as SortField
  }

  if (orderDirectionParam) {
    opts.orderDirection = orderDirectionParam as "asc" | "desc"
  }

  if (searchParam) {
    opts.search = searchParam
  }

  if (collectionParam) {
    opts.collection = collectionParam as UUID
  }

  if (seriesParam) {
    opts.series = seriesParam as UUID
  }

  if (mediaFilterParam) {
    opts.mediaFilter = mediaFilterParam as "ebook" | "audiobook" | "synced"
  }

  if (statusParam) {
    opts.status = statusParam as UUID
  }

  const books = await getBooks(null, request.auth.user.id, {
    ...opts,
    includeManifest: false,
  })

  return NextResponse.json(books)
})

export const DELETE = withHasPermission("bookDelete")(async (request) => {
  const { books: bookUuids, preventReImport } = (await request.json()) as {
    books: UUID[]
    preventReImport?: boolean
  }

  const books = await getBooks(bookUuids, request.auth.user.id)

  if (books.length !== bookUuids.length) {
    return Response.json({ message: "Not found" }, { status: 404 })
  }

  for (const book of books) {
    await deleteBook(book.uuid, { preventReImport })
    await deleteAssets(book)
  }

  return new Response(null, { status: 204 })
})

export const POST = withHasPermission("bookCreate")(async (request) => {
  const { paths, collection, importMode } = (await request.json()) as {
    paths: string[]
    collection: UUID | undefined
    importMode: ImportMode
  }

  const newBookUuid = randomUUID()

  const epubs = paths.filter((path) => extname(path) === ".epub")
  const audio = paths.filter((path) => isAudioFile(path) || isZipArchive(path))

  const candidates: Candidate[] = []

  for (const epubPath of epubs) {
    candidates.push({
      folder: filepathFolder(epubPath),
      bookUuidHint: newBookUuid,
      format: "ebook",
      filepath: epubPath,
      titleHint: basename(epubPath, extname(epubPath)),
      ...(collection && { collections: [collection] }),
      importMode,
    })
  }

  if (audio.length) {
    // if the audio files are not in a single directory, yell
    if (audio.length > 1) {
      const longestPrefx = longestPrefix(audio).split(sep)
      const notDirectlyUnderLongestPrefix = audio.find(
        (path) => path.split(sep).length !== longestPrefx.length + 1,
      )

      if (notDirectlyUnderLongestPrefix) {
        return Response.json(
          {
            message: `Audio files must be in a single directory. ${notDirectlyUnderLongestPrefix} is not directly under ${longestPrefx.join(sep)}`,
          },
          { status: 405 },
        )
      }
    }

    const audioDirectory =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      audio.length === 1 ? dirname(audio[0]!) : longestPrefix(audio)

    candidates.push({
      folder: audioDirectory,
      bookUuidHint: newBookUuid,
      format: "audiobook",
      filepath: audioDirectory,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      titleHint: basename(audio[0]!, extname(audio[0]!)),
      ...(collection && { collections: [collection] }),
      importMode,
    })
  }

  await scan({
    source: "api",
    request: { kind: "candidates", candidates },
    options: { force: true },
    signal: new AbortController().signal,
  })

  const reconciled = await getBook(newBookUuid)

  if (!reconciled) {
    return Response.json(
      { message: "Unable to create book from provided paths" },
      { status: 405 },
    )
  }

  return Response.json(reconciled)
})

function longestPrefix(paths: string[]) {
  const pathsSegments = paths.map((path) => path.split(sep))
  const firstPath = pathsSegments[0]
  if (!firstPath || paths.length === 1) return firstPath?.join(sep) ?? ""
  let i = 0
  while (
    firstPath[i] !== undefined &&
    pathsSegments.every((w) => w[i] === firstPath[i])
  )
    i++

  return firstPath.slice(0, i).join(sep)
}
