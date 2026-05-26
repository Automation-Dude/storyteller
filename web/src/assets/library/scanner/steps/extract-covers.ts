import {
  extractAndPersistAudioCover,
  extractAndPersistTextCover,
  getExtractedCover,
} from "@/assets/covers"
import { type ScanCtx } from "@/assets/library/scanner/ctx"
import { defineStep } from "@/assets/library/scanner/step"
import { getSetting } from "@/database/settings"
import { type MetadataFieldMode } from "@/database/settingsTypes"

import {
  type ExtractedAudiobookMetadata,
  type ExtractedEpubMetadata,
} from "./extract-metadata"
import { generateBlurhash, getCoverColors } from "@/images"
import { CoverColor } from "@/app/(v3)/v3/_/components/books/BookDetails/sections/useCoverColors"
import { getFormatRelationPatch } from "../formatRelations"

const STEP = "extract-cover"

async function getCoverMode(ctx: ScanCtx): Promise<MetadataFieldMode> {
  const overrides =
    ctx.options.metadataFieldOverrides ??
    (await getSetting("metadataFieldOverrides"))

  return overrides.cover
}

export const extractTextCoverStep = defineStep(
  "extract-text-cover",
  async (input: ExtractedEpubMetadata, ctx) => {
    const mode = await getCoverMode(ctx)

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
          ctx.report.skipped({
            step: STEP,
            book: input.book,
            format: input.format,
            reason: "cover-already-exists",
          })
          return input
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

      if (!cover) {
        return input
      }

      let blurhash: string | null = null
      try {
        const blurhash = await generateBlurhash(
          Buffer.from(cover.data),
          "ebook",
        )
      } catch (error) {
        ctx.logger.error({
          msg: `Failed to get blurhash for book ${input.book.title}`,
          err: error,
        })
      }

      let colors: CoverColor[] | null = null
      try {
        colors = getCoverColors(Buffer.from(cover.data))
      } catch (error) {
        ctx.logger.warn({
          msg: `Failed to get cover colors for book ${input.book.title}`,
          err: error,
        })
      }

      return {
        ...input,
        // extractedRelations: getFormatRelationPatch {
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
          ctx.report.skipped({
            step: STEP,
            book: input.book,
            format: input.format,
            reason: "cover-already-exists",
          })
          return input
        }
      }

      const readaloudPath = input.book.readaloud?.filepath ?? null

      await extractAndPersistAudioCover(
        input.book,
        input.audiobook,
        readaloudPath,
        input.filepath,
      )

      return input
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
