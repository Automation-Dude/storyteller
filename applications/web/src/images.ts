import { env } from "./env"

let _sharp: typeof import("sharp") | undefined

const AVIF = "image/avif"
const WEBP = "image/webp"
const PNG = "image/png"
const JPEG = "image/jpeg"

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

/**
 * Size and busy-ness of an image, for telling a real cover from a blank one.
 *
 * `entropy` is near zero for a solid or near-solid image and rises with detail,
 * so a very low value is a strong sign the "cover" is blank. Width and height
 * catch the covers that are really postage-stamp thumbnails.
 */
export async function imageStats(
  buffer: Buffer,
): Promise<{ width: number; height: number; entropy: number }> {
  const sharp = await getSharp()
  const image = sharp(buffer)
  const [meta, stats] = await Promise.all([image.metadata(), image.stats()])
  return {
    width: meta.width,
    height: meta.height,
    entropy: stats.entropy,
  }
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
}): Promise<Buffer> {
  // scale up images for hi-res displays
  height = height && Math.round(height * 2)
  width = Math.round(width * 2)

  const quality = 75
  const sharp = await getSharp()
  const transformer = sharp(buffer)
    .timeout({
      seconds: 7,
    })
    .rotate()

  if (height) {
    transformer.resize(width, height)
  } else {
    transformer.resize(width, undefined, {
      withoutEnlargement: true,
    })
  }

  if (contentType === AVIF) {
    transformer.avif({
      quality: Math.max(quality - 20, 1),
      effort: 3,
    })
  } else if (contentType === WEBP) {
    transformer.webp({ quality })
  } else if (contentType === PNG) {
    transformer.png({ quality })
  } else if (contentType === JPEG) {
    transformer.jpeg({ quality, mozjpeg: true })
  }

  const optimizedBuffer = await transformer.toBuffer()

  return optimizedBuffer
}
