"use client"

import { Combobox } from "@base-ui/react/combobox"
import { Popover } from "@base-ui/react/popover"
import { type Virtualizer, useVirtualizer } from "@tanstack/react-virtual"
import {
  type ComponentProps,
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
  "scroll-py-1 max-h-64 scroll-y overscroll-contain px-1 pb-1"

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

// lets not be too cutesy, looks nicer if just instant
const menuPopupClassName =
  // "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2
  "ring-foreground/10 bg-popover text-popover-foreground z-50 max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md p-1 shadow-md ring-1 duration-100 outline-none"

const menuItemClassName =
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:*:[svg]:text-destructive relative flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

const menuSubTriggerClassName =
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground flex min-h-7 cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

const menuLabelClassName = "text-muted-foreground px-2 py-1.5 text-xs"

const searchBoxClassName =
  "placeholder:text-muted-foreground h-7 w-full bg-transparent px-2 text-sm outline-none md:h-6 md:text-xs"

function itemMatches(query: string, text: string): boolean {
  const q = query.trim().toLowerCase()
  return q === "" || text.toLowerCase().includes(q)
}

// modifier keys captured at activation time, so a confirm action can honor
// shift-to-skip whether the row was clicked or triggered with Enter.
export type ActivationModifiers = { shiftKey: boolean }

// what a registered row exposes to keyboard navigation. `metaRef` is read at
// event time (not registration time) so it always reflects the latest closures.
type FilterableMenuItemMeta = {
  disabled: boolean
  isSubmenu: boolean
  onActivate: (modifiers?: ActivationModifiers) => void
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

// a group scopes label-aware search: when the query matches the group's own
// label, every item in the group survives. items outside any group fall back to
// the default (never a group match, so they match individually).
type FilterableMenuGroupContextValue = {
  inGroup: boolean
  groupMatches: boolean
  registerLabel: (text: string) => void
}
const FilterableMenuGroupContext =
  createContext<FilterableMenuGroupContextValue>({
    inGroup: false,
    groupMatches: false,
    registerLabel: noop,
  })

// the enclosing submenu's open state, so the trigger can open it and the
// content can render (and close) itself.
type FilterableMenuSubContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}
const FilterableMenuSubContext = createContext<FilterableMenuSubContextValue>({
  open: false,
  setOpen: noop,
})

// closes the menu (or nearest surface) an item lives in. root menus supply this
// through FilterableMenu; the handle-based menus pass an explicit onClose.
const FilterableMenuRootContext = createContext<{ close: () => void }>({
  close: noop,
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
    activate: (modifiers?: ActivationModifiers) => {
      metaRef.current.onActivate(modifiers)
    },
  }
}

// the shared machinery behind a menu surface (root content and each submenu
// content): the item registry, active-row tracking, and arrow-key navigation.
function useMenuSurface({
  searchable,
  onClose,
  onExit,
}: {
  searchable: boolean
  onClose: () => void
  // exit this surface back to its parent (for submenus). undefined at the root.
  onExit?: () => void
}) {
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const registryRef = useRef(new Map<string, FilterableMenuItemEntry>())
  const inputRef = useRef<HTMLInputElement>(null)
  const resetQuery = useCallback(() => {
    setQuery("")
  }, [])

  const register = useCallback((id: string, entry: FilterableMenuItemEntry) => {
    registryRef.current.set(id, entry)
  }, [])
  const unregister = useCallback((id: string) => {
    registryRef.current.delete(id)
  }, [])
  const close = useCallback(() => {
    onClose()
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

    // enter/exit a submenu along the reading direction, so RTL flips which arrow
    // goes inward vs outward.
    const rtl =
      getComputedStyle(event.currentTarget as HTMLElement).direction === "rtl"
    const inwardKey = rtl ? "ArrowLeft" : "ArrowRight"
    const outwardKey = rtl ? "ArrowRight" : "ArrowLeft"
    const input = inputRef.current
    const inInput = input !== null && event.target === input

    // exit back to the parent menu (mirror of entering). from the search input
    // only when the caret is already at the start, so the key still moves it.
    if (event.key === outwardKey && onExit) {
      if (
        inInput &&
        !(input.selectionStart === 0 && input.selectionEnd === 0)
      )
        return
      event.preventDefault()
      onExit()
      return
    }

    if (event.key === "Enter" || event.key === inwardKey) {
      // enter from the search input only when the caret is at the end, so the
      // key still moves it otherwise.
      if (
        event.key === inwardKey &&
        inInput &&
        !(
          input.selectionStart === input.value.length &&
          input.selectionEnd === input.value.length
        )
      )
        return
      if (!activeId) return
      const entry = registryRef.current.get(activeId)
      if (!entry) return
      // the inward key only acts on submenu rows (open the flyout)
      if (event.key === inwardKey && !entry.metaRef.current.isSubmenu) return
      event.preventDefault()
      entry.metaRef.current.onActivate({ shiftKey: event.shiftKey })
    }
  }

  return { ctx, query, setQuery, resetQuery, inputRef, handleKeyDown }
}

// clears the surface's query when the popup subtree unmounts (i.e. the menu
// closes), so a stale query never lingers into the next open.
function ResetQueryOnClose({ reset }: { reset: () => void }) {
  useEffect(() => reset, [reset])
  return null
}

function SearchBox({
  inputRef,
  query,
  setQuery,
  placeholder,
  className,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  query: string
  setQuery: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className="mb-1 border-b p-1">
      <input
        ref={inputRef}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        className={cn(searchBoxClassName, className)}
      />
    </div>
  )
}

// the menu root. a thin wrapper over `Popover.Root` that also exposes a `close`
// so custom item rows (plain divs, not `Popover.Close`) can dismiss it whether
// the menu is controlled or uncontrolled. compose a `FilterableMenuTrigger` and
// a `FilterableMenuContent` inside it.
export function FilterableMenu({
  children,
  open,
  defaultOpen,
  onOpenChange,
  handle,
}: {
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  handle?: ComponentProps<typeof Popover.Root>["handle"]
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false)
  const isControlled = open !== undefined
  const actualOpen = isControlled ? open : uncontrolledOpen

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next)
      if (!isControlled) setUncontrolledOpen(next)
    },
    [isControlled, onOpenChange],
  )
  const close = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  // handle-driven menus (shared card context menus) manage open state through
  // the handle; those call sites pass an explicit onClose on the content.
  const rootValue = useMemo(
    () => ({ close: handle ? noop : close }),
    [handle, close],
  )

  return (
    <FilterableMenuRootContext.Provider value={rootValue}>
      <Popover.Root
        {...(handle ? { handle } : { open: actualOpen, onOpenChange: setOpen })}
      >
        {children}
      </Popover.Root>
    </FilterableMenuRootContext.Provider>
  )
}

