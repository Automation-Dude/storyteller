"use client"

import { Combobox } from "@base-ui/react/combobox"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { type Virtualizer, useVirtualizer } from "@tanstack/react-virtual"
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { useCommon } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { IAdd } from "@/app/(v3)/v3/_/components/ui/icon"

const ROW_HEIGHT = 32
const VIRTUALIZE_THRESHOLD = 40

const inputClassName =
  "placeholder:text-muted-foreground flex h-8 w-full rounded-md bg-transparent px-2 text-sm outline-none"

const listClassName =
  "scroll-py-1 max-h-64 overflow-y-auto overscroll-contain px-1 pb-1"

const rowClassName =
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

const flyoutPopupClassName =
  "bg-popover text-popover-foreground ring-foreground/10 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 z-50 flex w-72 origin-(--transform-origin) flex-col overflow-hidden rounded-lg text-xs shadow-md ring-1 outline-hidden duration-100"

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

export type FilterableMenuEntry = {
  key: string
  label: string
  icon?: ReactNode
  keywords?: string
  onSelect?: () => void
  submenu?: ReactNode | ((ctx: { close: () => void }) => ReactNode)
}

type EntryItem = { uuid: string; name: string; entry: FilterableMenuEntry }

export function FilterableMenu({
  trigger,
  entries,
  searchPlaceholder,
  open: openProp,
  onOpenChange,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  contentClassName,
  submenuMode = "inline",
}: {
  trigger: ReactElement
  entries: FilterableMenuEntry[]
  searchPlaceholder: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  contentClassName?: string
  submenuMode?: "inline" | "flyout"
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [dir, setDir] = useState<"forward" | "back" | null>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const setOpen = (next: boolean) => {
    onOpenChange?.(next)
    if (openProp === undefined) setUncontrolledOpen(next)
    if (!next) {
      setActiveKey(null)
      setDir(null)
      setAnchorEl(null)
    }
  }

  const enter = (key: string) => {
    setDir("forward")
    setActiveKey(key)
  }
  const back = () => {
    setDir("back")
    setActiveKey(null)
    setAnchorEl(null)
  }

  const onEntrySelect = (item: EntryItem, event: React.MouseEvent) => {
    if (!item.entry.submenu) {
      item.entry.onSelect?.()
      setOpen(false)
      return
    }
    if (submenuMode === "flyout") {
      setAnchorEl(event.currentTarget as HTMLElement)
    }
    enter(item.entry.key)
  }

  const items = useMemo<EntryItem[]>(
    () =>
      entries.map((entry) => ({
        uuid: entry.key,
        name: entry.keywords ? `${entry.label} ${entry.keywords}` : entry.label,
        entry,
      })),
    [entries],
  )

  const active = entries.find((e) => e.key === activeKey) ?? null
  const submenuContent = (entry: FilterableMenuEntry) =>
    typeof entry.submenu === "function"
      ? entry.submenu({ close: () => setOpen(false) })
      : entry.submenu

  const fieldList = (
    <FilterableList<EntryItem>
      items={items}
      searchPlaceholder={searchPlaceholder}
      keepOpen
      renderRow={(item) => (
        <>
          {item.entry.icon}
          <span className="min-w-0 flex-1 truncate">{item.entry.label}</span>
          {item.entry.submenu && (
            <IconChevronRight
              className={cn(
                "text-muted-foreground ml-auto h-3.5 w-3.5",
                submenuMode === "flyout" &&
                  active?.key === item.entry.key &&
                  "text-foreground",
              )}
            />
          )}
        </>
      )}
      onSelect={onEntrySelect}
    />
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={cn("w-72 gap-0 overflow-hidden p-0", contentClassName)}
      >
        {submenuMode === "flyout" ? (
          <>
            {fieldList}
            <PopoverPrimitive.Root
              open={!!active && !!active.submenu}
              onOpenChange={(next) => {
                if (!next) back()
              }}
            >
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Positioner
                  anchor={anchorEl}
                  side="inline-end"
                  align="start"
                  sideOffset={8}
                  className="isolate z-50"
                >
                  <PopoverPrimitive.Popup
                    className={flyoutPopupClassName}
                    onKeyDownCapture={(event) => {
                      if (
                        event.key === "Backspace" &&
                        event.target instanceof HTMLInputElement &&
                        event.target.value === ""
                      ) {
                        event.preventDefault()
                        back()
                      }
                    }}
                  >
                    {active && active.submenu && submenuContent(active)}
                  </PopoverPrimitive.Popup>
                </PopoverPrimitive.Positioner>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          </>
        ) : (
          <div
            key={activeKey ?? "__root__"}
            onKeyDownCapture={(event) => {
              if (
                activeKey &&
                event.key === "Backspace" &&
                event.target instanceof HTMLInputElement &&
                event.target.value === ""
              ) {
                event.preventDefault()
                back()
              }
            }}
            className={cn(
              "flex flex-col",
              activeKey &&
                dir === "forward" &&
                "animate-in slide-in-from-right-2 fade-in-0 duration-150",
              !activeKey &&
                dir === "back" &&
                "animate-in slide-in-from-left-2 fade-in-0 duration-150",
            )}
          >
            {active && active.submenu ? (
              <>
                <button
                  type="button"
                  onClick={back}
                  className="hover:bg-accent text-muted-foreground flex items-center gap-1.5 border-b px-2 py-1.5 text-left text-xs font-medium"
                >
                  <IconChevronLeft className="h-3.5 w-3.5" />
                  {active.icon}
                  {active.label}
                </button>
                {submenuContent(active)}
              </>
            ) : (
              fieldList
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
