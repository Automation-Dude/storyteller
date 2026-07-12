"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
} from "@v3/_/components/ui/page-layout"

const OPEN_CLOSE_DURATION = 500
// close approximation of cubic-bezier(0.22, 1, 0.36, 1)
const easeOut = (p: number) => 1 - Math.pow(1 - p, 5)
// how hard the magnetic drag pulls toward a column-boundary width, per frame
const MAGNET_PULL = 0.32

const clampWidth = (w: number) =>
  Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, w))

const setBodyDragCursor = (on: boolean) => {
  document.body.style.cursor = on ? "col-resize" : ""
  document.body.style.userSelect = on ? "none" : ""
}

type PanelWidthDriverOptions = {
  open: boolean
  // committed width from the store; the width the panel rests at when open
  storedWidth: number
  animate: boolean
  // maps a dragged width to the eased-toward target (grid view, animated mode).
  // identity outside the magnetic range.
  magneticTarget?: ((raw: number) => number) | undefined
  // fallback-mode release snap to a whole-column width (grid view only)
  snapOnRelease?: ((raw: number) => number) | undefined
  commit: (width: number) => void
}

/**
 * drives the detail panel's width imperatively. per-frame widths (open/close
 * animation, drag) go straight to the DOM node so the store -- which persists
 * every write to a cookie -- is only committed once the panel is at rest.
 * the grid follows automatically through its own ResizeObserver.
 */
export function usePanelWidthDriver({
  open,
  storedWidth,
  animate,
  magneticTarget,
  snapOnRelease,
  commit,
}: PanelWidthDriverOptions) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const widthRef = useRef(open ? storedWidth : 0)
  const rafRef = useRef(0)
  // stays true while the close animation runs so content remains mounted
  const [visible, setVisible] = useState(open)
  const [dragging, setDragging] = useState(false)

  const optsRef = useRef({
    storedWidth,
    animate,
    magneticTarget,
    snapOnRelease,
    commit,
  })
  optsRef.current = {
    storedWidth,
    animate,
    magneticTarget,
    snapOnRelease,
    commit,
  }

  const setDom = useCallback((w: number) => {
    widthRef.current = w
    const el = panelRef.current
    if (el) el.style.width = `${w}px`
  }, [])

  // react re-renders write the committed width back into style; re-assert the
  // in-flight width after every commit so an animation never visibly jumps.
  // runs before paint (parent layout effects follow child DOM mutations).
  useLayoutEffect(() => {
    if (optsRef.current.animate && visible) setDom(widthRef.current)
  })

  const animateTo = useCallback(
    (to: number, done?: () => void) => {
      cancelAnimationFrame(rafRef.current)
      const from = widthRef.current
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / OPEN_CLOSE_DURATION)
        setDom(from + (to - from) * easeOut(p))
        if (p < 1) rafRef.current = requestAnimationFrame(tick)
        else done?.()
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [setDom],
  )

  const prevOpenRef = useRef(open)
  useLayoutEffect(() => {
    if (open === prevOpenRef.current) return
    prevOpenRef.current = open

    const { animate, storedWidth } = optsRef.current
    if (!animate) {
      widthRef.current = open ? storedWidth : 0
      setVisible(open)
      return
    }
    if (open) {
      // panel mounts at width 0 (the every-commit re-assert above runs before
      // paint), then slides out to the stored width
      setVisible(true)
      animateTo(storedWidth)
    } else {
      animateTo(0, () => {
        setVisible(false)
      })
    }
  }, [open, animateTo])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      cancelAnimationFrame(rafRef.current)

      const startX = e.clientX
      const startWidth = widthRef.current
      let raw = startWidth
      let applied = startWidth
      let magnetRaf = 0

      setDragging(true)
      setBodyDragCursor(true)

      const { magneticTarget } = optsRef.current

      const handlePointerMove = (ev: PointerEvent) => {
        raw = clampWidth(startWidth + (startX - ev.clientX))
        // the magnet loop below applies eased widths; otherwise follow directly
        if (!magneticTarget) setDom(raw)
      }

      if (magneticTarget) {
        const loop = () => {
          const target = clampWidth(magneticTarget(raw))
          applied += (target - applied) * MAGNET_PULL
          if (Math.abs(target - applied) < 0.5) applied = target
          setDom(applied)
          magnetRaf = requestAnimationFrame(loop)
        }
        magnetRaf = requestAnimationFrame(loop)
      }

      const abortController = new AbortController()
      const handlePointerUp = () => {
        abortController.abort()
        cancelAnimationFrame(magnetRaf)
        setDragging(false)
        setBodyDragCursor(false)

        const { snapOnRelease, commit } = optsRef.current
        let final = widthRef.current
        if (snapOnRelease) {
          // fallback mode: one reflow to a whole-column width at release
          final = clampWidth(snapOnRelease(raw))
          setDom(final)
        }
        commit(final)
      }

      document.addEventListener("pointermove", handlePointerMove, {
        signal: abortController.signal,
      })
      document.addEventListener("pointerup", handlePointerUp, {
        signal: abortController.signal,
      })
      document.addEventListener("pointercancel", handlePointerUp, {
        signal: abortController.signal,
      })
    },
    [setDom],
  )

  return { panelRef, visible, dragging, startDrag }
}
