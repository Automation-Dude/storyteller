import assert from "node:assert"
import { describe, it } from "node:test"
import { gunzipSync, gzipSync } from "node:zlib"

import { ZipFile } from "yazl"

import { buildKoboRootInstaller } from "@/ereader/packages"
import { appendToTarGz } from "@/ereader/tar"

const KOREADER_INI = "[watch]\nfilename = /mnt/onboard/koreader.png\n"

/** A stand-in for KFMon's KoboRoot.tgz: one file, gzipped tar. */
function fakeKoboRoot(): Buffer {
  return appendToTarGz(gzipSync(Buffer.alloc(1024)), [
    {
      path: "usr/local/kfmon/bin/kfmon",
      data: Buffer.from("binary"),
      mode: 0o755,
    },
  ])
}

/** A stand-in for the KFMon package as shipped: installer + configs + icon. */
async function fakeKfmonZip(): Promise<Buffer> {
  const zip = new ZipFile()
  zip.addBuffer(fakeKoboRoot(), ".kobo/KoboRoot.tgz")
  zip.addBuffer(Buffer.from(KOREADER_INI), ".adds/kfmon/config/koreader.ini")
  zip.addBuffer(Buffer.from("x"), ".adds/kfmon/config/kfmon.ini")
  zip.addBuffer(Buffer.from("png"), "koreader.png")
  zip.end()

  const chunks: Buffer[] = []
  for await (const chunk of zip.outputStream as AsyncIterable<Buffer>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function tarNames(tarGz: Uint8Array): string[] {
  const tar = gunzipSync(tarGz)
  const names: string[] = []
  let offset = 0
  while (offset + 512 <= tar.length) {
    const head = tar.subarray(offset, offset + 512)
    if (head.every((b) => b === 0)) break
    names.push(head.subarray(0, 100).toString("ascii").replace(/\0.*$/, ""))
    const size = parseInt(
      head.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim(),
      8,
    )
    offset += 512 + size + ((512 - (size % 512)) % 512)
  }
  return names
}

void describe("buildKoboRootInstaller", () => {
  void it("reads a zip handed over as a Node Buffer", async () => {
    // Regression: zip.js throws "Split zip file" on a Node Buffer, and fs and
    // fetch both hand back Buffers, so this is the only shape that ever
    // reaches this function in production. It failed with a 502 in the wild.
    const zip = await fakeKfmonZip()
    assert.ok(Buffer.isBuffer(zip), "the fixture must be a Buffer, as in prod")

    const installer = await buildKoboRootInstaller(zip)
    assert.ok(installer.length > 0)
  })

  void it("carries the watch configs to the device's onboard path", async () => {
    const installer = await buildKoboRootInstaller(await fakeKfmonZip())
    const names = tarNames(installer)

    // Nickel unpacks over /, so configs must be addressed from there.
    assert.ok(names.includes("mnt/onboard/.adds/kfmon/config/koreader.ini"))
    assert.ok(names.includes("mnt/onboard/.adds/kfmon/config/kfmon.ini"))
  })

  void it("keeps KFMon's own payload intact", async () => {
    const names = tarNames(await buildKoboRootInstaller(await fakeKfmonZip()))
    assert.ok(names.includes("usr/local/kfmon/bin/kfmon"))
  })

  void it("does not ship the icon, which the browser writes itself", async () => {
    const names = tarNames(await buildKoboRootInstaller(await fakeKfmonZip()))
    // Nickel must index koreader.png before the reboot, so it is not in here.
    assert.ok(!names.some((n) => n.endsWith("koreader.png")))
  })

  void it("fails loudly if the package has no KOReader watch config", async () => {
    // Better to 502 on the server than to reboot a device into a launcher
    // that has nothing to launch.
    const zip = new ZipFile()
    zip.addBuffer(fakeKoboRoot(), ".kobo/KoboRoot.tgz")
    zip.end()
    const chunks: Buffer[] = []
    for await (const chunk of zip.outputStream as AsyncIterable<Buffer>) {
      chunks.push(chunk)
    }

    await assert.rejects(
      () => buildKoboRootInstaller(Buffer.concat(chunks)),
      /koreader\.ini/,
    )
  })
})