export function FilterableMenuTrigger(
  props: ComponentProps<typeof Popover.Trigger>,
) {
  return <Popover.Trigger data-slot="filterable-menu-trigger" {...props} />
}

// the popup body. shows a search input by default (`searchable={false}` to hide
// it). use inside `FilterableMenu`, or standalone inside a
// `<Popover.Root handle={...}>` for externally-triggered menus (pass
// `onClose={() => handle.close()}` so items can dismiss it).
export function FilterableMenuContent({
  children,
  searchable = true,
  searchPlaceholder,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  className,
  searchInputClassName,
  onClose,
}: {
  children: ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  className?: string
  searchInputClassName?: string
  onClose?: () => void
}) {
  const rootClose = useContext(FilterableMenuRootContext).close
  const { ctx, query, setQuery, resetQuery, inputRef, handleKeyDown } =
    useMenuSurface({
      searchable,
      onClose: onClose ?? rootClose,
    })

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
            <ResetQueryOnClose reset={resetQuery} />
            {searchable && (
              <SearchBox
                inputRef={inputRef}
                query={query}
                setQuery={setQuery}
                placeholder={searchPlaceholder}
                className={searchInputClassName}
              />
            )}
            {children}
          </FilterableMenuContext.Provider>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}

// groups scope label-aware search. put a single `FilterableMenuLabel` inside to
// give the group its heading and its searchable text.
export function FilterableMenuGroup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { query } = useContext(FilterableMenuContext)
  const [labelText, setLabelText] = useState("")
  const registerLabel = useCallback((text: string) => {
    setLabelText(text)
  }, [])

  const groupMatches = query.trim() !== "" && itemMatches(query, labelText)

  const value = useMemo<FilterableMenuGroupContextValue>(
    () => ({ inGroup: true, groupMatches, registerLabel }),
    [groupMatches, registerLabel],
  )

  return (
    <FilterableMenuGroupContext.Provider value={value}>
      <div role="group" className={className}>
        {children}
      </div>
    </FilterableMenuGroupContext.Provider>
  )
}

// the group's heading. only meaningful inside a `FilterableMenuGroup`, whose
// search it drives. hidden while filtering unless the group itself matches, so a
// query never leaves an orphaned header behind.
export function FilterableMenuLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { query } = useContext(FilterableMenuContext)
  const group = useContext(FilterableMenuGroupContext)
  const text = typeof children === "string" ? children : ""

  const { inGroup, registerLabel } = group
  useEffect(() => {
    if (inGroup) registerLabel(text)
  }, [inGroup, registerLabel, text])

  if (!inGroup) return null
  if (query.trim() !== "" && !group.groupMatches) return null

  return <div className={cn(menuLabelClassName, className)}>{children}</div>
}

export function FilterableMenuSeparator({ className }: { className?: string }) {
  const { query } = useContext(FilterableMenuContext)
  if (query.trim()) return null
  return (
    <div
      role="separator"
      className={cn("bg-border/50 -mx-1 my-1 h-px", className)}
    />
  )
}

