/* eslint-disable no-console -- this is a CLI reporter; stdout is the output */
/* eslint-disable @typescript-eslint/no-non-null-assertion -- window.__bench is guarded by waitForFunction */
/**
 * Grid resize profiling loop.
 *
 * Drives real interactions (panel drag, sidebar toggle, panel open) against a
 * running storyteller server in both Chromium and Firefox, and reports frame
 * timing + the reflow "flash" (blank frames) directly -- so a code -> measure ->
 * tweak loop needs no manual DevTools session. Firefox matters because the flash
 * the user reported is worst there and Puppeteer cannot drive it.
 *
 * Usage:
 *   GRID_BENCH_EMAIL=... GRID_BENCH_PASSWORD=... yarn bench:grid
 *   yarn bench:grid --engine=firefox --scenario=drag --trace --screenshots
 *
 * Auth: POSTs creds to /api/v2/token (same path the login page uses) and sets the
 * st_token cookie on the browser context -- no login UI needed. Runs against
 * whatever server is already on --base (default http://localhost:8001); point it
 * at a prod build (`yarn build && next start`) for numbers unpolluted by
 * react-scan / StrictMode double-render.
 */
import { type Browser, type Page, chromium, firefox } from "playwright"

import { type BenchSummary, INSTRUMENT_SOURCE } from "./instrument"

type Engine = "chromium" | "firefox"
type Scenario = "drag" | "toggle" | "open"

type Args = {
  base: string
  path: string
  engines: Engine[]
  scenarios: Scenario[]
  trace: boolean
  screenshots: boolean
  headed: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (k: string) =>
    argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1]
  const has = (k: string) => argv.includes(`--${k}`)
  const engineArg = get("engine")
  const scenarioArg = get("scenario")
  return {
    base: get("base") ?? "http://localhost:8001",
    path: get("path") ?? "/v3/books",
    engines:
      engineArg && engineArg !== "both"
        ? [engineArg as Engine]
        : ["chromium", "firefox"],
    scenarios:
      scenarioArg && scenarioArg !== "all"
        ? [scenarioArg as Scenario]
        : ["drag", "toggle", "open"],
    trace: has("trace"),
    screenshots: has("screenshots"),
    headed: has("headed"),
  }
}

async function getToken(base: string): Promise<string> {
  const email = process.env["GRID_BENCH_EMAIL"]
  const password = process.env["GRID_BENCH_PASSWORD"]
  if (!email || !password) {
    throw new Error(
      "set GRID_BENCH_EMAIL and GRID_BENCH_PASSWORD (a real login for this server)",
    )
  }
  const fd = new FormData()
  fd.set("usernameOrEmail", email)
  fd.set("password", password)
  const res = await fetch(new URL("/api/v2/token", base), {
    method: "POST",
    body: fd,
  })
  if (!res.ok) throw new Error(`token request failed: ${res.status}`)
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

// ── CDP trace attribution (chromium only, best-effort) ────────────────────────
type TraceEvent = {
  name: string
  ph: string
  dur?: number
  args?: { data?: { functionName?: string; url?: string } }
}
const INTERESTING = new Set([
  "RunTask",
  "FunctionCall",
  "EvaluateScript",
  "Layout",
  "UpdateLayoutTree", // recalc styles
  "Paint",
  "PrePaint",
  "Layerize",
  "CompositeLayers",
  "HitTest",
])

function summarizeTrace(events: TraceEvent[]): string {
  const top = events
    .filter(
      (e) => e.ph === "X" && (e.dur ?? 0) > 2000 && INTERESTING.has(e.name),
    )
    .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
    .slice(0, 4)
    .map((e) => {
      const ms = Math.round((e.dur ?? 0) / 100) / 10
      const fn = e.args?.data?.functionName
      return `${e.name}${fn ? `:${fn}` : ""} ${ms}ms`
    })
  return top.join(" | ") || "-"
}

async function withTrace<T>(
  page: Page,
  enabled: boolean,
  run: () => Promise<T>,
): Promise<{ result: T; trace: string }> {
  if (!enabled || page.context().browser()?.browserType().name() !== "chromium")
    return { result: await run(), trace: "-" }
  const client = await page.context().newCDPSession(page)
  const events: TraceEvent[] = []
  client.on("Tracing.dataCollected", (e) => {
    events.push(...(e.value as unknown as TraceEvent[]))
  })
  await client.send("Tracing.start", {
    categories: "disabled-by-default-devtools.timeline,devtools.timeline",
    transferMode: "ReportEvents",
  })
  try {
    const result = await run()
    const done = new Promise<void>((resolve) =>
      client.once("Tracing.tracingComplete", () => {
        resolve()
      }),
    )
    await client.send("Tracing.end")
    await done
    return { result, trace: summarizeTrace(events) }
  } finally {
    // if run() threw, Tracing.end above never ran; end it so the next scenario's
    // Tracing.start doesn't fail with "already started".
    await client.send("Tracing.end").catch(() => {})
    await client.detach().catch(() => {})
  }
}

// ── scenarios ─────────────────────────────────────────────────────────────
const settle = (page: Page, ms = 700) => page.waitForTimeout(ms)

async function resetPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("[data-index]", { timeout: 15000 })
  await settle(page, 800)
}

