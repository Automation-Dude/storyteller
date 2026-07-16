import assert from "node:assert"
import { describe, it } from "node:test"
import { gunzipSync, gzipSync } from "node:zlib"

import { appendToTarGz } from "@/ereader/tar"

const BLOCK = 512

/** An empty tar: just the two zeroed end-of-archive blocks. */
function emptyTarGz(): Buffer {
  return gzipSync(Buffer.alloc(BLOCK * 2))
}

/**
 * Read entries back out, decoding the header per the USTAR spec rather than
 * reusing the writer's own logic, so a wrong header cannot pass by agreeing
 * with itself. Verifies the checksum the same way tar does.
 */
function readTar(tarGz: Uint8Array): { name: string; data: Buffer }[] {
  const tar = gunzipSync(tarGz)
  const entries: { name: string; data: Buffer }[] = []
  let offset = 0
  while (offset + BLOCK <= tar.length) {
    const head = tar.subarray(offset, offset + BLOCK)
    if (head.every((b) => b === 0)) break

    const name = head.subarray(0, 100).toString("ascii").replace(/\0.*$/, "")
    const size = parseInt(
      head.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim(),
      8,
    )
    const stored = parseInt(
      head
        .subarray(148, 156)
        .toString("ascii")
        .replace(/[\0 ].*$/, "")
        .trim(),
      8,
    )

    // Recompute: the checksum field itself counts as spaces.
    let sum = 0
    for (let i = 0; i < BLOCK; i++) {
      sum += i >= 148 && i < 156 ? 0x20 : head[i]!
    }
    assert.strictEqual(stored, sum, `bad checksum for ${name}`)
    assert.strictEqual(
      head.subarray(257, 262).toString("ascii"),
      "ustar",
      `missing ustar magic for ${name}`,
    )

    offset += BLOCK
    entries.push({
      name,
      data: Buffer.from(tar.subarray(offset, offset + size)),
    })
    offset += size + ((BLOCK - (size % BLOCK)) % BLOCK)
  }
  return entries
}

void describe("appendToTarGz", () => {
  void it("appends a readable entry with intact name, size and content", () => {
    const data = Buffer.from("[watch]\nfilename = /mnt/onboard/koreader.png\n")
    const out = appendToTarGz(emptyTarGz(), [
      { path: "mnt/onboard/.adds/kfmon/config/koreader.ini", data },
    ])

    const entries = readTar(out)
    assert.strictEqual(entries.length, 1)
    assert.strictEqual(
      entries[0]?.name,
      "mnt/onboard/.adds/kfmon/config/koreader.ini",
    )
    assert.deepStrictEqual(entries[0].data, data)
  })

  void it("keeps the entries already in the archive", () => {
    // The real case: KFMon's installer must survive having configs added.
    const first = appendToTarGz(emptyTarGz(), [
      { path: "usr/local/kfmon/bin/kfmon", data: Buffer.from("ELF-ish") },
    ])
    const second = appendToTarGz(first, [
      {
        path: "mnt/onboard/.adds/kfmon/config/kfmon.ini",
        data: Buffer.from("x"),
      },
    ])

    const names = readTar(second).map((e) => e.name)
    assert.deepStrictEqual(names, [
      "usr/local/kfmon/bin/kfmon",
      "mnt/onboard/.adds/kfmon/config/kfmon.ini",
    ])
  })

  void it("pads to 512-byte blocks and ends with the end-of-archive marker", () => {
    // 3 bytes is deliberately not a block multiple.
    const out = appendToTarGz(emptyTarGz(), [
      { path: "a.ini", data: Buffer.from("abc") },
    ])
    const tar = gunzipSync(out)
    assert.strictEqual(tar.length % BLOCK, 0)
    assert.ok(
      tar.subarray(tar.length - BLOCK * 2).every((b) => b === 0),
      "must end with two zeroed blocks",
    )
  })

  void it("round-trips content that spans multiple blocks", () => {
    const data = Buffer.alloc(BLOCK * 2 + 17, 0x41)
    const out = appendToTarGz(emptyTarGz(), [{ path: "big.bin", data }])
    assert.deepStrictEqual(readTar(out)[0]?.data, data)
  })

  void it("refuses a name too long for USTAR rather than writing a wrong path", () => {
    // Silently truncating would put a config somewhere the device never reads.
    assert.throws(
      () =>
        appendToTarGz(emptyTarGz(), [
          {
            path: `mnt/onboard/${"x".repeat(120)}.ini`,
            data: Buffer.from("y"),
          },
        ]),
      /too long/i,
    )
  })
})
