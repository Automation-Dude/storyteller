"use client"

import { Combobox } from "@base-ui/react/combobox"
import { type Virtualizer, useVirtualizer } from "@tanstack/react-virtual"
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { useCommon } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { IAdd } from "@/app/(v3)/v3/_/components/ui/icon"

const ROW_HEIGHT = 32
const VIRTUALIZE_THRESHOLD = 40

const inputClassName =
  "placeholder:text-muted-foreground flex h-6 text-base w-full rounded-md bg-transparent px-2 md:text-xs outline-none"

const listClassName =
  "scroll-py-1 max-h-64 scroll-y overscroll-contain px-1 pb-1 after:absolute after:bottom-0 after:left-0 after:h-12 after:w-full after:bg-gradient-to-b after:from-transparent after:to-background"

const rowClassName =
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

export type FilterableItem = { uuid: string; name: string }

export type FilterableSelectContext<T> = { index: number; items: T[] }

type RowVirtualizer = Virtualizer<HTMLDivElement, Element>

function SearchInput({
  autoFocus,
  placeholder,
}: {
  autoFocus: boolean
  placeholder: string
}) {
  return (
    <div className="border-b p-1">
      <Combobox.Input
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={inputClassName}
        onKeyDown={(event) => {
          if (event.key === "Tab" && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.dispatchEvent(
              new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
            )
          }
        }}
      />
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-1 p-1">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={`loading-${idx}`}
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

function Row<T extends FilterableItem>({
  item,
  index,
  items,
  onSelect,
  renderRow,
  style,
  keepOpen,
}: {
  item: T
  index: number
  items: T[]
  onSelect?: (
    item: T,
    event: React.MouseEvent,
    ctx: FilterableSelectContext<T>,
  ) => void
  renderRow: (item: T) => ReactNode
  style?: React.CSSProperties
  keepOpen: boolean
}) {
  return (
    <Combobox.Item
      value={item}
      index={index}
      style={style}
      className={rowClassName}
      onClick={(event) => {
        if (keepOpen) event.preventDefault()
        onSelect?.(item, event as unknown as React.MouseEvent, { index, items })
      }}
    >
      {renderRow(item)}
    </Combobox.Item>
  )
}

function Body<T extends FilterableItem>({
  shouldVirtualize,
  onSelect,
  renderRow,
  keepOpen,
  virtualizerRef,
  emptyText,
}: {
  shouldVirtualize: boolean
  onSelect?: (
    item: T,
    event: React.MouseEvent,
    ctx: FilterableSelectContext<T>,
  ) => void
  renderRow: (item: T) => ReactNode
  keepOpen: boolean
  virtualizerRef: React.MutableRefObject<RowVirtualizer | null>
  emptyText: string
}) {
  const items = Combobox.useFilteredItems<T>()
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () =>
      shouldVirtualize && scrollRef.current?.isConnected
        ? scrollRef.current
        : null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })
  virtualizerRef.current = shouldVirtualize ? virtualizer : null

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground px-2 py-3 text-center text-xs">
        {emptyText}
      </div>
    )
  }

  if (!shouldVirtualize) {
    return (
      <Combobox.List className={listClassName}>
        {items.map((item, index) => (
          <Row
            key={item.uuid}
            item={item}
            index={index}
            items={items}
            onSelect={onSelect}
            renderRow={renderRow}
            keepOpen={keepOpen}
          />
        ))}
      </Combobox.List>
    )
  }

  return (
    <Combobox.List ref={scrollRef} className={listClassName}>
      <div
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        key={items.length}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]
          if (!item) return null
          return (
            <Row
              key={item.uuid}
              item={item}
              index={row.index}
              items={items}
              onSelect={onSelect}
              renderRow={renderRow}
              keepOpen={keepOpen}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: ROW_HEIGHT,
                transform: `translateY(${row.start}px)`,
              }}
            />
          )
        })}
      </div>
    </Combobox.List>
  )
}

export type FilterableListProps<T extends FilterableItem> = {
  items: T[]
  onSelect?: (
    item: T,
    event: React.MouseEvent,
    ctx: FilterableSelectContext<T>,
  ) => void
  renderRow: (item: T) => ReactNode
  searchPlaceholder: string
  autoFocusSearch?: boolean
  virtualized?: boolean
  loading?: boolean
  emptyText?: string
  keepOpen?: boolean
  create?: {
    label: (query: string) => string
    onCreate: (name: string) => void
  }
  footer?: ReactNode
}

