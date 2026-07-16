import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js"

import { type KoboDevice, readFileAtPath, writeFileAtPath } from "./kobo"
import {
  KFMON_INSTALLER_PATH,
  kfmonEntriesInWriteOrder,
  koreaderEntryToDevicePath,
  patchEReaderConf,
} from "./plan"

export type InstallProgress = {
  phase: "koreader" | "launcher" | "config" | "verify"
  message: string
  /** 0..1 within the current phase, when known. */
  fraction?: number
}

export type InstallInputs = {
  device: KoboDevice
  koreaderZip: Uint8Array
  /**
   * The full KFMon package, which carries the trigger icon and watch config as
   * well as the installer. A bare KoboRoot.tgz would install KFMon with nothing
   * to launch.
   */
  kfmonZip: Uint8Array
  configFiles: Record<string, string>
  onProgress: (progress: InstallProgress) => void
}

/** Files that must exist before we let the device install and reboot. */
const REQUIRED_BEFORE_ARMING = [
  // KOReader itself, and the script KFMon's watch config points at.
  ".adds/koreader/reader.lua",
  ".adds/koreader/koreader.sh",
  // Seeded so nothing has to be typed on the device.
  ".adds/koreader/settings/opds.lua",
  ".adds/koreader/settings/kosync.lua",
  // The icon the reader is opened from, and the watch that maps it to KOReader.
  "koreader.png",
  ".adds/kfmon/config/koreader.ini",
]

async function readZipEntries(
  zip: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  const reader = new ZipReader(new Uint8ArrayReader(zip))
  try {
    const files = new Map<string, Uint8Array>()
    for (const entry of await reader.getEntries()) {
      if (entry.directory || !entry.getData) continue
      files.set(
        entry.filename.replace(/^\/+/, ""),
        await entry.getData(new Uint8ArrayWriter()),
      )
    }
    return files
  } finally {
    await reader.close()
  }
}

/**
 * Write a complete, pre-configured KOReader install to the device: the app
 * tree, the KFMon launcher, and the seeded config. Only ever adds or updates
 * KOReader's own files; the user's books and Kobo settings are left alone.
 *
 * The KFMon installer is written last, and only after everything else has been
 * read back off the device. Nickel applies that file and reboots when the
 * device is ejected, so arming it early would let an interrupted setup reboot
 * into a half-installed reader.
 */
export async function installToKobo({
  device,
  koreaderZip,
  kfmonZip,
  configFiles,
  onProgress,
}: InstallInputs): Promise<void> {
  const { root } = device

  // 1. KOReader app tree.
  const koreaderFiles = await readZipEntries(koreaderZip)
  let done = 0
  for (const [entryPath, data] of koreaderFiles) {
    await writeFileAtPath(root, koreaderEntryToDevicePath(entryPath), data)
    done++
    onProgress({
      phase: "koreader",
      message: "Installing KOReader",
      fraction: done / koreaderFiles.size,
    })
  }

  // 2. The launcher, minus its installer: the trigger icon, the watch config
  //    that points at KOReader, and KFMon's own resources. KFMon's package is
  //    already laid out relative to the USB root, so it is written verbatim.
  onProgress({ phase: "launcher", message: "Installing the launcher" })
  const kfmonFiles = await readZipEntries(kfmonZip)
  const installer = kfmonFiles.get(KFMON_INSTALLER_PATH)
  if (!installer) {
    throw new Error(
      "The launcher package is missing its installer. Please try again.",
    )
  }
  for (const path of kfmonEntriesInWriteOrder([...kfmonFiles.keys()])) {
    if (path === KFMON_INSTALLER_PATH) continue
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await writeFileAtPath(root, path, kfmonFiles.get(path)!)
  }

  // 3. Seeded config: library and sync, so nothing is typed on the device.
  onProgress({ phase: "config", message: "Configuring your library and sync" })
  for (const [relativePath, contents] of Object.entries(configFiles)) {
    await writeFileAtPath(root, `.adds/koreader/${relativePath}`, contents)
  }

  // Keep KOReader's folders out of the Kobo library view.
  const confPath = ".kobo/Kobo/Kobo eReader.conf"
  const patched = patchEReaderConf(await readFileAtPath(root, confPath))
  await writeFileAtPath(root, confPath, patched)

  // 4. Confirm the load-bearing files are really on the device before we arm
  //    the install, so a failure here leaves the Kobo exactly as it was.
  onProgress({ phase: "verify", message: "Checking the installation" })
  for (const path of REQUIRED_BEFORE_ARMING) {
    if ((await readFileAtPath(root, path)) === null) {
      throw new Error(
        `Setup could not confirm ${path} was written, so it stopped before ` +
          `changing your e-reader. It is safe to unplug and try again.`,
      )
    }
  }

  // 5. Arm it: the Kobo installs this and reboots once it is unplugged.
  await writeFileAtPath(root, KFMON_INSTALLER_PATH, installer)
  if ((await readFileAtPath(root, KFMON_INSTALLER_PATH)) === null) {
    throw new Error(
      `Setup could not confirm ${KFMON_INSTALLER_PATH} was written. Please try again.`,
    )
  }
}
