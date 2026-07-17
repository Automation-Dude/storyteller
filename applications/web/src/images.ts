import { encode } from "blurhash"

import { InputImage, type JsColor, colors } from "@storyteller-platform/okmain"

import { env } from "./env"

let _sharp: typeof import("sharp") | undefined

const AVIF = "image/avif"
const WEBP = "image/webp"
const _JPEG = "image/jpeg"

async function getSharp() {
  if (_sharp) {
    return _sharp
  }
  _sharp = (await import("sharp")).default
  if (_sharp.concurrency() > 1) {
    // Reducing concurrency should reduce the memory usage too.
    // We more aggressively reduce in dev but also reduce in prod.
    // https://sharp.pixelplumbing.com/api-utility#concurrency
    const divisor = env.NODE_ENV === "development" ? 4 : 2
    _sharp.concurrency(Math.floor(Math.max(_sharp.concurrency() / divisor, 1)))
  }
  return _sharp
}

export type OptimizedImage = {
  data: Buffer
  mimeType: string
}

/**
 * Resize a cover for an e-reader and encode it as JPEG.
 *
 * optimizeImage encodes to WebP, which the web app and its cache want, but an
 * e-ink reader (a Kobo) may not render WebP and its own covers are JPEG. This
 * keeps the resize (so the device pulls a thumbnail, not a full cover) while
 * staying in the format such devices always support. Dimensions are doubled
 * for higher-density screens, as optimizeImage does.
 */
export async function resizeCoverForReader(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const sharp = await getSharp()
  return sharp(buffer)
    .timeout({ seconds: 7 })
    .resize(Math.round(width * 2), Math.round(height * 2))
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer()
}

export async function optimizeImage({
  buffer,
  contentType,
  width,
  height,
}: {
  buffer: Buffer
  contentType: string
  width: number
  height?: number
}): Promise<OptimizedImage> {
  height = height && Math.round(height * 2)
  width = Math.round(width * 2)

  const quality = 75
  const sharp = await getSharp()

  const transformer = sharp(buffer).timeout({ seconds: 7 })

  if (height) {
    transformer.resize(width, height)
  } else {
    transformer.resize(width, undefined, {
      withoutEnlargement: true,
    })
  }

  // png covers are common in epubs but png encoding is slow for
  // photographic content; output jpeg instead since the result is cached
  let outputMimeType = contentType

  if (contentType === AVIF) {
    transformer.avif({
      quality: Math.max(quality - 20, 1),
      effort: 1,
    })
  } else {
    //if (contentType === WEBP) {
    transformer.webp({ quality })
    outputMimeType = WEBP
    // } else {
    //   transformer.jpeg({ quality })
    //   outputMimeType = JPEG
  }

  const data = await transformer.toBuffer()

  return { data, mimeType: outputMimeType }
}

export async function generateBlurhash(
  imageData: Buffer | Uint8Array,
  type: "ebook" | "audiobook",
): Promise<string | null> {
  try {
    const sharp = await getSharp()

    const { data, info } = await sharp(imageData)
      .resize(type === "ebook" ? 64 : 32, 32, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3)
  } catch {
    return null
  }
}

export function getCoverColors(
  imageData: Buffer,
  // type: "ebook" | "audiobook",
): JsColor[] | null {
  try {
    const col = colors(InputImage.fromImage(imageData))

    return col
  } catch {
    return null
  }
}
