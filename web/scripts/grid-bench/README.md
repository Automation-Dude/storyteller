# grid-bench

A profiling loop for the v3 book grid's resize behavior. Drives real
interactions (panel drag, sidebar toggle, panel open) in **Chromium and
Firefox** and reports frame timing plus the reflow **flash** (blank frames)
directly, so iterating on `use-virtual-grid.ts` doesn't need a manual DevTools
session.

## Run

```sh
# against whatever server is on http://localhost:8001
GRID_BENCH_EMAIL=you@example.com GRID_BENCH_PASSWORD=secret yarn bench:grid
```

Flags:

- `--engine=chromium|firefox|both` (default both)
- `--scenario=drag|toggle|open|all` (default all)
- `--base=http://localhost:8001`, `--path=/v3/books`
- `--trace` — Chromium CDP timeline; prints the top tasks per scenario (where
  the time goes: Layout / RecalculateStyles / Paint / JS function).
- `--screenshots` — dump a PNG per scenario to `out/`.
- `--headed` — watch it drive.

## Fair numbers: use a prod build

dev mode carries StrictMode double-render (and react-scan if `ENABLE_REACT_SCAN`
is set), which inflates JS cost. For representative numbers build first:

```sh
yarn build && PORT=8001 yarn start
GRID_BENCH_EMAIL=... GRID_BENCH_PASSWORD=... yarn bench:grid --trace
```

Use `--engine=firefox --scenario=drag` in dev for a fast directional check while
iterating; confirm on a prod build before concluding.

## Reading the table

| column    | meaning                                                        |
| --------- | -------------------------------------------------------------- |
| `blank`   | frames with **zero** grid cards on screen — the flash. Want 0. |
| `minVis`  | fewest cards visible in any frame (>0 is healthy)              |
| `janky`   | frame intervals > 16.7ms                                       |
| `dropped` | frame intervals > 33.3ms                                       |
| `p95ms`   | 95th-percentile frame interval during the interaction          |
| `maxms`   | worst single frame interval                                    |
| `task`    | longest task (longtask observer; Chromium only, coarse)        |

Auth uses the same `/api/v2/token` endpoint as the login page and sets the
`st_token` cookie on the browser context — no login UI is driven.
