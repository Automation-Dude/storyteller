import { gunzipSync, gzipSync } from "node:zlib"

/**
 * Minimal USTAR writing, just enough to add files to an existing .tgz.
 *
 * This exists because the browser cannot write every file a Kobo setup needs.
 * Chromium refuses to create files whose extension it classifies as dangerous
 * on Windows (.ini among them, see components/safe_browsing .. download_file_
 * types.asciipb), and the KFMon launcher is configured entirely through .ini
 * files. Nickel extracts /mnt/onboard/.kobo/KoboRoot.tgz over / on boot, as
 * root, so anything we cannot hand to the browser we hand to the device inside
 * that tarball instead.
 *
 * We write tar ourselves rather than take a dependency: the format is fixed,
 * the subset we need is small, and the alternatives ship no types.
 */

const BLOCK = 512
const NAME_LIMIT = 100

function octal(value: number, length: number): string {
  // tar stores numbers as octal, NUL-terminated, zero padded.
  return value.toString(8).padStart(length - 1, "0") + "\0"
}

/** A USTAR header for one regular file. */
function header(path: string, size: number, mode: number): Buffer {
  if (path.length > NAME_LIMIT) {
    // Long names need the prefix field; nothing we ship comes close, so treat
    // it as a bug rather than silently truncating to the wrong path.
    throw new Error(`Tar entry name too long for USTAR: ${path}`)
  }

  const buf = Buffer.alloc(BLOCK)
  buf.write(path, 0, NAME_LIMIT, "utf8")
  buf.write(octal(mode, 8), 100, 8, "ascii")
  buf.write(octal(0, 8), 108, 8, "ascii") // uid: root
  buf.write(octal(0, 8), 116, 8, "ascii") // gid: root
  buf.write(octal(size, 12), 124, 12, "ascii")
  // A fixed mtime keeps the built installer byte-for-byte reproducible, so it
  // can be cached and checksummed like the packages it is built from.
  buf.write(octal(0, 12), 136, 12, "ascii")
  buf.write("        ", 148, 8, "ascii") // checksum field is spaces while summing
  buf.write("0", 156, 1, "ascii") // typeflag: regular file
  buf.write("ustar\0", 257, 6, "ascii")
  buf.write("00", 263, 2, "ascii")
  buf.write("root", 265, 32, "ascii")
  buf.write("root", 297, 32, "ascii")

  let sum = 0
  for (const byte of buf) sum += byte
  // Historic quirk: 6 octal digits, NUL, then a space.
  buf.write(octal(sum, 7), 148, 7, "ascii")
  buf.write(" ", 155, 1, "ascii")

  return buf
}

function pad(size: number): number {
  return (BLOCK - (size % BLOCK)) % BLOCK
}

export type TarFile = {
  /** Path inside the archive, relative to /, e.g. "mnt/onboard/.adds/x.ini". */
  path: string
  data: Uint8Array
  /** Defaults to 0644. */
  mode?: number
}

/**
 * Return a new gzipped tar with `files` appended to `tarGz`.
 *
 * A tar ends with two zeroed blocks; they are dropped before appending so the
 * added entries are not treated as trailing garbage, and re-added afterwards.
 */
export function appendToTarGz(tarGz: Uint8Array, files: TarFile[]): Buffer {
  const tar = gunzipSync(tarGz)

  let end = tar.length
  while (end >= BLOCK && tar.subarray(end - BLOCK, end).every((b) => b === 0)) {
    end -= BLOCK
  }

  const parts: Uint8Array[] = [tar.subarray(0, end)]
  for (const file of files) {
    parts.push(header(file.path, file.data.length, file.mode ?? 0o644))
    parts.push(file.data)
    const padding = pad(file.data.length)
    if (padding) parts.push(Buffer.alloc(padding))
  }
  parts.push(Buffer.alloc(BLOCK * 2))

  return gzipSync(Buffer.concat(parts))
}
