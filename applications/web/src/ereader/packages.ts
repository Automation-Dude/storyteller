import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { DATA_DIR } from "@/directories"
import { logger } from "@/logging"

/**
 * The device packages the browser writes to a Kobo: KOReader itself, and the
 * KFMon launcher that makes the Kobo start it. They are the same for every
 * user, so the server downloads each once, caches it, and serves it
 * same-origin (the browser cannot fetch the upstream assets directly without
 * cross-origin trouble).
 *
 * Versions are pinned so a setup is reproducible and we only ship builds we
 * have tested on real hardware. Bump these deliberately, then re-test.
 *
 * KFMon is NOT published on GitHub releases: the repository only carries tags,
 * and upstream distributes the built package as an attachment on its MobileRead
 * thread (see the "How do I install this?" section of its README). So the pin
 * here is a specific attachment, identified by its checksum rather than by a
 * "latest" URL that cannot exist. Both packages are checksum-verified before
 * they are cached or served, so a truncated or swapped download fails loudly
 * here instead of half-installing on someone's device.
 *
 * KOReader is AGPL-3.0 and KFMon is GPL-3.0; redistributing their unmodified
 * release artifacts is permitted. We serve them verbatim.
 */

type PackageSpec = {
  filename: string
  url: string
  /** sha256 of the expected download, verified before caching. */
  sha256: string
  contentType: string
}

const KOREADER_VERSION = "v2026.03"

/** The KFMon build attached to its MobileRead thread (t=274231). */
const KFMON_VERSION = "v1.4.6-191-gca31869"
const KFMON_ATTACHMENT_ID = "223768"

export const PACKAGES = {
  koreader: {
    filename: `koreader-kobo-${KOREADER_VERSION}.zip`,
    url: `https://github.com/koreader/koreader/releases/download/${KOREADER_VERSION}/koreader-kobo-${KOREADER_VERSION}.zip`,
    sha256: "510bbc4618dcc5a2fc54a2a8069f94ea5aa7a47a5d6c5a92b75c22d7b701146f",
    contentType: "application/zip",
  },
  kfmon: {
    // The full KFMon package, not a bare KoboRoot.tgz: it also carries the
    // trigger icon and the watch config that actually make KOReader launchable.
    filename: `KFMon-${KFMON_VERSION}.zip`,
    url: `https://www.mobileread.com/forums/attachment.php?attachmentid=${KFMON_ATTACHMENT_ID}&d=1780864476`,
    sha256: "ddc55dcd984a56a1d039d4b7a4488c09c2a9de9f0ec2732ed468b422dc5cc7e1",
    contentType: "application/zip",
  },
} satisfies Record<string, PackageSpec>

export type PackageName = keyof typeof PACKAGES

function cacheDir(): string {
  return join(DATA_DIR, "ereader-cache")
}

async function readCached(filename: string): Promise<Buffer | null> {
  try {
    return await readFile(join(cacheDir(), filename))
  } catch {
    return null
  }
}

/**
 * Return the package bytes, downloading and caching on first use. Downloads to
 * a temp file and renames into place so a killed download never leaves a
 * truncated file that would be served as if complete.
 */
export async function getPackage(name: PackageName): Promise<Buffer> {
  const spec = PACKAGES[name]

  const cached = await readCached(spec.filename)
  if (cached) {
    if (spec.sha256 && sha256(cached) !== spec.sha256) {
      logger.warn(
        `Cached e-reader package ${spec.filename} failed its checksum; re-downloading`,
      )
    } else {
      return cached
    }
  }

  logger.info(`Downloading e-reader package ${spec.filename} from ${spec.url}`)
  const response = await fetch(spec.url, { redirect: "follow" })
  if (!response.ok) {
    throw new Error(
      `Failed to download ${spec.filename}: HTTP ${response.status}`,
    )
  }
  const bytes = Buffer.from(await response.arrayBuffer())

  if (spec.sha256 && sha256(bytes) !== spec.sha256) {
    throw new Error(
      `Downloaded ${spec.filename} did not match its expected checksum`,
    )
  }

  await mkdir(cacheDir(), { recursive: true })
  const tmp = join(cacheDir(), `${spec.filename}.downloading`)
  await writeFile(tmp, bytes)
  await rename(tmp, join(cacheDir(), spec.filename))

  return bytes
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}
