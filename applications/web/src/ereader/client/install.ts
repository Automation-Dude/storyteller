import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
} from "@zip.js/zip.js"

import {
  type KoboDevice,
  readFileAtPath,
  writeFileAtPath,
} from "./kobo"
import { koreaderEntryToDevicePath, patchEReaderConf } from "./plan"

export type InstallProgress = {
  phase: "koreader" | "launcher" | "config" | "verify"
  message: string
  /** 0..1 within the current phase, when known. */
  fraction?: number
}

export type InstallInputs = {
  device: KoboDevice
  koreaderZip: Uint8Array
  kfmonTgz: Uint8Array
  configFiles: Record<string, string>
  onProgress: (progress: InstallProgress) => void
}

/**
 * Write a complete, pre-configured KOReader install to the device: the app
 * tree, the KFMon launcher, and the seeded config. Only ever adds or updates
 * KOReader's own files; the user's books and Kobo settings are left alone.
 */
export async function installToKobo({
  device,
  koreaderZip,
  kfmonTgz,
  configFiles,
  onProgress,
}: InstallInputs): Promise<void> {
  const { root } = device

  // 1. KOReader app tree.
  const reader = new ZipReader(new Uint8ArrayReader(koreaderZip))
  try {
    const entries = await reader.getEntries()
    const files = entries.filter((entry) => !entry.directory)
    let done = 0
    for (const entry of files) {
      if (!entry.getData) continue
      const data = await entry.getData(new Uint8ArrayWriter())
      await writeFileAtPath(
        root,
        koreaderEntryToDevicePath(entry.filename),
        data,
      )
      done++
      onProgress({
        phase: "koreader",
        message: "Installing KOReader",
        fraction: done / files.length,
      })
    }
  } finally {
    await reader.close()
  }

  // 2. The launcher that makes the Kobo start KOReader on reboot.
  onProgress({ phase: "launcher", message: "Installing the launcher" })
  await writeFileAtPath(root, ".kobo/KoboRoot.tgz", kfmonTgz)

  // 3. Seeded config: library and sync, so nothing is typed on the device.
  onProgress({ phase: "config", message: "Configuring your library and sync" })
  for (const [relativePath, contents] of Object.entries(configFiles)) {
    await writeFileAtPath(root, `.adds/koreader/${relativePath}`, contents)
  }

  // Keep KOReader's folders out of the Kobo library view.
  const confPath = ".kobo/Kobo/Kobo eReader.conf"
  const patched = patchEReaderConf(await readFileAtPath(root, confPath))
  await writeFileAtPath(root, confPath, patched)

  // 4. Verify the load-bearing files landed.
  onProgress({ phase: "verify", message: "Checking the installation" })
  const checks = [
    ".adds/koreader/reader.lua",
    ".adds/koreader/settings/opds.lua",
    ".adds/koreader/settings/kosync.lua",
    ".kobo/KoboRoot.tgz",
  ]
  for (const path of checks) {
    if ((await readFileAtPath(root, path)) === null) {
      throw new Error(
        `Setup could not confirm ${path} was written. Please try again.`,
      )
    }
  }
}
