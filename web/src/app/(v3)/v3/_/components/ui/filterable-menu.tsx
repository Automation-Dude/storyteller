"use client"

import { Combobox } from "@base-ui/react/combobox"
import { Popover } from "@base-ui/react/popover"
import { type Virtualizer, useVirtualizer } from "@tanstack/react-virtual"
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { Skeleton } from "@v3/_/components/ui/skeleton"
import { useCommon } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { IAdd } from "@/app/(v3)/v3/_/components/ui/icon"
import { ChevronRight } from "@/icons"

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
// Composition menu: a dropdown built on base-ui Popover with our own
// virtual-focus highlight. base-ui Menu is unusable here because its typeahead
// (type a letter to jump to an item) can't be disabled and fights a search box,
// and it exposes no controllable highlight index. So we keep DOM focus on the
// search input and track the active row purely in React state: the highlight
// follows typing, arrow keys, and hover, and Enter fires the active row.
// Submenus are lazy hover-opened nested popovers. For huge, virtualized lists
// use FilterableList above instead.
// ---------------------------------------------------------------------------

const menuPopupClassName =
  "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground z-50 max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md p-1 shadow-md ring-1 duration-100 outline-none"

const menuItemClassName =
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:*:[svg]:text-destructive relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

const menuSubTriggerClassName =
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

function itemMatches(query: string, text: string): boolean {
  const q = query.trim().toLowerCase()
  return q === "" || text.toLowerCase().includes(q)
}

// what a registered row exposes to keyboard navigation. `metaRef` is read at
// event time (not registration time) so it always reflects the latest closures.
type FilterableMenuItemMeta = {
  disabled: boolean
  isSubmenu: boolean
  onActivate: () => void
}
type FilterableMenuItemEntry = {
  element: HTMLElement
  metaRef: RefObject<FilterableMenuItemMeta>
}

type FilterableMenuContextValue = {
  query: string
  searchable: boolean
  activeId: string | null
  setActiveId: (id: string | null) => void
  register: (id: string, entry: FilterableMenuItemEntry) => void
  unregister: (id: string) => void
  close: () => void
  // the menu's search input, so a closing submenu can return focus to it
  // instead of the (non-focusable) submenu trigger.
  searchRef: RefObject<HTMLInputElement | null>
}

const noop = () => {}
const FilterableMenuContext = createContext<FilterableMenuContextValue>({
  query: "",
  searchable: false,
  activeId: null,
  setActiveId: noop,
  register: noop,
  unregister: noop,
  close: noop,
  searchRef: { current: null },
})

// registers a row with the enclosing menu for keyboard navigation and reports
// whether it is the active (highlighted) row. rows that don't match the current
// query pass `matches: false` and stay out of the registry.
function useFilterableMenuItem(
  id: string,
  matches: boolean,
  meta: FilterableMenuItemMeta,
) {
  const ctx = useContext(FilterableMenuContext)
  const ref = useRef<HTMLDivElement>(null)
  const metaRef = useRef(meta)
  useEffect(() => {
    metaRef.current = meta
  })

  const { register, unregister } = ctx
  useEffect(() => {
    const element = ref.current
    if (!matches || !element) return
    register(id, { element, metaRef })
    return () => {
      unregister(id)
    }
  }, [id, matches, register, unregister])

  return {
    ref,
    active: ctx.activeId === id,
    setActive: () => {
      ctx.setActiveId(id)
    },
    activate: () => {
      metaRef.current.onActivate()
    },
  }
}

export type FilterableMenuItemProps = {
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
}

export function FilterableMenuItem(props: FilterableMenuItemProps) {
  const { query } = useContext(FilterableMenuContext)
  const text = `${
    props.textValue ??
    (typeof props.children === "string" ? props.children : "")
  } ${props.keywords ?? ""}`
  const matches = itemMatches(query, text)

  if (props.submenu !== undefined) {
    return (
      <FilterableMenuSub
        icon={props.icon}
        label={props.children}
        disabled={props.disabled}
        matches={matches}
      >
        {props.submenu}
      </FilterableMenuSub>
    )
  }

  return <FilterableMenuActionItem {...props} matches={matches} />
}

