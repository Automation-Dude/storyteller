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

const OPEN_CLOSE_DURATION = 240
// close approximation of cubic-bezier(0.22, 1, 0.36, 1)
const easeOut = (p: number) => 1 - Math.pow(1 - p, 5)

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
  // whether the open/close transition slides. defaults to `animate`. split out so
  // the panel can appear instantly while the grid FLIP + magnetic drag (gated by
  // `animate`) stay on.
  animateOpenClose?: boolean
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
  animateOpenClose = animate,
  snapOnRelease,
  commit,
}: PanelWidthDriverOptions) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const widthRef = useRef(open ? storedWidth : 0)
  const rafRef = useRef(0)
  // stays true while the close animation runs so content remains mounted
  const [visible, setVisible] = useState(open)
  const [dragging, setDragging] = useState(false)
  // true while the open/close width slide is animating, so the grid can reflow
  // its columns live during the slide (same as a drag) instead of holding the
  // count and squeezing until the width settles.
  const [sliding, setSliding] = useState(false)

  const optsRef = useRef({
    storedWidth,
    animate,
    animateOpenClose,
    snapOnRelease,
    commit,
  })
  optsRef.current = {
    storedWidth,
    animate,
    animateOpenClose,
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
      setSliding(true)
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / OPEN_CLOSE_DURATION)
        setDom(from + (to - from) * easeOut(p))
        if (p < 1) rafRef.current = requestAnimationFrame(tick)
        else {
          setSliding(false)
          done?.()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [setDom],
  )

  const prevOpenRef = useRef(open)
  useLayoutEffect(() => {
    if (open === prevOpenRef.current) return
    prevOpenRef.current = open

    const { animate, animateOpenClose, storedWidth } = optsRef.current
    // instant when animations are off entirely, or when only the open/close
    // slide is disabled (grid FLIP + drag still on). in animate mode the driver
    // owns the width, so the every-commit re-assert above applies it; otherwise
    // PagePanel renders it from the prop.
    if (!animate || !animateOpenClose) {
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

      setDragging(true)
      setBodyDragCursor(true)

      const handlePointerMove = (ev: PointerEvent) => {
        raw = clampWidth(startWidth + (startX - ev.clientX))
        // pure 1:1 follow; the grid reflows live through its ResizeObserver
        setDom(raw)
      }

      const abortController = new AbortController()
      const handlePointerUp = () => {
        abortController.abort()
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

  return { panelRef, visible, dragging, sliding, startDrag }
}
