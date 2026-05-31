import { type JsColor } from "@storyteller-platform/okmain"

import {
  type CoverData,
  type CoverKind,
  extractAndPersistAudioCover,
  extractAndPersistTextCover,
  getExtractedCover,
} from "@/assets/covers"
import { type ScanCtx } from "@/assets/library/scanner/ctx"
import { defineStep } from "@/assets/library/scanner/step"
import { getSetting } from "@/database/settings"
import { type MetadataFieldMode } from "@/database/settingsTypes"
import { generateBlurhash, getCoverColors } from "@/images"

import {
  type ExtractedAudiobookMetadata,
  type ExtractedEpubMetadata,
} from "./extract-metadata"

const STEP = "extract-cover"

async function getCoverMode(ctx: ScanCtx): Promise<MetadataFieldMode> {
  const overrides =
    ctx.options.metadataFieldOverrides ??
    (await getSetting("metadataFieldOverrides"))

  return overrides.cover
}

async function persistCoverDerivedData(
  cover: CoverData,
  kind: CoverKind,
): Promise<{ coverBlurhash?: string; coverColors?: JsColor[] } | undefined> {
  const buffer = Buffer.from(cover.data)
  const colors = getCoverColors(buffer)
  const blurhash = await generateBlurhash(buffer, kind)

  const update = {
    ...(blurhash && { coverBlurhash: blurhash }),
    ...(colors && { coverColors: colors }),
  }

  if (Object.keys(update).length === 0) return

  return update
}

export const extractTextCoverStep = defineStep(
  "extract-text-cover",
  async (input: ExtractedEpubMetadata, ctx) => {
    const mode = await getCoverMode(ctx)
    const colors = input.book[input.format]?.coverColors
    const blurhash = input.book[input.format]?.coverBlurhash

    if (mode === "skip") {
      ctx.report.skipped({
        step: STEP,
        book: input.book,
        format: input.format,
        reason: "cover-override-skip",
      })
      return input
    }

    try {
      if (mode === "merge") {
        const existing = await getExtractedCover(input.book, "ebook")

        if (existing) {
          if (colors && blurhash) {
            ctx.report.skipped({
              step: STEP,
              book: input.book,
              format: input.format,
              reason: "cover-already-exists",
            })
            return input
          }

          const update = await persistCoverDerivedData(existing, "ebook")

          return {
            ...input,
            ...(update?.coverColors && { coverColors: update.coverColors }),
            ...(update?.coverBlurhash && {
              coverBlurhash: update.coverBlurhash,
            }),
          }
        }
      }

      // pipeline already has input.epub open; reuse it instead of opening
      // the same zip a second time. for the other format (when present), we
      // still have to open the file fresh — that handle isn't on input.
      const ebookSource =
        input.format === "ebook"
          ? input.epub
          : input.book.ebook?.filepath ?? null
      const readaloudSource =
        input.format === "readaloud"
          ? input.epub
          : input.book.readaloud?.filepath ?? null

      const cover = await extractAndPersistTextCover(
        input.book,
        ebookSource,
        readaloudSource,
      )

      const update = cover
        ? await persistCoverDerivedData(cover, "ebook")
        : undefined

      return {
        ...input,
        ...(update?.coverColors && { coverColors: update.coverColors }),
        ...(update?.coverBlurhash && {
          coverBlurhash: update.coverBlurhash,
        }),
      }
    } catch (error) {
      ctx.report.warn({
        step: STEP,
        book: input.book,
        msg: "Failed to get extracted ebook cover. Continuing...",
        err: error,
      })
      return input
    }
  },
)

export const extractAudiobookCoverStep = defineStep(
  "extract-audiobook-cover",
  async (input: ExtractedAudiobookMetadata, ctx) => {
    const mode = await getCoverMode(ctx)
    const colors = input.book.audiobook?.coverColors
    const blurhash = input.book.audiobook?.coverBlurhash

    if (mode === "skip") {
      ctx.report.skipped({
        step: STEP,
        book: input.book,
        format: input.format,
        reason: "cover-override-skip",
      })
      return input
    }

    try {
      if (mode === "merge") {
        const existing = await getExtractedCover(input.book, "audiobook")

        if (existing) {
          if (colors && blurhash) {
            ctx.report.skipped({
              step: STEP,
              book: input.book,
              format: input.format,
              reason: "cover-already-exists",
            })
            return input
          }

          const update = await persistCoverDerivedData(existing, "audiobook")

          return {
            ...input,
            ...(update?.coverColors && { coverColors: update.coverColors }),
            ...(update?.coverBlurhash && {
              coverBlurhash: update.coverBlurhash,
            }),
          }
        }
      }

      const readaloudPath = input.book.readaloud?.filepath ?? null

      const cover = await extractAndPersistAudioCover(
        input.book,
        input.audiobook,
        readaloudPath,
        input.filepath,
      )

      const update = cover?.data
        ? await persistCoverDerivedData(cover, "audiobook")
        : undefined

      return {
        ...input,
        ...(update?.coverColors && { coverColors: update.coverColors }),
        ...(update?.coverBlurhash && {
          coverBlurhash: update.coverBlurhash,
        }),
      }
    } catch (error) {
      ctx.report.warn({
        step: STEP,
        book: input.book,
        msg: "Failed to get extracted audiobook cover. Continuing...",
        err: error,
      })
      return input
    }
  },
)
