// Stage the full runtime dependency closure of kokoro-js (the local
// text-to-speech engine) into a destination node_modules directory.
//
// The worker is bundled separately by esbuild, and kokoro-js and
// @huggingface/transformers are marked external there so their native
// dependencies (onnxruntime-node, sharp) are loaded from disk at runtime rather
// than bundled. Next.js's standalone tracing never sees these packages (they are
// only reached through the worker bundle, not the server), so, exactly like the
// @parcel and kuromoji copies in the Dockerfile, they must be copied in
// explicitly. This walks the closure so the list never has to be maintained by
// hand as transformers.js changes its dependencies.
//
// dependencies and installed optionalDependencies are both followed: the latter
// is how sharp's platform-specific native binary (@img/sharp-<platform>) is
// captured. Anything not installed for the build platform is simply skipped.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { dirname, join, relative } from "node:path"

const root = join(process.cwd(), "node_modules")
const dest = process.argv[2]
if (!dest) {
  console.error("usage: node collect-tts-deps.mjs <destination-node_modules>")
  process.exit(1)
}

// Resolve a package the way Node would from `fromDir`: nearest nested
// node_modules first, then walking up to the workspace root (yarn hoists most
// packages there).
function resolvePackageDir(name, fromDir) {
  let dir = fromDir
  for (;;) {
    const candidate = join(dir, "node_modules", name, "package.json")
    if (existsSync(candidate)) return dirname(candidate)
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const staged = new Set()
const missing = new Set()

function walk(name, fromDir) {
  const packageDir = resolvePackageDir(name, fromDir)
  if (!packageDir) {
    missing.add(name)
    return
  }
  const rel = relative(root, packageDir)
  if (staged.has(rel)) return
  staged.add(rel)
  cpSync(packageDir, join(dest, rel), { recursive: true })

  let manifest = {}
  try {
    manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"))
  } catch {
    return
  }
  const deps = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.optionalDependencies ?? {}),
  }
  for (const dep of Object.keys(deps)) walk(dep, packageDir)
}

walk("kokoro-js", process.cwd())

// onnxruntime-node ships native binaries for every OS and architecture, plus
// large GPU execution-provider libraries (CUDA and TensorRT, together roughly a
// gigabyte). We only ever run the build platform, on CPU (the TTS model runs on
// CPU), so drop everything else to keep the image small.
const napi = join(dest, "onnxruntime-node", "bin", "napi-v3")
if (existsSync(napi)) {
  for (const os of readdirSync(napi)) {
    if (os !== "linux") {
      rmSync(join(napi, os), { recursive: true, force: true })
      continue
    }
    const osDir = join(napi, os)
    for (const arch of readdirSync(osDir)) {
      if (arch !== process.arch) {
        rmSync(join(osDir, arch), { recursive: true, force: true })
        continue
      }
      for (const gpuProvider of [
        "libonnxruntime_providers_cuda.so",
        "libonnxruntime_providers_tensorrt.so",
      ]) {
        rmSync(join(osDir, arch, gpuProvider), { force: true })
      }
    }
  }
}

console.log(`Staged ${staged.size} TTS runtime packages into ${dest}`)
if (missing.size) {
  console.log(
    `Skipped ${missing.size} not installed for this platform: ${[...missing].join(", ")}`,
  )
}
