// assembles the next.js standalone runtime tree into a compressed resource for
// the tauri bundle. the copy list mirrors the Dockerfile runner stage and
// nix/package.nix installPhase, which are the reference descriptions of the
// runtime layout.
//
// the tree contains natively-compiled addons (better-sqlite3, argon2, sharp,
// align), so it must be assembled on the platform it targets.
//
// usage: tsx scripts/assemble-runtime.ts [--skip-build] [--target <triple>]

import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { getTarget, hostTriple } from "./targets.ts"

const here = dirname(fileURLToPath(import.meta.url))
const tauriRoot = resolve(here, "..")
const repoRoot = resolve(tauriRoot, "..", "..")
const webRoot = join(repoRoot, "applications", "web")
const stagingDir = join(tauriRoot, ".staging", "runtime")
const resourcesDir = join(tauriRoot, "src-tauri", "resources")

const args = process.argv.slice(2)
const targetIdx = args.indexOf("--target")
const triple = targetIdx >= 0 ? args[targetIdx + 1]! : hostTriple()
const target = getTarget(triple)
const skipBuild = args.includes("--skip-build")

if (triple !== hostTriple()) {
  throw new Error(
    `runtime assembly must run on the target platform (host is ${hostTriple()}, requested ${triple}): the standalone tree contains host-compiled native addons`,
  )
}

function run(command: string, cwd: string) {
  console.log(`$ ${command}`)
  execSync(command, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  })
}

function copy(from: string, to: string, what: string) {
  if (!existsSync(from)) throw new Error(`missing ${what}: ${from}`)
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true, force: true })
  console.log(`copied ${what}`)
}

if (!skipBuild) {
  // next build loads .env/.env.local and can bake values into the build
  // output (NEXT_PUBLIC_*, required-server-files.json env); docker avoids
  // this via .dockerignore, we do it by moving the files aside for the
  // duration of the build
  const envFiles = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ]
    .map((name) => join(webRoot, name))
    .filter((path) => existsSync(path))
  for (const path of envFiles) renameSync(path, `${path}.tauri-build-backup`)
  try {
    run(
      "yarn workspaces foreach -Rpt --from @storyteller-platform/web --exclude @storyteller-platform/eslint run build",
      repoRoot,
    )
  } finally {
    for (const path of envFiles) {
      renameSync(`${path}.tauri-build-backup`, path)
    }
  }
}

const standalone = join(webRoot, ".next", "standalone")
if (!existsSync(join(standalone, "applications", "web", "server.js"))) {
  throw new Error(
    `no standalone server at ${standalone} — run the web build first (or drop --skip-build)`,
  )
}

const uuidExt = {
  darwin: "uuid.c.dylib",
  linux: "uuid.c.so",
  win32: "uuid.c.dll",
}[target.platform]
if (!existsSync(join(webRoot, "sqlite", uuidExt))) {
  throw new Error(
    `missing sqlite extension ${uuidExt} — on darwin/linux the web build produces it via build-sqlite-ext.sh; on windows compile it manually (cl /LD sqlite/uuid.c)`,
  )
}

console.log(`staging runtime tree for ${triple}`)
rmSync(stagingDir, { recursive: true, force: true })
mkdirSync(stagingDir, { recursive: true })

const webStaging = join(stagingDir, "applications", "web")

copy(standalone, stagingDir, "standalone server")
// test fixtures get swept up by output file tracing (~740 MB of sample books)
rmSync(join(webStaging, "src", "__fixtures__"), {
  recursive: true,
  force: true,
})
copy(join(webRoot, "public"), join(webStaging, "public"), "public assets")
copy(
  join(webRoot, ".next", "static"),
  join(webStaging, ".next", "static"),
  "static assets",
)
copy(
  join(webRoot, "sqlite", uuidExt),
  join(webStaging, "sqlite", uuidExt),
  "sqlite uuid extension",
)
copy(join(webRoot, "migrations"), join(webStaging, "migrations"), "migrations")
copy(join(webRoot, "work-dist"), join(webStaging, "work-dist"), "worker bundle")
copy(
  join(webRoot, "file-write-dist"),
  join(webStaging, "file-write-dist"),
  "file write worker bundle",
)

// only the target platform's align prebuild: node-gyp-build resolves
// prebuilds/<platform>-<arch> at runtime
const alignPrebuild = join(
  repoRoot,
  "libraries",
  "align",
  "prebuilds",
  target.alignPrebuild,
)
copy(
  alignPrebuild,
  join(
    webStaging,
    "work-dist",
    "@storyteller-platform",
    "align",
    "prebuilds",
    target.alignPrebuild,
  ),
  "align native addon prebuild",
)
// guard against git-lfs pointer files masquerading as binaries (see
// nix/package.nix preBuild for the same trap)
for (const entry of readdirSync(alignPrebuild)) {
  const content = readFileSync(join(alignPrebuild, entry))
  if (content.subarray(0, 30).toString().includes("git-lfs")) {
    throw new Error(
      `${entry} is a git-lfs pointer, not a real binary — run: git lfs pull`,
    )
  }
}

