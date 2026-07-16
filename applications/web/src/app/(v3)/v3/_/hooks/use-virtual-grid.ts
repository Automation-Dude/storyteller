"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"

// A uniform-cell virtual grid. Scroll position lives in a ref and the grid only
// re-renders when the visible row window changes, so steady scrolling is
// allocation-free. Geometry is a pure function of the container width, which
// lets resize anchoring and the FLIP re-wrap compute old/new positions
// arithmetically -- never from getBoundingClientRect on cards, which running
// transforms would poison.
//
// Resize is handled IMPERATIVELY: the volatile layout (column count, row
// height, sizer height, the block's translateY, and the scroll anchor) is
// written straight to the DOM every frame, so a continuous width change -- the
// detail-panel open/close/drag animation -- never pays a per-frame React
// re-render. Only the rendered cell window (`range`) comes from React state, and
// it changes just when a row scrolls in or out. This mirrors what the vanilla
// "panel lab" prototype did, which is what made it smooth.
//
// The grid finds its own scroll parent and measures its offset within the
// scroll content, so it works whether it owns the scroll container or sits
// below other content (header, filters) inside an ancestor scroller.
//
// A constant-height list is the degenerate case: pass `fixedColumns: 1` and a
// `rowHeightForColumnWidth` that ignores its argument (returns a fixed row
// height). The column count never changes, so FLIP and resize-anchoring turn
// into no-ops for free. (Per-item measured heights are intentionally out of
// scope -- this virtualizer is uniform-cell only.)

const DEFAULT_OVERSCAN_ROWS = 4
const DEFAULT_FLIP_DURATION = 320
// FLIP duration while the width is still moving (live drag / panel open-close),
// capped short so successive breakpoint re-wraps don't stack into visible lag.
const LIVE_RESIZE_FLIP_DURATION = 540
const DEFAULT_FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"
const DEFAULT_FETCH_AHEAD_ROWS = 3
const DEFAULT_PAUSE_TAIL_ROWS = 6
// hold the column count steady while the width is actively changing; reflow (and
// FLIP) to the natural column count only once it has been quiet this long. keeps
// a continuous resize (panel/sidebar animation, window drag) scaling smoothly
// instead of re-wrapping mid-motion -- the "settle then reflow" pattern.
const RESIZE_SETTLE_MS = 120

export type VirtualGridGeometry = {
  // smallest a cell may get before a column is dropped
  minColumnWidth: number
  gapX: number
  gapY: number
  padX: number
  padY: number
  // cell height for a given column width (covers + text, etc.)
  rowHeightForColumnWidth: (columnWidth: number) => number
  // force a fixed column count regardless of width (e.g. mobile = 2)
  fixedColumns?: number
}

export type Metrics = {
  cols: number
  colWidth: number
  rowHeight: number
  // distance between the tops of consecutive rows
  step: number
}

type RowRange = { firstRow: number; lastRow: number }

export type UseVirtualGridOptions = {
  itemCount: number
  geometry: VirtualGridGeometry
  overscanRows?: number

  // resolve the scroll container from the grid's sizer element. defaults to the
  // nearest scrollable ancestor.
  getScrollElement?: (sizer: HTMLElement) => HTMLElement | null

  // keep this item pinned across a reflow; falls back to the topmost visible.
  anchorIndex?: number | null

  // motion
  animate?: boolean
  reducedMotion?: boolean
  flipDuration?: number
  flipEasing?: string
  // when true, reflow the column count continuously as the width changes instead
  // of holding it until the width settles. use this for a manual drag-resize
  // (immediate feedback); leave false for animated width changes (toggle/open),
  // which look better reflowing once at the end.
  liveResize?: boolean

  // infinite loading
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onFetchNextPage?: () => void
  fetchAheadRows?: number

  // cover-load deferral: pause image loads when a next-page fetch is competing
  // for connections (scrolling down, near the tail, more to load).
  deferCoverLoads?: boolean
  pauseTailRows?: number
}