async function record(page: Page, action: () => Promise<void>) {
  await page.waitForFunction(() => !!window.__bench, undefined, {
    timeout: 5000,
  })
  await page.evaluate(() => {
    window.__bench!.start()
  })
  await action()
  return page.evaluate(() => window.__bench!.stop())
}

async function scenarioToggle(page: Page): Promise<BenchSummary> {
  return record(page, async () => {
    const trigger = page.locator('[data-sidebar="trigger"]').first()
    for (let i = 0; i < 2; i++) {
      if (await trigger.count()) await trigger.click()
      else await page.keyboard.press("Control+b")
      await page.waitForTimeout(450)
    }
  })
}

async function scenarioOpen(page: Page): Promise<BenchSummary> {
  return record(page, async () => {
    await page.locator("[data-index]").nth(3).click()
    await page.waitForTimeout(800)
  })
}

async function scenarioDrag(page: Page): Promise<BenchSummary> {
  // panel must be open for its resize handle to exist
  await page.locator("[data-index]").nth(3).click()
  await settle(page, 800)
  const handles = page.locator('[data-slot="resize-handle"]')
  const n = await handles.count()
  if (n === 0) throw new Error("no resize handle (panel not open?)")
  // rightmost handle = the detail panel's
  let box = { x: 0, y: 0, width: 0, height: 0 }
  for (let i = 0; i < n; i++) {
    const b = await handles.nth(i).boundingBox()
    if (b && b.x >= box.x) box = b
  }
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  return record(page, async () => {
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    // sweep left (panel wider -> grid narrower -> columns drop) then back
    const amp = 500
    const steps = 60
    for (let i = 0; i <= steps; i++) {
      const phase = Math.sin((i / steps) * Math.PI) // 0..1..0
      await page.mouse.move(cx - amp * phase, cy)
      await page.waitForTimeout(10)
    }
    await page.mouse.up()
    await page.waitForTimeout(300)
  })
}

const RUNNERS: Record<Scenario, (p: Page) => Promise<BenchSummary>> = {
  drag: scenarioDrag,
  toggle: scenarioToggle,
  open: scenarioOpen,
}

type Row = BenchSummary & { engine: Engine; scenario: Scenario; trace: string }

async function runEngine(
  engine: Engine,
  token: string,
  args: Args,
): Promise<Row[]> {
  const launcher = engine === "chromium" ? chromium : firefox
  const browser: Browser = await launcher.launch({ headless: !args.headed })
  const rows: Row[] = []
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
    })
    await context.addCookies([
      { name: "st_token", value: token, url: args.base },
    ])
    await context.addInitScript(INSTRUMENT_SOURCE)
    const page = await context.newPage()
    const url = args.base + args.path

    for (const scenario of args.scenarios) {
      try {
        await resetPage(page, url)
        const { result, trace } = await withTrace(page, args.trace, () =>
          RUNNERS[scenario](page),
        )
        rows.push({ ...result, engine, scenario, trace })
        if (args.screenshots) {
          await page.screenshot({
            path: `scripts/grid-bench/out/${engine}-${scenario}.png`,
          })
        }
      } catch (err) {
        console.error(`  ${engine}/${scenario} failed:`, (err as Error).message)
      }
    }
    await context.close()
  } finally {
    await browser.close()
  }
  return rows
}

function printTable(rows: Row[]) {
  const cols: [string, (r: Row) => string][] = [
    ["engine", (r) => r.engine],
    ["scenario", (r) => r.scenario],
    ["frames", (r) => String(r.frames)],
    ["janky", (r) => String(r.janky)],
    ["dropped", (r) => String(r.dropped)],
    ["p95ms", (r) => String(r.p95)],
    ["maxms", (r) => String(r.maxInterval)],
    ["blank", (r) => String(r.blankFrames)],
    ["minVis", (r) => String(r.minVisible)],
    ["task", (r) => String(r.longestTaskMs)],
  ]
  const widths = cols.map(([h, f]) =>
    Math.max(h.length, ...rows.map((r) => f(r).length)),
  )
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i]!)).join("  ")
  console.log("\n" + line(cols.map(([h]) => h)))
  console.log(widths.map((w) => "-".repeat(w)).join("  "))
  for (const r of rows) console.log(line(cols.map(([, f]) => f(r))))
  const traced = rows.filter((r) => r.trace && r.trace !== "-")
  if (traced.length) {
    console.log("\ntop tasks (chromium trace):")
    for (const r of traced) console.log(`  ${r.scenario}: ${r.trace}`)
  }
  console.log("")
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log(
    `grid-bench: ${args.base}${args.path} | engines=${args.engines.join(",")} | scenarios=${args.scenarios.join(",")}`,
  )
  const token = await getToken(args.base)
  const rows: Row[] = []
  for (const engine of args.engines) {
    console.log(`\n[${engine}] running...`)
    rows.push(...(await runEngine(engine, token, args)))
  }
  printTable(rows)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