export function FilterableList<T extends FilterableItem>({
  items,
  onSelect,
  renderRow,
  searchPlaceholder,
  autoFocusSearch = true,
  virtualized,
  loading = false,
  emptyText,
  keepOpen = true,
  create,
  footer,
}: FilterableListProps<T>) {
  const c = useCommon()
  const [query, setQuery] = useState("")
  const shouldVirtualize = virtualized ?? items.length > VIRTUALIZE_THRESHOLD
  const virtualizerRef = useRef<RowVirtualizer | null>(null)
  const resolvedEmpty = emptyText ?? c("empty.noResults")

  const trimmed = query.trim()
  const showCreate =
    !!create &&
    trimmed.length > 0 &&
    !items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())

  const onItemHighlighted = useCallback(
    (
      _value: T | undefined,
      details: { index: number; reason: "keyboard" | "pointer" | "none" },
    ) => {
      const virtualizer = virtualizerRef.current
      if (!virtualizer || details.index < 0) return
      if (details.reason === "pointer") return
      queueMicrotask(() => {
        virtualizer.scrollToIndex(details.index, { align: "auto" })
      })
    },
    [],
  )

  return (
    <Combobox.Root
      inline
      open
      autoHighlight
      items={items}
      virtualized={shouldVirtualize}
      itemToStringLabel={(item: T) => item.name}
      onInputValueChange={(value) => {
        setQuery(value)
      }}
      onItemHighlighted={
        shouldVirtualize
          ? (onItemHighlighted as ComponentProps<
              typeof Combobox.Root
            >["onItemHighlighted"])
          : undefined
      }
    >
      <SearchInput
        autoFocus={autoFocusSearch}
        placeholder={searchPlaceholder}
      />

      {loading ? (
        <LoadingRows />
      ) : (
        <Body
          shouldVirtualize={shouldVirtualize}
          onSelect={onSelect}
          renderRow={renderRow}
          keepOpen={keepOpen}
          virtualizerRef={virtualizerRef}
          emptyText={resolvedEmpty}
        />
      )}

      {showCreate && create && (
        <button
          type="button"
          onClick={() => {
            create.onCreate(trimmed)
          }}
          className="hover:bg-accent text-primary mx-1 mb-1 flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
        >
          <IAdd.base className="h-3.5 w-3.5" />
          {create.label(trimmed)}
        </button>
      )}

      {footer}
    </Combobox.Root>
  )
}

// ---------------------------------------------------------------------------
// Composition menu: a dropdown built on base-ui Menu (hover-open submenus,
// hover highlight, roving keyboard, separators, non-searchable labels) with an
// optional search box that filters items and always shows the full list until
// you type. For huge, virtualized lists use FilterableList above instead.
// ---------------------------------------------------------------------------

type FilterState = { query: string; searchable: boolean }
const FilterableMenuContext = createContext<FilterState>({
  query: "",
  searchable: false,
})

// item hover highlight lives on CSS :hover instead of base-ui's focus-based
// highlight (which we disable) so hovering an item never steals focus from the
// search input.
const menuItemHover = "hover:bg-accent hover:text-accent-foreground"

function itemMatches(query: string, text: string): boolean {
  const q = query.trim().toLowerCase()
  return q === "" || text.toLowerCase().includes(q)
}

export function FilterableMenuItem({
  children,
  icon,
  onSelect,
  submenu,
  keywords,
  textValue,
  variant,
  disabled,
  closeOnClick,
}: {
  children: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  submenu?: ReactNode | ((ctx: { close: () => void }) => ReactNode)
  // extra text to match when filtering
  keywords?: string
  // the searchable text when `children` aren't a plain string
  textValue?: string
  variant?: "default" | "destructive"
  disabled?: boolean
  closeOnClick?: boolean
}) {
  const { query } = useContext(FilterableMenuContext)
  const text = `${
    textValue ?? (typeof children === "string" ? children : "")
  } ${keywords ?? ""}`
  if (!itemMatches(query, text)) return null

  if (submenu !== undefined) {
    return (
      <FilterableMenuSub icon={icon} label={children} disabled={disabled}>
        {submenu}
      </FilterableMenuSub>
    )
  }

  return (
    <DropdownMenuItem
      variant={variant}
      disabled={disabled}
      closeOnClick={closeOnClick}
      className={menuItemHover}
      onClick={() => {
        onSelect?.()
      }}
    >
      {icon}
      {children}
    </DropdownMenuItem>
  )
}

