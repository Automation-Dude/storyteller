// installs the epubcheck jar used by upgrade.test.ts
//
// epubchecker's own postinstall download is disabled via dependenciesMeta.built
// in the root package.json: it fetches from the github release cdn with no
// timeout and no retry, so a flaky cdn hangs yarn install forever (it took down
// ci builds that never even need the jar). instead we vendor the release zip at
// vendors/epubcheck-<version>.zip (it is pure java, so one zip works on every
// platform) and extract it on demand here. no network, and a no-op once extracted.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const AdmZip = require("adm-zip")

const version = "5.2.1"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const vendorsDir = path.join(scriptDir, "..", "vendors")
const zip = path.join(vendorsDir, `epubcheck-${version}.zip`)

const jar = path.join(vendorsDir, `epubcheck-${version}`, "epubcheck.jar")

console.log("jar", jar)

if (fs.existsSync(jar)) {
  console.log(`epubcheck ${version} already installed`)
  process.exit(0)
}

if (!fs.existsSync(zip)) {
  console.error(`missing ${zip}`)
  console.error(
    "the vendored zip is stored in git lfs, run `git lfs pull` to fetch it",
  )
  process.exit(1)
}

fs.mkdirSync(vendorsDir, { recursive: true })
new AdmZip(zip).extractAllTo(vendorsDir, true)
console.log(`installed epubcheck ${version} to ${vendorsDir}`)
