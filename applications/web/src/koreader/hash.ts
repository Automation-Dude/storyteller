import { createHash } from "node:crypto"
import { type FileHandle, open } from "node:fs/promises"

/**
 * KOReader identifies a document by one of two digests, chosen in its
 * "Document matching method" setting. Both are lowercase md5 hex.
 *
 * The default, "binary", is a partial md5: twelve 1024 byte samples taken at
 * increasing offsets, hashed in order. The offsets look arbitrary because
 * KOReader's loop starts at i = -1 and LuaJIT masks the shift count to five
 * bits, so `lshift(1024, -2)` overflows to 0. The offsets below reproduce
 * that exactly; changing them silently breaks matching for every device.
 *
 * See koreader/frontend/util.lua (partialMD5).
 */
const SAMPLE_SIZE = 1024

export const PARTIAL_MD5_OFFSETS = [
  0, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864,
  268435456, 1073741824,
]

export async function partialMd5(filepath: string): Promise<string> {
  const hash = createHash("md5")
  const buffer = Buffer.alloc(SAMPLE_SIZE)

  let file: FileHandle | undefined
  try {
    file = await open(filepath, "r")
    for (const offset of PARTIAL_MD5_OFFSETS) {
      const { bytesRead } = await file.read(buffer, 0, SAMPLE_SIZE, offset)
      // KOReader stops at the first read that comes back empty, so a short
      // file hashes fewer samples. Matching that is what makes the digests
      // agree.
      if (bytesRead === 0) break
      hash.update(buffer.subarray(0, bytesRead))
    }
  } finally {
    await file?.close()
  }

  return hash.digest("hex")
}

/**
 * The "filename" matching method: md5 of the basename, extension included,
 * directory excluded.
 */
export function filenameMd5(filename: string): string {
  return createHash("md5").update(filename, "utf8").digest("hex")
}