function FilterableMenuSub({
  icon,
  label,
  disabled,
  children,
}: {
  icon?: ReactNode
  label: ReactNode
  disabled?: boolean
  children: ReactNode | ((ctx: { close: () => void }) => ReactNode)
}) {
  // controlled so the content (often a lazy relation picker) only mounts once
  // the submenu is opened.
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenuSub open={open} onOpenChange={setOpen}>
      <DropdownMenuSubTrigger disabled={disabled} className={menuItemHover}>
        {icon}
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64 p-1">
        <div
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Tab" || e.key === "Enter")
              return
            console.log("keydown", e.key)
            e.stopPropagation()
          }}
          // onMouseDown={(e) => e.stopPropagation()}
        >
          {open &&
            (typeof children === "function"
              ? children({ close: () => setOpen(false) })
              : children)}
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

// labels/separators are structural, not searchable: hide them while filtering
// so a query never leaves orphaned headers or dividers behind.
export function FilterableMenuLabel({ children }: { children: ReactNode }) {
  const { query } = useContext(FilterableMenuContext)
  if (query.trim()) return null
  return <DropdownMenuLabel>{children}</DropdownMenuLabel>
}

export function FilterableMenuSeparator() {
  const { query } = useContext(FilterableMenuContext)
  if (query.trim()) return null
  return <DropdownMenuSeparator />
}

export function FilterableMenuGroup({ children }: { children: ReactNode }) {
  return <DropdownMenuGroup>{children}</DropdownMenuGroup>
}

function findMenuItem(
  from: HTMLElement | null,
): HTMLElement | null | undefined {
  return from
    ?.closest("[data-slot=dropdown-menu-content]")
    ?.querySelector<HTMLElement>("[role=menuitem]:not([data-disabled])")
}

// the popup body. use standalone inside a `<DropdownMenu handle={...}>` for
// externally-triggered menus (e.g. book card context menus), or via the
// `FilterableMenu` wrapper below. The enclosing `DropdownMenu` should set
// `highlightItemOnHover={false}` (the wrapper does this for you).
export function FilterableMenuContent({
  children,
  searchable = false,
  searchPlaceholder,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  className,
}: {
  children: ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  className?: string
}) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // base-ui focuses the first item on open; re-claim focus for the search input
  // after paint so typing works immediately.
  useEffect(() => {
    if (!searchable) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [searchable])

  return (
    <DropdownMenuContent
      align={align}
      side={side}
      sideOffset={sideOffset}
      className={cn("w-64", className)}
    >
      <FilterableMenuContext.Provider value={{ query, searchable }}>
        {searchable && (
          <div className="mb-1 border-b p-1">
            <input
              ref={inputRef}
              value={query}
              placeholder={searchPlaceholder}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  findMenuItem(event.currentTarget)?.focus()
                  return
                }
                if (event.key === "Enter") {
                  const first = findMenuItem(event.currentTarget)
                  if (first) {
                    event.preventDefault()
                    first.click()
                  }
                  return
                }
                // keep typing from triggering base-ui's typeahead / nav
                if (event.key !== "Escape" && event.key !== "Tab") {
                  event.stopPropagation()
                }
              }}
              className="placeholder:text-muted-foreground h-7 w-full bg-transparent px-2 text-sm outline-none"
            />
          </div>
        )}
        {children}
      </FilterableMenuContext.Provider>
    </DropdownMenuContent>
  )
}

export function FilterableMenu({
  trigger,
  children,
  open: openProp,
  onOpenChange,
  searchable,
  searchPlaceholder,
  align,
  side,
  sideOffset,
  contentClassName,
}: {
  trigger: ReactElement
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  searchable?: boolean
  searchPlaceholder?: string
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  contentClassName?: string
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen

  return (
    <DropdownMenu
      open={open}
      highlightItemOnHover={false}
      onOpenChange={(next) => {
        onOpenChange?.(next)
        if (openProp === undefined) setUncontrolledOpen(next)
      }}
    >
      <DropdownMenuTrigger render={trigger} />
      <FilterableMenuContent
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={contentClassName}
      >
        {children}
      </FilterableMenuContent>
    </DropdownMenu>
  )
}