// echogarden resolves its wasm naively relative to the importing bundle
const wasmDir = join(
  repoRoot,
  "node_modules",
  "@echogarden",
  "icu-segmentation-wasm",
  "wasm",
)
for (const entry of readdirSync(wasmDir).filter((f) => f.endsWith(".wasm"))) {
  copy(join(wasmDir, entry), join(webStaging, "work-dist", entry), entry)
}

// @parcel/watcher platform binaries load dynamically and aren't traced; MERGE
// into the traced node_modules/@parcel (cpSync merges dir contents)
copy(
  join(repoRoot, "node_modules", "@parcel"),
  join(stagingDir, "node_modules", "@parcel"),
  "@parcel packages",
)

// kuroshiro-analyzer-kuromoji calls require.resolve("kuromoji") at runtime to
// find its dict/ directory
copy(
  join(repoRoot, "node_modules", "kuromoji"),
  join(stagingDir, "node_modules", "kuromoji"),
  "kuromoji",
)

const sqliteBinding = join(
  stagingDir,
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node",
)
if (!existsSync(sqliteBinding)) {
  throw new Error(`better-sqlite3 native binding missing at ${sqliteBinding}`)
}

// next writes turbopack's hashed external packages (.next/node_modules/<pkg>-<hash>)
// as symlinks with absolute targets into the build machine's repo, and the
// @parcel copy carries .bin links of the same kind. they dangle on every other
// machine, so remap each one to a relative link at the target's staged
// location (windows gets real copies: symlink extraction needs privileges)
const symlinkSourceRoots: [string, string][] = [
  [join(webRoot, ".next", "standalone"), stagingDir],
  [repoRoot, stagingDir],
]
function* findSymlinks(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) yield path
    else if (entry.isDirectory()) yield* findSymlinks(path)
  }
}
for (const link of [...findSymlinks(stagingDir)]) {
  const rawTarget = readlinkSync(link)
  const absTarget = isAbsolute(rawTarget)
    ? rawTarget
    : resolve(dirname(link), rawTarget)
  if (absTarget.startsWith(stagingDir + sep)) continue
  const staged = symlinkSourceRoots
    .map(([from, to]) =>
      absTarget.startsWith(from + sep)
        ? join(to, absTarget.slice(from.length + 1))
        : null,
    )
    .find((mapped) => mapped !== null && existsSync(mapped))
  if (staged != null && target.platform !== "win32") {
    unlinkSync(link)
    symlinkSync(relative(dirname(link), staged), link)
  } else if (existsSync(absTarget)) {
    unlinkSync(link)
    cpSync(absTarget, link, { recursive: true })
  } else {
    throw new Error(
      `symlink ${relative(stagingDir, link)} -> ${rawTarget} has no staged or on-disk target`,
    )
  }
  console.log(`remapped symlink ${relative(stagingDir, link)}`)
}

mkdirSync(join(webStaging, ".next", "cache"), { recursive: true })

// force resign everything for notarization
if (target.platform === "darwin") {
  function* findFiles(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) yield* findFiles(path)
      else if (entry.isFile()) yield path
    }
  }
  const nativeBinaries = [...findFiles(stagingDir)].filter(
    (path) => path.endsWith(".node") || path.endsWith(".dylib"),
  )
  const identity = process.env.APPLE_SIGNING_IDENTITY
  if (identity) {
    console.log(`codesigning ${nativeBinaries.length} native binaries`)
    for (const path of nativeBinaries) {
      execSync(
        `codesign --force --sign ${JSON.stringify(identity)} --options runtime --timestamp ${JSON.stringify(path)}`,
        { stdio: "inherit" },
      )
    }
  } else {
    console.log(
      `APPLE_SIGNING_IDENTITY unset, leaving ${nativeBinaries.length} native binaries unsigned (fine for local dev, notarization would reject them)`,
    )
  }
}

console.log("compressing runtime tree (this takes a minute)")
mkdirSync(resourcesDir, { recursive: true })
const tarball = join(resourcesDir, "runtime.tar.gz")
rmSync(tarball, { force: true })
execSync(
  `tar -czf ${JSON.stringify(tarball)} -C ${JSON.stringify(stagingDir)} .`,
  {
    stdio: "inherit",
    // keep macOS tar from embedding AppleDouble (._*) metadata entries, which
    // would extract as real files and get picked up as e.g. sql migrations
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  },
)

const id = createHash("sha256")
  .update(readFileSync(tarball))
  .digest("hex")
  .slice(0, 16)
writeFileSync(join(resourcesDir, "runtime-id"), id)

const sizeMb = Math.round(readFileSync(tarball).byteLength / 1024 / 1024)
console.log(`runtime.tar.gz ready (${sizeMb} MB, id ${id})`)
