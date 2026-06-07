// controlled installer for the epubcheck jar used by upgrade.test.ts
//
// epubchecker's own postinstall download is disabled via dependenciesMeta.built
// in the root package.json: it fetches from the github release cdn with no
// timeout and no retry, so a flaky cdn hangs yarn install forever (it took down
// ci builds that never even need the jar). we only need epubcheck when running
// the epub tests, so this fetches it on demand instead, with a timeout and
// retries, and is a no-op once installed.

import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const AdmZip = require("adm-zip")

const version = "5.2.1"
const url = `https://github.com/w3c/epubcheck/releases/download/v${version}/epubcheck-${version}.zip`

// epubchecker hardcodes the jar path relative to its own package dir, so we
// extract into exactly that location for it to find at runtime.
const epubcheckerDir = path.dirname(require.resolve("epubchecker/package.json"))
const vendorsDir = path.join(epubcheckerDir, "vendors")
const jar = path.join(vendorsDir, `epubcheck-${version}`, "epubcheck.jar")

const attempts = 5
const timeoutMs = 120_000

if (fs.existsSync(jar)) {
  console.log(`epubcheck ${version} already installed`)
  process.exit(0)
}

for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    console.log(`downloading epubcheck ${version} (attempt ${attempt}/${attempts})`)
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) throw new Error(`http ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.mkdirSync(vendorsDir, { recursive: true })
    new AdmZip(buffer).extractAllTo(vendorsDir, true)
    console.log(`installed epubcheck to ${vendorsDir}`)
    process.exit(0)
  } catch (err) {
    console.error(`attempt ${attempt} failed: ${err.message}`)
    if (attempt === attempts) {
      console.error("could not install epubcheck, run the epub tests again once the network recovers")
      process.exit(1)
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt))
  }
}
