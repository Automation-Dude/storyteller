import assert from "node:assert"
import { createHash, randomBytes } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"

import { PARTIAL_MD5_OFFSETS, filenameMd5, partialMd5 } from "@/koreader/hash"

let dir: string

void describe("KOReader document hashing", () => {
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "koreader-hash-"))
  })

  after(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  void it("uses the offsets KOReader's partialMD5 actually reads", () => {
    // KOReader loops i = -1..10 doing lshift(1024, 2*i). LuaJIT masks the
    // shift count to 5 bits, so the i = -1 iteration reads offset 0 rather
    // than a negative offset. If these numbers drift, every device silently
    // stops matching its books.
    assert.deepStrictEqual(PARTIAL_MD5_OFFSETS, [
      0, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216,
      67108864, 268435456, 1073741824,
    ])
  })

  void it("hashes the sampled chunks, not the whole file", async () => {
    // A file large enough to reach the fifth sample. Random bytes so a bug
    // that hashes the wrong region cannot coincidentally agree.
    const size = 300_000
    const contents = randomBytes(size)
    const filepath = join(dir, "sampled.epub")
    await writeFile(filepath, contents)

    // Independent oracle: assemble the expected digest straight from the
    // spec's offsets rather than by calling the implementation.
    const expected = createHash("md5")
    for (const offset of PARTIAL_MD5_OFFSETS) {
      if (offset >= size) break
      expected.update(contents.subarray(offset, Math.min(offset + 1024, size)))
    }

    assert.strictEqual(await partialMd5(filepath), expected.digest("hex"))
  })

  void it("differs from a whole-file md5 for a large file", async () => {
    const contents = randomBytes(300_000)
    const filepath = join(dir, "whole.epub")
    await writeFile(filepath, contents)

    const whole = createHash("md5").update(contents).digest("hex")

    assert.notStrictEqual(await partialMd5(filepath), whole)
  })

  void it("hashes a file smaller than one sample as its whole contents", async () => {
    const contents = Buffer.from("a tiny book")
    const filepath = join(dir, "tiny.epub")
    await writeFile(filepath, contents)

    const whole = createHash("md5").update(contents).digest("hex")

    assert.strictEqual(await partialMd5(filepath), whole)
  })

  void it("distinguishes files that differ only past the first sample", async () => {
    const base = randomBytes(200_000)
    const changed = Buffer.from(base)
    // Byte 4096 is the start of the third sample, so a one byte change there
    // must change the digest.
    changed[4096] = (changed[4096] ?? 0) ^ 0xff

    const aPath = join(dir, "a.epub")
    const bPath = join(dir, "b.epub")
    await writeFile(aPath, base)
    await writeFile(bPath, changed)

    assert.notStrictEqual(await partialMd5(aPath), await partialMd5(bPath))
  })

  void it("ignores bytes between samples", async () => {
    const base = randomBytes(200_000)
    const changed = Buffer.from(base)
    // Offset 3000 lies between the second sample (1024 to 2048) and the third
    // (4096 to 5120), so KOReader never reads it and the digests must agree.
    changed[3000] = (changed[3000] ?? 0) ^ 0xff

    const aPath = join(dir, "gap-a.epub")
    const bPath = join(dir, "gap-b.epub")
    await writeFile(aPath, base)
    await writeFile(bPath, changed)

    assert.strictEqual(await partialMd5(aPath), await partialMd5(bPath))
  })

  void it("hashes the basename for the filename matching method", () => {
    // md5("book.epub"), computed independently.
    assert.strictEqual(
      filenameMd5("book.epub"),
      createHash("md5").update("book.epub", "utf8").digest("hex"),
    )
    assert.notStrictEqual(filenameMd5("book.epub"), filenameMd5("other.epub"))
  })
})
