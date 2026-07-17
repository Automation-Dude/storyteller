import { randomUUID } from "node:crypto"
import { access, mkdir, readdir, rename, rm, stat } from "node:fs/promises"
import { join } from "node:path"

import {
  Epub,
  type ParsedXml,
  type XmlElement,
  type XmlNode,
} from "@storyteller-platform/epub"

import { CACHE_DIR } from "@/directories"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

/**
 * Turn an EPUB into the shape a Kobo's own reader wants.
 *
 * A Kobo tracks where you are by the id of a span around the sentence you are
 * on. A plain EPUB has no such spans, so the device can only place you at the
 * start of a chapter: close a book and reopen it and you lose your page. That
 * is the whole reason this exists.
 *
 * The transform is deliberately narrow. It only wraps text that is already
 * there, in spans, and changes nothing else: no reflowing, no style rewriting,
 * no restructuring. kepubify does more, but every extra rule is another way to
 * damage someone's book, and the spans are what buy the page.
 */

/** The elements whose text a Kobo paginates. Others are left untouched. */
const SKIP_ELEMENTS = new Set([
  "script",
  "style",
  "head",
  "title",
  "svg",
  "math",
  "pre",
  "code",
  "audio",
  "video",
  // Already ours, from a previous pass.
  "span",
])

/**
 * Split text into the pieces a Kobo places you at: roughly sentences.
 *
 * Splitting after ., ! or ? followed by space is crude next to real sentence
 * segmentation, but a wrong split costs a slightly coarse position, while
 * anything cleverer here risks mangling text. Whitespace is kept with the
 * piece it follows so that joining the pieces reproduces the input exactly.
 */
export function splitIntoSegments(text: string): string[] {
  if (!text.trim()) return [text]

  const segments: string[] = []
  let start = 0
  const pattern = /[.!?]["')\]]*\s+/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    segments.push(text.slice(start, match.index + match[0].length))
    start = match.index + match[0].length
  }
  if (start < text.length) segments.push(text.slice(start))

  return segments.length ? segments : [text]
}

function koboSpan(id: string, text: string): XmlElement {
  return {
    span: [{ "#text": text }],
    ":@": { "@_class": "koboSpan", "@_id": id },
  } as unknown as XmlElement
}

function elementName(node: XmlNode): string | null {
  if (Epub.isXmlTextNode(node)) return null
  const [name] = Object.keys(node).filter((key) => key !== ":@")
  return name ?? null
}

/**
 * Wrap the text in a parsed XHTML body with koboSpans, in place of the text.
 *
 * Ids are `kobo.<paragraph>.<segment>`, both 1-based, which is the form the
 * device's own reader produces and reports back.
 */
export function injectKoboSpans(xml: ParsedXml): ParsedXml {
  let paragraph = 0

  function walk(nodes: ParsedXml): ParsedXml {
    const out: ParsedXml = []

    for (const node of nodes) {
      const name = elementName(node)

      if (Epub.isXmlTextNode(node)) {
        // Bare text outside any element: leave it. Wrapping it would move it
        // into a span that was not in the author's markup.
        out.push(node)
        continue
      }

      if (!name || SKIP_ELEMENTS.has(name.toLowerCase())) {
        out.push(node)
        continue
      }

      const children = (node as unknown as Record<string, ParsedXml>)[name]
      if (!Array.isArray(children)) {
        out.push(node)
        continue
      }

      const hasText = children.some(
        (child) => Epub.isXmlTextNode(child) && child["#text"].trim(),
      )

      if (hasText) {
        paragraph++
        let segment = 0
        const wrapped: ParsedXml = []

        for (const child of children) {
          if (!Epub.isXmlTextNode(child)) {
            wrapped.push(...walk([child]))
            continue
          }
          if (!child["#text"].trim()) {
            // Whitespace between elements: keep it exactly as it was.
            wrapped.push(child)
            continue
          }
          for (const text of splitIntoSegments(child["#text"])) {
            segment++
            wrapped.push(koboSpan(`kobo.${paragraph}.${segment}`, text))
          }
        }

        out.push({
          ...node,
          [name]: wrapped,
        } as unknown as XmlElement)
        continue
      }

      out.push({
        ...node,
        [name]: walk(children),
      } as unknown as XmlElement)
    }

    return out
  }

  return walk(xml)
}

const XHTML_MEDIA_TYPE = "application/xhtml+xml"

function kepubCacheDirectory(uuid: UUID) {
  return join(CACHE_DIR, "kepub", uuid)
}

/**
 * Write a kepub of `sourcePath` to `destPath`.
 *
 * Returns false, having written nothing worth keeping, if the text of the
 * result is not character-for-character the text of the source. The caller is
 * expected to fall back to the original EPUB: a book that opens at the top of
 * the chapter is a small annoyance, a book with text missing is a ruined book.
 */
export async function convertToKepub(
  sourcePath: string,
  destPath: string,
): Promise<boolean> {
  using source = await Epub.from(sourcePath)

  const items = (await source.getSpineItems()).filter(
    (item) => item.mediaType === XHTML_MEDIA_TYPE,
  )
  if (!items.length) return false

  const originalText = new Map<string, string>()
  for (const item of items) {
    originalText.set(
      item.id,
      await source.readXhtmlItemContents(item.id, "text"),
    )
  }

  {
    using kepub = await source.copy(destPath)
    for (const item of items) {
      const xml = await kepub.readXhtmlItemContents(item.id)
      await kepub.writeXhtmlItemContents(item.id, injectKoboSpans(xml))
    }
    await kepub.saveAndClose()
  }

  // Read back what we actually wrote, rather than trust what we meant to
  // write. The span walk is tested; the risk that is left lives in the
  // parse and serialize round-trip, and only the file on disk shows it.
  using written = await Epub.from(destPath)
  for (const item of items) {
    const before = originalText.get(item.id)
    const after = await written.readXhtmlItemContents(item.id, "text")
    if (after !== before) {
      logger.warn(
        `kepub conversion of ${sourcePath} altered the text of ${item.href}; falling back to the original EPUB`,
      )
      return false
    }
  }

  return true
}

/**
 * Path to a kepub of this book's EPUB, converting and caching it if needed.
 *
 * Returns null when the book cannot be converted safely, which means the
 * caller should serve the plain EPUB.
 *
 * The cache key includes the source's mtime and size, so replacing a book's
 * EPUB retires its kepub rather than serving yesterday's text under today's
 * book.
 */
export async function getCachedKepub(
  uuid: UUID,
  sourcePath: string,
): Promise<string | null> {
  const directory = kepubCacheDirectory(uuid)
  let filename: string
  try {
    const stats = await stat(sourcePath)
    filename = `${Math.round(stats.mtimeMs)}-${stats.size}.kepub.epub`
  } catch {
    return null
  }

  const path = join(directory, filename)
  try {
    await access(path)
    return path
  } catch {
    // Not converted yet.
  }

  await mkdir(directory, { recursive: true })
  // Convert to a private path and rename only once verified, so that a
  // crash or a second request can never publish a half-written book.
  const partial = join(directory, `.${randomUUID()}.partial`)
  try {
    if (!(await convertToKepub(sourcePath, partial))) {
      await rm(partial, { force: true })
      return null
    }
    await rename(partial, path)
  } catch (error) {
    await rm(partial, { force: true })
    logger.error(
      `failed to convert ${sourcePath} to kepub: ${String(error)}; falling back to the original EPUB`,
    )
    return null
  }

  for (const entry of await readdir(directory)) {
    if (entry !== filename) {
      await rm(join(directory, entry), { force: true, recursive: true })
    }
  }

  return path
}
