import { decodeBlurHash } from "fast-blurhash"

const RESOLUTION = 4

// base83 alphabet used by blurhash.
const DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"

function decode83(str: string): number {
  let value = 0
  for (const char of str) {
    value = value * 83 + DIGITS.indexOf(char)
  }
  return value
}

const avgColorCache = new Map<string, string>()
const gradientCache = new Map<string, string>()

const GRADIENT_N = 3

// experiment
export function getBlurhashGradient(
  blurhash: string | null | undefined,
): string | null {
  if (!blurhash) return null

  const cached = gradientCache.get(blurhash)
  if (cached) return cached

  try {
    const pixels = decodeBlurHash(blurhash, GRADIENT_N, GRADIENT_N)
    const layers: string[] = []
    for (let y = 0; y < GRADIENT_N; y++) {
      for (let x = 0; x < GRADIENT_N; x++) {
        const i = (y * GRADIENT_N + x) * 4
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const px = (x / (GRADIENT_N - 1)) * 100
        const py = (y / (GRADIENT_N - 1)) * 100
        layers.push(
          `radial-gradient(50% 50% at ${px}% ${py}%, rgb(${r},${g},${b}) 0%, transparent 100%)`,
        )
      }
    }
    const value = layers.join(",")
    gradientCache.set(blurhash, value)
    return value
  } catch {
    return null
  }
}

// the average (DC) color is stored directly in the blurhash header (chars 2-5)
// as an sRGB triple, so we can read it with a few arithmetic ops. this is the
// cheap placeholder: no decode(), no canvas, no toDataURL() (each ~2-3ms). use
// it as a solid background-color while the real cover decodes.
export function getBlurhashAverageColor(
  blurhash: string | null | undefined,
): string | null {
  if (!blurhash || blurhash.length < 6) return null

  const cached = avgColorCache.get(blurhash)
  if (cached) return cached

  try {
    const value = decode83(blurhash.substring(2, 6))
    const r = value >> 16
    const g = (value >> 8) & 255
    const b = value & 255
    const color = `rgb(${r},${g},${b})`
    avgColorCache.set(blurhash, color)
    return color
  } catch {
    return null
  }
}

const cache = new Map<string, string>()

let sharedCanvas: HTMLCanvasElement | null = null
let sharedCtx: CanvasRenderingContext2D | null = null
let sharedImageData: ImageData | null = null

function ensureCanvas(): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  imageData: ImageData
} | null {
  if (typeof document === "undefined") return null

  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas")
    sharedCanvas.width = RESOLUTION
    sharedCanvas.height = RESOLUTION
    sharedCtx = sharedCanvas.getContext("2d")
    if (sharedCtx) {
      sharedImageData = sharedCtx.createImageData(RESOLUTION, RESOLUTION)
    }
  }

  if (!sharedCtx || !sharedImageData) return null

  return { canvas: sharedCanvas, ctx: sharedCtx, imageData: sharedImageData }
}

export function getBlurhashDataUri(
  blurhash: string | null | undefined,
): string | null {
  if (!blurhash) return null

  const cached = cache.get(blurhash)
  if (cached) return cached

  const shared = ensureCanvas()
  if (!shared) return null

  try {
    const pixels = decodeBlurHash(blurhash, RESOLUTION, RESOLUTION)

    shared.imageData.data.set(pixels)
    shared.ctx.putImageData(shared.imageData, 0, 0)

    const uri = shared.canvas.toDataURL()
    cache.set(blurhash, uri)

    return uri
  } catch {
    return null
  }
}