export type FilterableMenuItemProps = {
  children: ReactNode
  icon?: ReactNode
  onSelect?: (modifiers?: ActivationModifiers) => void
  // extra text to match when filtering
  keywords?: string
  // the searchable text when `children` aren't a plain string
  textValue?: string
  variant?: "default" | "destructive"
  disabled?: boolean
  closeOnClick?: boolean
  className?: string
}

export function FilterableMenuItem({
  children,
  icon,
  onSelect,
  variant,
  disabled,
  closeOnClick,
  className,
  textValue,
  keywords,
}: FilterableMenuItemProps) {
  const { query, close } = useContext(FilterableMenuContext)
  const group = useContext(FilterableMenuGroupContext)
  const id = useId()

  const text = `${
    textValue ?? (typeof children === "string" ? children : "")
  } ${keywords ?? ""}`
  const matches = group.groupMatches || itemMatches(query, text)

  const { ref, active, setActive, activate } = useFilterableMenuItem(
    id,
    matches,
    {
      disabled: !!disabled,
      isSubmenu: false,
      onActivate: (modifiers) => {
        onSelect?.(modifiers)
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
      className={cn(menuItemClassName, className)}
      onMouseEnter={() => {
        if (!disabled) setActive()
      }}
      onClick={(event) => {
        if (!disabled) activate({ shiftKey: event.shiftKey })
      }}
    >
      {icon}
      {children}
    </div>
  )
}

// submenu triad, composed like dropdown-menu: `FilterableMenuSub` holds the open
// state, `FilterableMenuSubTrigger` is the row that opens it, and
// `FilterableMenuSubContent` is its own self-contained menu surface.
export function FilterableMenuSub({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo<FilterableMenuSubContextValue>(
    () => ({ open, setOpen }),
    [open],
  )
  return (
    <FilterableMenuSubContext.Provider value={value}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        {children}
      </Popover.Root>
    </FilterableMenuSubContext.Provider>
  )
}

export function FilterableMenuSubTrigger({
  children,
  icon,
  disabled,
  className,
  textValue,
  keywords,
}: {
  children: ReactNode
  icon?: ReactNode
  disabled?: boolean
  className?: string
  textValue?: string
  keywords?: string
}) {
  const id = useId()
  const { query } = useContext(FilterableMenuContext)
  const group = useContext(FilterableMenuGroupContext)
  const { open, setOpen } = useContext(FilterableMenuSubContext)

  const text = `${
    textValue ?? (typeof children === "string" ? children : "")
  } ${keywords ?? ""}`
  const matches = group.groupMatches || itemMatches(query, text)

  const { ref, active, setActive } = useFilterableMenuItem(id, matches, {
    disabled: !!disabled,
    isSubmenu: true,
    onActivate: () => {
      setOpen(true)
    },
  })

  if (!matches) return null

  return (
    <Popover.Trigger
      openOnHover
      delay={50}
      closeDelay={0}
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
          className={cn(menuSubTriggerClassName, className)}
          onMouseEnter={() => {
            if (!disabled) setActive()
          }}
        >
          {icon}
          {children}
          <ChevronRight className="ml-auto" />
        </div>
      }
    />
  )
}

export function FilterableMenuSubContent({
  children,
  searchable = false,
  searchPlaceholder,
  className,
  side = "right",
  align = "start",
  sideOffset = -4,
  alignOffset = -4,
}: {
  children: ReactNode | ((ctx: { close: () => void }) => ReactNode)
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  sideOffset?: number
  alignOffset?: number
}) {
  const { open, setOpen } = useContext(FilterableMenuSubContext)
  // the parent surface's search input, so closing this flyout (e.g. Escape)
  // returns focus there rather than to the non-focusable trigger row.
  const parentSearchRef = useContext(FilterableMenuContext).searchRef
  const close = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  const { ctx, query, setQuery, resetQuery, inputRef, handleKeyDown } =
    useMenuSurface({
      searchable,
      onClose: close,
      onExit: close,
    })

  // initalfocus should do that, no ure why its seemingly failngo
  useEffect(() => {
    // focus on open
    if (open) {
      inputRef.current?.focus()
    }
  }, [open, inputRef])

  return (
    <Popover.Portal>
      <Popover.Positioner
        className="isolate z-50 outline-none"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
      >
        <Popover.Popup
          data-slot="filterable-menu-sub-content"
          finalFocus={parentSearchRef}
          initialFocus={searchable ? inputRef : undefined}
          className={cn(menuPopupClassName, "w-64", className)}
          onKeyDown={handleKeyDown}
        >
          {/* mount lazily so lazy content (relation pickers) only fetches once
              the submenu is opened. */}
          {open && (
            <FilterableMenuContext.Provider value={ctx}>
              <ResetQueryOnClose reset={resetQuery} />
              {searchable && (
                <SearchBox
                  inputRef={inputRef}
                  query={query}
                  setQuery={setQuery}
                  placeholder={searchPlaceholder}
                />
              )}
              {typeof children === "function" ? children({ close }) : children}
            </FilterableMenuContext.Provider>
          )}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  )
}