function FilterableMenuActionItem({
  children,
  icon,
  onSelect,
  variant,
  disabled,
  closeOnClick,
  matches,
}: FilterableMenuItemProps & { matches: boolean }) {
  const id = useId()
  const { close } = useContext(FilterableMenuContext)
  const { ref, active, setActive, activate } = useFilterableMenuItem(
    id,
    matches,
    {
      disabled: !!disabled,
      isSubmenu: false,
      onActivate: () => {
        onSelect?.()
        if (closeOnClick !== false) close()
      },
    },
  )

  if (!matches) return null

  return (
    <div
      ref={ref}
      role="menuitem"
      data-highlighted={active || undefined}
      data-disabled={disabled || undefined}
      data-variant={variant}
      className={menuItemClassName}
      onMouseEnter={() => {
        if (!disabled) setActive()
      }}
      onClick={() => {
        if (!disabled) activate()
      }}
    >
      {icon}
      {children}
    </div>
  )
}

function FilterableMenuSub({
  icon,
  label,
  disabled,
  matches,
  children,
}: {
  icon?: ReactNode
  label: ReactNode
  disabled?: boolean
  matches: boolean
  children: ReactNode | ((ctx: { close: () => void }) => ReactNode)
}) {
  const id = useId()
  const { searchRef } = useContext(FilterableMenuContext)
  // controlled so the content (often a lazy relation picker) only mounts once
  // the submenu is opened.
  const [open, setOpen] = useState(false)
  const { ref, active, setActive } = useFilterableMenuItem(id, matches, {
    disabled: !!disabled,
    isSubmenu: true,
    onActivate: () => {
      setOpen(true)
    },
  })

  if (!matches) return null

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        openOnHover
        delay={100}
        closeDelay={150}
        disabled={disabled}
        nativeButton={false}
        render={
          <div
            ref={ref}
            role="menuitem"
            aria-haspopup="menu"
            data-highlighted={active || undefined}
            data-disabled={disabled || undefined}
            data-open={open || undefined}
            className={menuSubTriggerClassName}
            onMouseEnter={() => {
              if (!disabled) setActive()
            }}
          >
            {icon}
            {label}
            <ChevronRight className="ml-auto" />
          </div>
        }
      />
      <Popover.Portal>
        <Popover.Positioner
          className="isolate z-50 outline-none"
          side="right"
          align="start"
          sideOffset={-4}
          alignOffset={-4}
        >
          <Popover.Popup
            // when the submenu closes with focus inside it (e.g. Escape),
            // return focus to the main menu's search input rather than the
            // non-focusable trigger row.
            finalFocus={searchRef}
            className={cn(menuPopupClassName, "w-64")}
          >
            {open &&
              (typeof children === "function"
                ? children({
                    close: () => {
                      setOpen(false)
                    },
                  })
                : children)}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

// labels/separators are structural, not searchable: hide them while filtering
// so a query never leaves orphaned headers or dividers behind.
export function FilterableMenuLabel({ children }: { children: ReactNode }) {
  const { query } = useContext(FilterableMenuContext)
  if (query.trim()) return null
  return (
    <div className="text-muted-foreground px-2 py-1.5 text-xs">{children}</div>
  )
}

export function FilterableMenuSeparator() {
  const { query } = useContext(FilterableMenuContext)
  if (query.trim()) return null
  return <div role="separator" className="bg-border/50 -mx-1 my-1 h-px" />
}

export function FilterableMenuGroup({ children }: { children: ReactNode }) {
  return <div role="group">{children}</div>
}

// the popup body. use standalone inside a `<Popover.Root handle={...}>` for
// externally-triggered menus (e.g. book card context menus, where every card's
// button shares one handle), or via the `FilterableMenu` wrapper below. When
// used with a handle, pass `onClose={() => handle.close()}` so item selection
// can dismiss the menu.
export function FilterableMenuContent({
  children,
  searchable = false,
  searchPlaceholder,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  className,
  onClose,
}: {
  children: ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  className?: string
  onClose?: () => void
}) {
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const registryRef = useRef(new Map<string, FilterableMenuItemEntry>())
  const inputRef = useRef<HTMLInputElement>(null)

  const register = useCallback((id: string, entry: FilterableMenuItemEntry) => {
    registryRef.current.set(id, entry)
  }, [])
  const unregister = useCallback((id: string) => {
    registryRef.current.delete(id)
  }, [])
  const close = useCallback(() => {
    onClose?.()
  }, [onClose])

  // the visible, enabled rows in document order -- the order arrow keys follow.
  const orderedIds = useCallback(() => {
    return [...registryRef.current.entries()]
      .filter(([, entry]) => !entry.metaRef.current.disabled)
      .sort(([, a], [, b]) =>
        a.element.compareDocumentPosition(b.element) &
        Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      )
      .map(([id]) => id)
  }, [])

  // as the query changes the matching set changes; child register/unregister
  // effects run before this one, so the registry is current. reset the highlight
  // to the first match so it always tracks what's typed.
  useEffect(() => {
    if (!searchable) return
    setActiveId(orderedIds()[0] ?? null)
  }, [query, searchable, orderedIds])

  const ctx = useMemo<FilterableMenuContextValue>(
    () => ({
      query,
      searchable,
      activeId,
      setActiveId,
      register,
      unregister,
      close,
      searchRef: inputRef,
    }),
    [query, searchable, activeId, register, unregister, close],
  )

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      const ids = orderedIds()
      if (ids.length === 0) return
      event.preventDefault()
      const current = activeId ? ids.indexOf(activeId) : -1
      let next: number
      if (event.key === "Home") next = 0
      else if (event.key === "End") next = ids.length - 1
      else if (event.key === "ArrowDown")
        next = current < ids.length - 1 ? current + 1 : 0
      else next = current > 0 ? current - 1 : ids.length - 1
      setActiveId(ids[next] ?? null)
      return
    }

    if (event.key === "Enter" || event.key === "ArrowRight") {
      if (!activeId) return
      const entry = registryRef.current.get(activeId)
      if (!entry) return
      // ArrowRight only acts on submenu rows (open the flyout)
      if (event.key === "ArrowRight" && !entry.metaRef.current.isSubmenu) return
      event.preventDefault()
      entry.metaRef.current.onActivate()
    }
  }

  return (
    <Popover.Portal>
      <Popover.Positioner
        className="isolate z-50 outline-none"
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <Popover.Popup
          data-slot="filterable-menu-content"
          initialFocus={searchable ? inputRef : undefined}
          className={cn(menuPopupClassName, "w-64", className)}
          onKeyDown={handleKeyDown}
        >
          <FilterableMenuContext.Provider value={ctx}>
            {searchable && (
              <div className="mb-1 border-b p-1">
                <input
                  ref={inputRef}
                  value={query}
                  placeholder={searchPlaceholder}
                  onChange={(event) => {
                    setQuery(event.target.value)
                  }}
                  className="placeholder:text-muted-foreground h-7 w-full bg-transparent px-2 text-sm outline-none md:h-6 md:text-xs"
                />
              </div>
            )}
            {children}
          </FilterableMenuContext.Provider>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
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

  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (openProp === undefined) setUncontrolledOpen(next)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={trigger} />
      <FilterableMenuContent
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={contentClassName}
        onClose={() => {
          setOpen(false)
        }}
      >
        {children}
      </FilterableMenuContent>
    </Popover.Root>
  )
}