export type VirtualGrid = {
  // attach to the sizer div: `<div ref={sizerRef} style={sizerStyle}>`
  sizerRef: (node: HTMLDivElement | null) => void
  // attach to the inner grid: `<div ref={gridRef} style={gridStyle}>`
  gridRef: React.RefObject<HTMLDivElement | null>
  sizerStyle: React.CSSProperties
  gridStyle: React.CSSProperties
  metrics: Metrics
  range: RowRange
  startIndex: number
  endIndex: number
  totalHeight: number
  // whether cover images may load right now (false while deferring near tail)
  imagesActive: boolean
  // bring an item's row into view if it isn't already (align: auto). used for
  // keyboard navigation over the virtualized collection.
  scrollToIndex: (index: number) => void
}

function defaultFindScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null
  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return el
    el = el.parentElement
  }
  return null
}

// the natural column count for a width, plus the derived cell metrics.
function metricsFor(
  width: number,
  g: VirtualGridGeometry,
  itemCount = Infinity,
): Metrics {
  const inner = Math.max(0, width - g.padX)
  const cols =
    g.fixedColumns ??
    Math.max(1, Math.floor((inner + g.gapX) / (g.minColumnWidth + g.gapX)))
  return metricsForColumns(width, g, cols, itemCount)
}

// metrics for a GIVEN column count -- used while columns are held frozen during
// a continuous resize, so the cells fluidly scale (colWidth/rowHeight follow the
// width) without the column count changing until the width settles.
//
// cards fill the width (no slack) EXCEPT when there are fewer items than fill a
// row (itemCount < cols): then they stay at the preferred width, left-packed,
// with the slack trailing right, so growing the container never resizes a lone
// card. once the items span two or more rows the grid fills edge-to-edge again.
function metricsForColumns(
  width: number,
  g: VirtualGridGeometry,
  cols: number,
  itemCount = Infinity,
): Metrics {
  const inner = Math.max(0, width - g.padX)
  const safeCols = Math.max(1, cols)
  let colWidth = Math.max(0, (inner - g.gapX * (safeCols - 1)) / safeCols)
  if (itemCount < safeCols) colWidth = Math.min(colWidth, g.minColumnWidth)
  const rowHeight = g.rowHeightForColumnWidth(colWidth)
  return { cols: safeCols, colWidth, rowHeight, step: rowHeight + g.gapY }
}

function totalHeightFor(
  count: number,
  m: Metrics,
  g: VirtualGridGeometry,
): number {
  const rows = m.cols > 0 ? Math.ceil(count / m.cols) : 0
  if (rows === 0) return 0
  return g.padY * 2 + rows * m.rowHeight + (rows - 1) * g.gapY
}

// row top in scroll-content coordinates
function rowTop(
  row: number,
  m: Metrics,
  g: VirtualGridGeometry,
  containerTop: number,
) {
  return containerTop + g.padY + row * m.step
}

function computeRange(
  scrollTop: number,
  viewportHeight: number,
  containerTop: number,
  m: Metrics,
  g: VirtualGridGeometry,
  rowCount: number,
  overscan: number,
): RowRange {
  const top = scrollTop - containerTop - g.padY
  const firstRow = Math.max(0, Math.floor(top / m.step) - overscan)
  const lastRow = Math.min(
    Math.max(0, rowCount - 1),
    Math.floor((top + viewportHeight) / m.step) + overscan,
  )
  return { firstRow, lastRow }
}

// viewport-relative top-left of a cell, computed purely from geometry.
function cellViewport(
  index: number,
  m: Metrics,
  g: VirtualGridGeometry,
  containerTop: number,
  scrollTop: number,
) {
  const col = index % m.cols
  const row = Math.floor(index / m.cols)
  return {
    left: g.padX / 2 + col * (m.colWidth + g.gapX),
    top: rowTop(row, m, g, containerTop) - scrollTop,
  }
}

