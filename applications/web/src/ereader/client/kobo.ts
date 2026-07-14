// Browser-only helpers for writing a KOReader install to a Kobo over USB using
// the File System Access API. Kept free of React so the logic can be unit
// tested with a mock directory handle; the real end-to-end runs on hardware.

// showDirectoryPicker is not yet in the TypeScript DOM lib.
declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite"
    }) => Promise<FileSystemDirectoryHandle>
  }
}

export type KoboDevice = {
  root: FileSystemDirectoryHandle
  model: string
  serial: string
  firmware: string
}

/**
 * The four-character serial prefix identifies the model. Both revisions of the
 * Clara BW ship the same firmware and layout, so both are accepted.
 * Source: kobopatch-webui koboModels.
 */
const MODELS: Record<string, string> = {
  N365: "Kobo Clara BW",
  P365: "Kobo Clara BW",
  N249: "Kobo Clara Colour",
  N428: "Kobo Clara 2E",
  N418: "Kobo Sage",
  N778: "Kobo Libra 2",
  N306: "Kobo Nia",
  N433: "Kobo Elipsa 2E",
  N604: "Kobo Libra Colour",
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function"
  )
}

/**
 * A Kobo is identified by `.kobo/version`, a single comma-separated line whose
 * first field is the serial (model = first 4 chars) and third is the firmware.
 */
export function parseKoboVersion(versionLine: string): {
  serial: string
  firmware: string
  model: string
} {
  const fields = versionLine.trim().split(",")
  const serial = fields[0] ?? ""
  const firmware = fields[2] ?? "unknown"
  const prefix = serial.slice(0, 4)
  const model = MODELS[prefix] ?? "Kobo e-reader"
  return { serial, firmware, model }
}

/**
 * Ask the user to pick their Kobo, then confirm it really is one before we
 * offer to write anything to it. Throws with a plain-language message on
 * anything that is not a Kobo, so the caller can show it as-is.
 */
export async function pickKobo(): Promise<KoboDevice> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      "This browser cannot set up a device directly. Please use Chrome or Edge on a computer.",
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const root = await window.showDirectoryPicker!({ mode: "readwrite" })

  let koboDir: FileSystemDirectoryHandle
  try {
    koboDir = await root.getDirectoryHandle(".kobo")
  } catch {
    throw new Error(
      "That does not look like a Kobo. Make sure you picked the KOBOeReader drive, not a folder inside it.",
    )
  }

  let versionLine: string
  try {
    const file = await (await koboDir.getFileHandle("version")).getFile()
    versionLine = await file.text()
  } catch {
    throw new Error(
      "Could not read the Kobo's device information. Try unplugging and plugging it back in.",
    )
  }

  const { serial, firmware, model } = parseKoboVersion(versionLine)
  return { root, model, serial, firmware }
}

/**
 * Write a file at a slash-separated path under a directory handle, creating any
 * missing folders. Works for hidden dot-directories like .kobo and .adds.
 */
export async function writeFileAtPath(
  root: FileSystemDirectoryHandle,
  path: string,
  data: Uint8Array | string,
): Promise<void> {
  const parts = path.split("/").filter(Boolean)
  const filename = parts.pop()
  if (!filename) throw new Error(`Invalid file path: ${path}`)

  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }

  const handle = await dir.getFileHandle(filename, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(data as FileSystemWriteChunkType)
  } finally {
    await writable.close()
  }
}

/** Read a file's text, or null if it is not present. */
export async function readFileAtPath(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string | null> {
  const parts = path.split("/").filter(Boolean)
  const filename = parts.pop()
  if (!filename) return null

  let dir = root
  try {
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part)
    }
    const file = await (await dir.getFileHandle(filename)).getFile()
    return await file.text()
  } catch {
    return null
  }
}
