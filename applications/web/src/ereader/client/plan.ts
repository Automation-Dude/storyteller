// Pure helpers for planning what gets written to a Kobo. No browser APIs, so
// they can be unit tested in Node; the browser-only writing lives in install.ts.

/**
 * Map a KOReader Kobo-zip entry to its path on the device. The zip's top level
 * is `koreader/` and `koreader.png`, both of which belong under `.adds/`.
 */
export function koreaderEntryToDevicePath(entryPath: string): string {
  return `.adds/${entryPath.replace(/^\/+/, "")}`
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