export function useVirtualGrid(options: UseVirtualGridOptions): VirtualGrid {
  const {
    itemCount,
    geometry,
    overscanRows = DEFAULT_OVERSCAN_ROWS,
    getScrollElement = defaultFindScrollParent,
    anchorIndex = null,
    animate = false,
    reducedMotion = false,
    flipDuration = DEFAULT_FLIP_DURATION,
    flipEasing = DEFAULT_FLIP_EASING,
    hasNextPage = false,
    isFetchingNextPage = false,
    onFetchNextPage,
    fetchAheadRows = DEFAULT_FETCH_AHEAD_ROWS,
    deferCoverLoads = false,
    pauseTailRows = DEFAULT_PAUSE_TAIL_ROWS,
    liveResize = false,
  } = options

  const sizerElRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const scrollElRef = useRef<HTMLElement | null>(null)

  const widthRef = useRef(0)
  const scrollTopRef = useRef(0)
  const containerTopRef = useRef(0)
  const prevScrollRef = useRef(0)
  // column count currently applied to the DOM. held steady during a continuous
  // resize; only the settle pass moves it to the natural count.
  const appliedColsRef = useRef(0)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const resizingRef = useRef(false)
  const flipAnims = useRef(new Map<Element, Animation>())
  const scrollRaf = useRef(0)
  const scrollIdle = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const roRef = useRef<ResizeObserver | null>(null)

  // mirror props so the imperative resize/scroll paths read fresh values
  // without re-subscribing.
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry
  const itemCountRef = useRef(itemCount)
  itemCountRef.current = itemCount
  const anchorIndexRef = useRef(anchorIndex)
  anchorIndexRef.current = anchorIndex
  const overscanRef = useRef(overscanRows)
  overscanRef.current = overscanRows
  const deferRef = useRef(deferCoverLoads)
  const hasNextRef = useRef(hasNextPage)
  const fetchingRef = useRef(isFetchingNextPage)
  const pauseTailRef = useRef(pauseTailRows)
  pauseTailRef.current = pauseTailRows
  const animateRef = useRef(animate)
  animateRef.current = animate
  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion
  const flipDurationRef = useRef(flipDuration)
  flipDurationRef.current = flipDuration
  const flipEasingRef = useRef(flipEasing)
  flipEasingRef.current = flipEasing
  const liveResizeRef = useRef(liveResize)
  liveResizeRef.current = liveResize

  const [metrics, setMetricsState] = useState<Metrics>({
    cols: 0,
    colWidth: 0,
    rowHeight: 0,
    step: 0,
  })
  const [range, setRange] = useState<RowRange>({ firstRow: 0, lastRow: 0 })
  const rangeRef = useRef(range)
  rangeRef.current = range
  const [imagesActive, setImagesActive] = useState(true)
  const imagesActiveRef = useRef(true)

  const setImages = useCallback((active: boolean) => {
    if (imagesActiveRef.current === active) return
    imagesActiveRef.current = active
    setImagesActive(active)
  }, [])

  // re-render the consumer ONLY when the column count changes. colWidth/rowHeight
  // shift every frame during a fluid width animation, but those are consumed
  // imperatively (CSS 1fr + gridAutoRows via syncGridStyles), so folding them
  // into render state would re-render every frame and defeat the whole point.
  // startIndex/endIndex and the cell grouping depend only on `cols`.
  const setMetricsIfChanged = useCallback((next: Metrics) => {
    setMetricsState((prev) => (prev.cols === next.cols ? prev : next))
  }, [])

  useEffect(() => {
    hasNextRef.current = hasNextPage
    fetchingRef.current = isFetchingNextPage
  }, [hasNextPage, isFetchingNextPage])

  useEffect(() => {
    deferRef.current = deferCoverLoads
    if (!deferCoverLoads) setImages(true)
  }, [deferCoverLoads, setImages])

  const m = metrics
  const startIndex = range.firstRow * m.cols
  const endIndex = Math.min(itemCount, (range.lastRow + 1) * m.cols)
  const totalHeight = totalHeightFor(itemCount, m, geometry)

  // measure where the sizer sits within the scroll content (scroll-invariant)
  const measureContainerTop = useCallback(() => {
    const sizer = sizerElRef.current
    const scroller = scrollElRef.current
    if (!sizer || !scroller) return 0
    return (
      sizer.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop
    )
  }, [])

  // write the volatile layout straight to the DOM. the rendered cell window
  // (range) stays React-owned; everything positional is imperative so a
  // continuous width change costs no re-render.
  const syncGridStyles = useCallback(() => {
    const grid = gridRef.current
    const sizer = sizerElRef.current
    if (!grid || !sizer) return
    const g = geometryRef.current
    const n = itemCountRef.current
    const cols = appliedColsRef.current || metricsFor(widthRef.current, g).cols
    const mm = metricsForColumns(widthRef.current, g, cols, n)

    // eslint-disable-next-line react-compiler/react-compiler
    sizer.style.height = `${totalHeightFor(n, mm, g)}px`
    grid.style.gridTemplateColumns = `repeat(${cols}, ${mm.colWidth}px)`
    grid.style.gridAutoRows = `${mm.rowHeight}px`
    grid.style.transform = `translateY(${
      g.padY + rangeRef.current.firstRow * mm.step
    }px)`
  }, [])

  // recompute the visible window from the current scroll + metrics; re-render
  // only when it actually changes.
  //
  // `growOnly` is the per-frame resize path: as cards scale during a held-count
  // rescale, the exact window drifts a row every frame, and committing each drift
  // re-renders the whole card set every frame -- that React work
  // (performWorkUntilDeadline) is the real resize cost, worst on Firefox. In
  // growOnly mode we keep the current window and only re-render when it must
  // EXPAND to keep the viewport covered (union with the current range), so a
  // stable or shrinking window costs zero renders and a widening one can never go
  // blank. The exact window is restored once, on settle (endResize).
  const updateRange = useCallback(
    (growOnly = false) => {
      const scroller = scrollElRef.current
      if (!scroller) return undefined
      const g = geometryRef.current
      const cols =
        appliedColsRef.current || metricsFor(widthRef.current, g).cols
      const mm = metricsForColumns(
        widthRef.current,
        g,
        cols,
        itemCountRef.current,
      )
      const containerTop = measureContainerTop()
      containerTopRef.current = containerTop
      const rc = mm.cols > 0 ? Math.ceil(itemCountRef.current / mm.cols) : 0
      const desired = computeRange(
        scrollTopRef.current,
        scroller.clientHeight,
        containerTop,
        mm,
        g,
        rc,
        overscanRef.current,
      )
      setRange((prev) => {
        const next = growOnly
          ? {
              firstRow: Math.min(prev.firstRow, desired.firstRow),
              lastRow: Math.max(prev.lastRow, desired.lastRow),
            }
          : desired
        return prev.firstRow === next.firstRow && prev.lastRow === next.lastRow
          ? prev
          : next
      })
      return desired
    },
    [measureContainerTop],
  )

  // FLIP the cards from their old-layout positions to the new (already applied)
  // layout. computed arithmetically, and against the old/new scroll positions
  // so the anchor's scroll shift is folded into the animation too.
  const playFlip = useCallback(
    (
      oldM: Metrics,
      newM: Metrics,
      containerTop: number,
      oldScrollTop: number,
      newScrollTop: number,
    ) => {
      if (!animateRef.current || reducedRef.current) return
      const grid = gridRef.current
      if (!grid || oldM.cols === 0) return
      const g = geometryRef.current
      // live reflow (drag, panel open/close): the width is still moving, so a
      // long catch-up FLIP piles up across breakpoints and reads as lag. use a
      // short snappy FLIP so each re-wrap resolves before the next. discrete
      // reflows (window resize) keep the full duration.
      const duration = liveResizeRef.current
        ? Math.min(flipDurationRef.current, LIVE_RESIZE_FLIP_DURATION)
        : flipDurationRef.current
      const nodes = grid.querySelectorAll<HTMLElement>("[data-index]")
      for (const node of nodes) {
        const index = Number(node.dataset["index"])
        const from = cellViewport(index, oldM, g, containerTop, oldScrollTop)
        const to = cellViewport(index, newM, g, containerTop, newScrollTop)
        const dx = from.left - to.left
        const dy = from.top - to.top
        if (Math.abs(dx) + Math.abs(dy) < 1) continue

        flipAnims.current.get(node)?.cancel()
        const anim = node.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration, easing: flipEasingRef.current },
        )
        flipAnims.current.set(node, anim)
        const done = () => {
          if (flipAnims.current.get(node) === anim)
            flipAnims.current.delete(node)
        }
        anim.onfinish = done
        anim.oncancel = done
      }
    },
    [],
  )

  // ── fetch next page when the tail comes within reach ────────────────────
  const rowCount = m.cols > 0 ? Math.ceil(itemCount / m.cols) : 0
  useEffect(() => {
    if (
      onFetchNextPage &&
      hasNextPage &&
      !isFetchingNextPage &&
      rowCount > 0 &&
      range.lastRow >= rowCount - fetchAheadRows
    ) {
      onFetchNextPage()
    }
  }, [
    range.lastRow,
    rowCount,
    hasNextPage,
    isFetchingNextPage,
    onFetchNextPage,
    fetchAheadRows,
  ])

  // ── scroll ──────────────────────────────────────────────────────────────
  const onScroll = useCallback(() => {
    const scroller = scrollElRef.current
    if (!scroller) return
    scrollTopRef.current = scroller.scrollTop

    const grid = gridRef.current
    if (grid) {
      // eslint-disable-next-line react-compiler/react-compiler
      grid.style.pointerEvents = "none"
    }
    clearTimeout(scrollIdle.current)
    scrollIdle.current = setTimeout(() => {
      if (gridRef.current) gridRef.current.style.pointerEvents = ""
      setImages(true)
    }, 150)

    if (scrollRaf.current) return
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      const desired = updateRange()
      if (!desired) return
      const g = geometryRef.current
      const mm = metricsFor(widthRef.current, g, itemCountRef.current)
      const rc = mm.cols > 0 ? Math.ceil(itemCountRef.current / mm.cols) : 0

      // pause covers only when a next-page fetch is genuinely competing.
      const goingDown = scrollTopRef.current > prevScrollRef.current
      prevScrollRef.current = scrollTopRef.current
      const nearTail = desired.lastRow >= rc - pauseTailRef.current
      const competing = hasNextRef.current && (fetchingRef.current || nearTail)
      setImages(!(deferRef.current && goingDown && competing))
    })
  }, [updateRange, setImages])

  // bring an item's row into view (align: auto)
  const scrollToIndex = useCallback(
    (index: number) => {
      const scroller = scrollElRef.current
      if (!scroller) return
      const g = geometryRef.current
      const mm = metricsFor(widthRef.current, g, itemCountRef.current)
      if (mm.cols === 0) return
      const containerTop = measureContainerTop()
      const top = rowTop(Math.floor(index / mm.cols), mm, g, containerTop)
      const bottom = top + mm.rowHeight
      const viewTop = scroller.scrollTop
      const viewBottom = viewTop + scroller.clientHeight
      // eslint-disable-next-line react-compiler/react-compiler
      if (top < viewTop + g.padY) scroller.scrollTop = Math.max(0, top - g.padY)
      else if (bottom > viewBottom - g.padY)
        scroller.scrollTop = bottom - scroller.clientHeight + g.padY
    },
    [measureContainerTop],
  )

  // ── resize (imperative, settle-debounced) ───────────────────────────────
  // pin an anchor card to its viewport offset across a metrics change (old ->
  // new). writes scrollTop imperatively and returns the frame of reference the
  // FLIP needs. sets the new content height first so the scroll clamp is right.
  const anchorScroll = useCallback(
    (oldM: Metrics, newM: Metrics) => {
      const scroller = scrollElRef.current
      const sizer = sizerElRef.current
      const g = geometryRef.current
      const containerTop = measureContainerTop()
      containerTopRef.current = containerTop
      const oldScrollTop = scroller?.scrollTop ?? 0
      let newScrollTop = oldScrollTop
      if (scroller && sizer) {
        const index = pickAnchorIndex(
          oldM,
          g,
          containerTop,
          oldScrollTop,
          scroller.clientHeight,
          itemCountRef.current,
          anchorIndexRef.current,
        )
        if (index >= 0) {
          const offset =
            rowTop(Math.floor(index / oldM.cols), oldM, g, containerTop) -
            oldScrollTop
          const newTop = rowTop(
            Math.floor(index / newM.cols),
            newM,
            g,
            containerTop,
          )
          // read clientHeight and compute the clamp BEFORE writing, so no layout
          // read follows a style write in this frame (Firefox layout thrash). the
          // new content height is known arithmetically -- no scrollHeight read.
          // eslint-disable-next-line react-compiler/react-compiler
          sizer.style.height = `${totalHeightFor(itemCountRef.current, newM, g)}px`
          const maxScroll = Math.max(
            0,
            scroller.scrollHeight - scroller.clientHeight,
          )
          newScrollTop = Math.max(0, Math.min(maxScroll, newTop - offset))
          scroller.scrollTop = newScrollTop
          scrollTopRef.current = newScrollTop
        }
      }
      return { containerTop, oldScrollTop, newScrollTop }
    },
    [measureContainerTop],
  )

  // change the applied column count ATOMICALLY. the flash was: writing the new
  // layout imperatively (cols/transform/scrollTop) while the old cell set was
  // still mounted, before React re-rendered the new window -- for that gap the
  // old cells sat in the new grid at the wrong offset (and the new scrollTop
  // pushed them off-screen) -> blank. flushSync commits the new metrics + range
  // in one synchronous unit, so the layout effect (syncGridStyles) and the new
  // cells land together in the same frame. this is affordable because it runs
  // once per settle / breakpoint crossing, NOT per frame.
  const commitColumns = useCallback(
    (oldM: Metrics, newM: Metrics) => {
      const scroller = scrollElRef.current
      const sizer = sizerElRef.current
      const g = geometryRef.current
      const containerTop = measureContainerTop()
      containerTopRef.current = containerTop
      const oldScrollTop = scroller?.scrollTop ?? 0
      let newScrollTop = oldScrollTop

      if (scroller && sizer) {
        const index = pickAnchorIndex(
          oldM,
          g,
          containerTop,
          oldScrollTop,
          scroller.clientHeight,
          itemCountRef.current,
          anchorIndexRef.current,
        )
        // set the content height now so the scroll clamp reads the new range
        // eslint-disable-next-line react-compiler/react-compiler
        sizer.style.height = `${totalHeightFor(itemCountRef.current, newM, g)}px`
        if (index >= 0) {
          const offset =
            rowTop(Math.floor(index / oldM.cols), oldM, g, containerTop) -
            oldScrollTop
          const newTop = rowTop(
            Math.floor(index / newM.cols),
            newM,
            g,
            containerTop,
          )
          const maxScroll = Math.max(
            0,
            scroller.scrollHeight - scroller.clientHeight,
          )
          newScrollTop = Math.max(0, Math.min(maxScroll, newTop - offset))
        }
      }

      const clientHeight = scroller?.clientHeight ?? 0
      const rc = newM.cols > 0 ? Math.ceil(itemCountRef.current / newM.cols) : 0
      const newRange = computeRange(
        newScrollTop,
        clientHeight,
        containerTop,
        newM,
        g,
        rc,
        overscanRef.current,
      )

      flushSync(() => {
        appliedColsRef.current = newM.cols
        scrollTopRef.current = newScrollTop
        setMetricsState(newM)
        setRange(newRange)
      })
      // sizer height is set (layout effect ran inside flushSync); safe to scroll
      if (scroller) scroller.scrollTop = newScrollTop
      playFlip(oldM, newM, containerTop, oldScrollTop, newScrollTop)
    },
    [measureContainerTop, playFlip],
  )

  // reflow the held column count to the natural one for the current width. no-op
  // if the count is already natural (so it is safe to call after a live/immediate
  // resize that already reflowed).
  const reflowColumns = useCallback(
    (basisWidth: number) => {
      const g = geometryRef.current
      const width = widthRef.current
      const applied = appliedColsRef.current
      if (applied === 0) return
      const target = metricsFor(width, g).cols
      if (target === applied) return
      commitColumns(
        metricsForColumns(basisWidth, g, applied, itemCountRef.current),
        metricsFor(width, g, itemCountRef.current),
      )
    },
    [commitColumns],
  )

  // the width has gone quiet: restore interactivity and reflow to the natural
  // column count (no-op when the live/immediate path already got there).
  const endResize = useCallback(() => {
    resizingRef.current = false
    const grid = gridRef.current
    // eslint-disable-next-line react-compiler/react-compiler
    if (grid) grid.style.pointerEvents = ""
    reflowColumns(widthRef.current)
    // per-frame rescale only grows the window; correct it to the exact window
    // now that the width is quiet (a reflow already did this if cols changed).
    updateRange()
  }, [reflowColumns, updateRange])

  const handleResize = useCallback(() => {
    const sizer = sizerElRef.current
    if (!sizer) return
    const g = geometryRef.current
    const width = sizer.clientWidth
    const prevWidth = widthRef.current

    // first non-zero width: apply the natural columns immediately (no freeze).
    if (prevWidth === 0) {
      widthRef.current = width
      appliedColsRef.current = metricsFor(width, g).cols
      syncGridStyles()
      setMetricsIfChanged(
        metricsForColumns(
          width,
          g,
          appliedColsRef.current,
          itemCountRef.current,
        ),
      )
      updateRange()
      return
    }

    // height-only change: just recompute the visible window.
    if (width === prevWidth) {
      syncGridStyles()
      updateRange()
      return
    }

    // width changing. drop pointer-events so cards under the cursor don't fire
    // their hover animations while the grid reshuffles; restore once quiet.
    const grid = gridRef.current
    if (grid && !resizingRef.current) {
      resizingRef.current = true
      // eslint-disable-next-line react-compiler/react-compiler
      grid.style.pointerEvents = "none"
    }
    // restore pointer-events (and reflow to natural, if still held) once quiet.
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(endResize, RESIZE_SETTLE_MS)

    const applied = appliedColsRef.current || metricsFor(prevWidth, g).cols
    appliedColsRef.current = applied

    if (liveResizeRef.current || !animateRef.current) {
      // manual drag OR non-animated (instant sidebar toggle): follow the width
      // now -- rescale at the same count, or reflow atomically at a breakpoint.
      widthRef.current = width
      const n = itemCountRef.current
      const target = metricsFor(width, g).cols
      const oldM = metricsForColumns(prevWidth, g, applied, n)
      if (target === applied) {
        anchorScroll(oldM, metricsForColumns(width, g, applied, n))
        syncGridStyles()
        updateRange(true)
      } else {
        commitColumns(oldM, metricsFor(width, g, n))
      }
      return
    }

    // animated (panel open/close): HOLD the column count, rescale + keep the
    // anchor pinned; the settle pass reflows + FLIPs once the width is quiet.
    widthRef.current = width
    anchorScroll(
      metricsForColumns(prevWidth, g, applied, itemCountRef.current),
      metricsForColumns(width, g, applied, itemCountRef.current),
    )
    syncGridStyles()
    updateRange(true)
  }, [
    syncGridStyles,
    updateRange,
    setMetricsIfChanged,
    anchorScroll,
    commitColumns,
    endResize,
  ])

  // ── bind scroll element + observe size when the sizer mounts ─────────────
  const sizerRef = useCallback(
    (node: HTMLDivElement | null) => {
      sizerElRef.current = node

      const prevScroller = scrollElRef.current
      if (prevScroller) prevScroller.removeEventListener("scroll", onScroll)
      roRef.current?.disconnect()
      roRef.current = null

      if (!node) {
        scrollElRef.current = null
        return
      }

      const scroller = getScrollElement(node) ?? node
      scrollElRef.current = scroller
      scroller.addEventListener("scroll", onScroll, { passive: true })
      scrollTopRef.current = scroller.scrollTop
      containerTopRef.current = measureContainerTop()

      // observe the scroller only (its content-box tracks both the available
      // width -- panel/sidebar drives -- and viewport height, and shrinks when a
      // scrollbar appears). the sizer is w-full so its width follows. crucially
      // we WRITE sizer.style.height inside the callback, so not observing the
      // sizer avoids a self-triggered ResizeObserver loop.
      const ro = new ResizeObserver(handleResize)
      ro.observe(scroller)
      roRef.current = ro

      widthRef.current = node.clientWidth
      appliedColsRef.current = metricsFor(
        node.clientWidth,
        geometryRef.current,
      ).cols
      setMetricsIfChanged(
        metricsForColumns(
          node.clientWidth,
          geometryRef.current,
          appliedColsRef.current,
          itemCountRef.current,
        ),
      )
      updateRange()
    },
    [
      getScrollElement,
      onScroll,
      measureContainerTop,
      handleResize,
      updateRange,
      setMetricsIfChanged,
    ],
  )

  // keep the DOM layout in sync with committed state (covers the resize/scroll
  // re-renders once React catches up, and item-count / geometry changes). runs
  // before paint. metrics/range keep stable identity unless they change, so
  // this doesn't fire on unrelated consumer re-renders.
  useLayoutEffect(() => {
    syncGridStyles()
  }, [metrics, range, itemCount, geometry, syncGridStyles])

  // recompute metrics + window when the item count or geometry changes. a
  // geometry change (card-size preference) is a deliberate discrete change, so
  // reflow to the natural column count immediately -- no settle-freeze.
  useLayoutEffect(() => {
    appliedColsRef.current = metricsFor(widthRef.current, geometry).cols
    setMetricsIfChanged(
      metricsForColumns(
        widthRef.current,
        geometry,
        appliedColsRef.current,
        itemCount,
      ),
    )
    updateRange()
  }, [itemCount, geometry, updateRange, setMetricsIfChanged])

  useEffect(() => {
    const anims = flipAnims.current
    return () => {
      clearTimeout(settleTimer.current)
      for (const anim of anims.values()) anim.cancel()
      anims.clear()
    }
  }, [])

  const sizerStyle: React.CSSProperties = {
    position: "relative",
    // height is written imperatively (syncGridStyles) so a per-frame width
    // change never needs a re-render to resize the scroll content.
  }
  const gridStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    boxSizing: "border-box",
    paddingLeft: geometry.padX / 2,
    paddingRight: geometry.padX / 2,
    display: "grid",
    columnGap: geometry.gapX,
    rowGap: geometry.gapY,
    // gridTemplateColumns, gridAutoRows and transform are imperative
  }

  return {
    sizerRef,
    gridRef,
    sizerStyle,
    gridStyle,
    metrics: m,
    range,
    startIndex,
    endIndex,
    totalHeight,
    imagesActive,
    scrollToIndex,
  }
}

// pin the anchor item across a reflow: the given index if visible, else the
// topmost visible cell.
function pickAnchorIndex(
  m: Metrics,
  g: VirtualGridGeometry,
  containerTop: number,
  scrollTop: number,
  viewportHeight: number,
  count: number,
  preferred: number | null,
): number {
  if (count === 0 || m.cols === 0) return -1

  if (preferred != null && preferred >= 0 && preferred < count) {
    const top = rowTop(Math.floor(preferred / m.cols), m, g, containerTop)
    if (top + m.rowHeight > scrollTop && top < scrollTop + viewportHeight) {
      return preferred
    }
  }

  const topRow = Math.max(
    0,
    Math.floor((scrollTop - containerTop - g.padY) / m.step),
  )
  return Math.min(count - 1, topRow * m.cols)
}
