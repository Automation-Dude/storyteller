// Pure helpers for planning what gets written to a Kobo. No browser APIs, so
// they can be unit tested in Node; the browser-only writing lives in install.ts.

/**
 * Map a KOReader Kobo-zip entry to its path on the device. The zip's top level
 * is `koreader/` and `koreader.png`, both of which belong under `.adds/`.
 */
export function koreaderEntryToDevicePath(entryPath: string): string {
  return `.adds/${entryPath.replace(/^\/+/, "")}`
}

/**
 * The KFMon installer, which Nickel unpacks and then reboots to apply. KFMon's
 * package is already laid out relative to the USB root (`.kobo/`,
 * `.adds/kfmon/`, `koreader.png`), so unlike KOReader's zip its entries are
 * written verbatim.
 */
export const KFMON_INSTALLER_PATH = ".kobo/KoboRoot.tgz"

/**
 * Where KFMon reads its watches from on the user partition.
 *
 * The browser never writes these. Chromium refuses to create files whose
 * extension it treats as dangerous on Windows, and KFMon is configured purely
 * through .ini files, so `getFileHandle` throws "Name is not allowed" and the
 * launcher ends up installed with nothing to launch. They are folded into
 * KoboRoot.tgz server-side instead and laid down by the device itself on the
 * reboot that follows setup. Skipped on every platform, so there is one
 * install path rather than a Windows-only branch.
 */
export const KFMON_CONFIG_DIR = ".adds/kfmon/config/"

/** True for files the device installs for us, which the browser must skip. */
export function isDeviceInstalledConfig(path: string): boolean {
  return path.startsWith(KFMON_CONFIG_DIR)
}

/**
 * Order KFMon's entries so the installer is written last.
 *
 * Nickel processes KoboRoot.tgz and reboots when the device is ejected. The
 * trigger icon (`koreader.png`) and its watch config must already be on disk by
 * then, or the device reboots into a KFMon with nothing to launch and the
 * reader appears to have simply not installed.
 */
export function kfmonEntriesInWriteOrder(paths: string[]): string[] {
  return [
    ...paths.filter((path) => path !== KFMON_INSTALLER_PATH),
    ...paths.filter((path) => path === KFMON_INSTALLER_PATH),
  ]
}

export const EXCLUDE_LINE = "ExcludeSyncFolders=\\.(?:adds|kobo)"

/**
 * Ensure Nickel does not index KOReader's folders as books. Adds the
 * ExcludeSyncFolders line under [FeatureSettings] only if it is absent, never
 * overwriting a value the user already set.
 */
export function patchEReaderConf(existing: string | null): string {
  const text = existing ?? ""

  if (/^ExcludeSyncFolders=/m.test(text)) {
    return text // respect an existing value
  }

  if (/^\[FeatureSettings\]/m.test(text)) {
    return text.replace(
      /^\[FeatureSettings\][^\n]*$/m,
      `[FeatureSettings]\n${EXCLUDE_LINE}`,
    )
  }

  const prefix = text.length && !text.endsWith("\n") ? `${text}\n` : text
  return `${prefix}[FeatureSettings]\n${EXCLUDE_LINE}\n`
}
