"use client"

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import * as icon from "@/icons"

import { cn } from "@v3/_/lib/utils"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { TooltipButton } from "./tooltip-button"

// ---- types ----------------------------------------------------------------

type ItemMeta = {
  id: string
  label: string
  priority: number
  collapsible: boolean
  overflowContent?: ReactNode
}

type OverflowCtx = {
  register: (meta: ItemMeta) => void
  unregister: (id: string) => void
  isOverflowing: (id: string) => boolean
  reportWidth: (id: string, width: number) => void
}

const Ctx = createContext<OverflowCtx | null>(null)

// ---- constants -------------------------------------------------------------

const OVERFLOW_BUTTON_WIDTH = 28
const DEFAULT_GAP = 8

// ---- toolbar ---------------------------------------------------------------

type OverflowToolbarProps = {
  children: ReactNode
  className?: string
  gap?: number
}

export function OverflowToolbar({
  children,
  className,
  gap = DEFAULT_GAP,
}: OverflowToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // persistent width cache -- survives item unmounts so we can decide
  // whether to bring an item back without it being in the DOM
  const widthCache = useRef(new Map<string, number>())

  const [metas, setMetas] = useState<ItemMeta[]>([])
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set())

  const register = useCallback((meta: ItemMeta) => {
    setMetas((prev) => {
      const idx = prev.findIndex((m) => m.id === meta.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = meta
        return next
      }
      return [...prev, meta]
    })
  }, [])

  const unregister = useCallback((id: string) => {
    setMetas((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const isOverflowing = useCallback(
    (id: string) => overflowIds.has(id),
    [overflowIds],
  )

  const reportWidth = useCallback((id: string, width: number) => {
    if (width > 0) {
      widthCache.current.set(id, width)
    }
  }, [])

  // ---- overflow calculation ------------------------------------------------

  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container || metas.length === 0) return

    const budget = container.offsetWidth

    const collapsible = metas
      .filter((m) => m.collapsible)
      .sort((a, b) => b.priority - a.priority)

    const nonCollapsible = metas.filter((m) => !m.collapsible)

    // sum widths of everything (from cache)
    let total = 0
    for (const m of metas) {
      total += (widthCache.current.get(m.id) ?? 0) + gap
    }
    total -= gap

    // everything fits
    if (total <= budget) {
      setOverflowIds((prev) => (prev.size === 0 ? prev : new Set()))
      return
    }

    // need to collapse some items. reserve space for the overflow button.
    let remaining = budget - OVERFLOW_BUTTON_WIDTH - gap

    for (const m of nonCollapsible) {
      remaining -= (widthCache.current.get(m.id) ?? 0) + gap
    }

    const next = new Set<string>()

    for (const m of collapsible) {
      const w = (widthCache.current.get(m.id) ?? 0) + gap
      if (remaining >= w) {
        remaining -= w
      } else {
        next.add(m.id)
      }
    }

    setOverflowIds((prev) => {
      if (prev.size !== next.size) return next
      for (const id of next) {
        if (!prev.has(id)) return next
      }
      return prev
    })
  }, [metas, gap])

  useLayoutEffect(() => {
    recalculate()
  }, [recalculate])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      recalculate()
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [recalculate])

  // ---- context value -------------------------------------------------------

  const ctx = useMemo<OverflowCtx>(
    () => ({ register, unregister, isOverflowing, reportWidth }),
    [register, unregister, isOverflowing, reportWidth],
  )

  const overflowItems = metas.filter(
    (m) => m.collapsible && overflowIds.has(m.id),
  )
  const hasOverflow = overflowItems.length > 0

  return (
    <Ctx.Provider value={ctx}>
      <div
        ref={containerRef}
        className={cn("flex min-w-0 items-center overflow-hidden", className)}
        style={{ gap }}
      >
        {children}

        {hasOverflow && <OverflowDropdown items={overflowItems} />}
      </div>
    </Ctx.Provider>
  )
}

// ---- overflow dropdown -----------------------------------------------------

function OverflowDropdown({ items }: { items: ItemMeta[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <TooltipButton
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label="More options"
            tooltip="More options"
          >
            <icon.Dots className="size-4" />
          </TooltipButton>
        }
      />

      <DropdownMenuContent align="end" className="w-56">
        {items.map((item, i) => (
          <OverflowSection
            key={item.id}
            item={item}
            isLast={i === items.length - 1}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function OverflowSection({
  item,
  isLast,
}: {
  item: ItemMeta
  isLast: boolean
}) {
  if (!item.overflowContent) return null

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{item.label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>{item.overflowContent}</DropdownMenuSubContent>
      </DropdownMenuSub>

      {!isLast && <DropdownMenuSeparator />}
    </>
  )
}

// ---- item ------------------------------------------------------------------

type ItemProps = {
  id: string
  label: string
  /** higher priority = stays visible longer (default 0) */
  priority?: number
  /** content rendered inside the overflow dropdown when this item collapses.
   *  if omitted the item is never collapsed. */
  overflowContent?: ReactNode
  children: ReactNode
  className?: string
}

function Item({
  id,
  label,
  priority = 0,
  overflowContent,
  children,
  className,
}: ItemProps) {
  const ctx = useContext(Ctx)
  const collapsible = !!overflowContent
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ctx?.register({ id, label, priority, collapsible, overflowContent })
    return () => ctx?.unregister(id)
  }, [ctx, id, label, priority, collapsible, overflowContent])

  // report width on mount and when content changes
  useLayoutEffect(() => {
    if (elRef.current) {
      ctx?.reportWidth(id, elRef.current.offsetWidth)
    }
  })

  const hidden = ctx?.isOverflowing(id) ?? false

  if (hidden) return null

  return (
    <div
      ref={elRef}
      data-overflow-item={id}
      className={cn("flex shrink-0 items-center", className)}
    >
      {children}
    </div>
  )
}

OverflowToolbar.Item = Item
