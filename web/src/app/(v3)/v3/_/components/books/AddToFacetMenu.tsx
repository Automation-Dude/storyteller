import { type MenuRootChangeEventDetails } from "@base-ui/react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/app/(v3)/v3/_/components/ui/dropdown-menu"
import { Input } from "@/app/(v3)/v3/_/components/ui/input"
import { Skeleton } from "@/app/(v3)/v3/_/components/ui/skeleton"
import {
  useCommon,
  useTranslation,
} from "@/app/(v3)/v3/_/hooks/use-translation"

import { RelationGlyph } from "./RelationChipEditor"
import { useFacetItems } from "./RelationshipDropdownMenu"

export function AddToFacetMenu({
  icon,
  label,
  options,
  onSelect,
  createLabel,
  onCreate,
  isLoading,
  onOpenChange,
  trigger,
  subMenu = false,
}: {
  icon: ReactNode
  label: string
  isLoading: boolean
  options: { id: string; name: string }[]
  onSelect: (id: string, event: MouseEvent) => void
  createLabel?: string
  onCreate?: () => void
  trigger?: ReactNode
  subMenu?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const Menu = subMenu ? DropdownMenuSub : DropdownMenu
  const MenuTrigger = subMenu ? DropdownMenuSubTrigger : DropdownMenuTrigger
  const MenuContent = subMenu ? DropdownMenuSubContent : DropdownMenuContent
  const handleOpenChange = useCallback(
    (next: boolean, eventDetails: MenuRootChangeEventDetails) => {
      //   onOpenChange(next)
      //   console.log(eventDetails)
      //   if (eventDetails.reason === "trigger-hover") {
      //     setOpen(true)
      //     return
      //   }

      setOpen(next)
      if (!next) setSearch("")
    },
    [],
  )

  // TODO: this is fukcing jank
  return (
    <Menu open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        trigger
      ) : (
        <MenuTrigger>
          {icon}
          {label}
        </MenuTrigger>
      )}
      <MenuContent className="w-fit p-1">
        <FacetMenuContent
          search={search}
          enabled={open}
          source={"tags"}
          setSearch={setSearch}
          onSelect={onSelect}
          onCreate={onCreate}
          createLabel={createLabel}
        />
      </MenuContent>
    </Menu>
  )
}

function FacetMenuContent({
  search,
  setSearch,
  onSelect,
  source,
  enabled,
  //   onCreate,
  //   createLabel,
}: {
  search: string
  setSearch: (search: string) => void
  source: "tags" | "collections" | "series" | "creators" | "statuses"
  enabled: boolean
  onSelect: (id: string, event: MouseEvent) => void
  onCreate?: () => void
  createLabel?: string
}) {
  const t = useTranslation("BookActions")
  const c = useCommon()
  const scrollRef = useRef<HTMLDivElement>(null)
  const items = useFacetItems(source, enabled)

  const filtered = useMemo(() => {
    return items.items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()),
    )
  }, [items.items, search])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => {
      // dropdown menu is unmounted when closed, so we need to return null to avoid errors
      if (!scrollRef.current?.isConnected) return null
      return scrollRef.current
    },
    estimateSize: () => 32,

    overscan: 12,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div>
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
        }}
        placeholder={t("search")}
        className="mb-1 h-8"
      />
      <div ref={scrollRef} className="scroll-y max-h-64">
        {/* {onCreate && createLabel && (
                <button
                  type="button"
                  onClick={() => {
                    onCreate()
                    setOpen(false)
                  }}
                  className="hover:bg-accent text-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  {createLabel}
                </button>
              )} */}

        {filtered.length === 0 && !items.loading ? (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">
            {c("empty.noResults")}
          </div>
        ) : items.loading ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={`loading-${idx}`}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
            >
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
            }}
            key={filtered.length}
          >
            {virtualItems.map((row) => {
              const item = filtered[row.index]
              if (!item) return null
              return (
                <DropdownMenuItem
                  key={item.uuid}
                  onClick={(event) => {
                    onSelect(item.uuid, event as MouseEvent)
                    //   setOpen(false)
                  }}
                  className="hover:bg-accent absolute top-0 left-0 flex w-full! items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
                  style={{
                    height: 32,
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <RelationGlyph item={item} />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

//   <Popover open={isOpen} onOpenChange={handleOpenChange}>
//     <PopoverTrigger
//       render={
//         <TooltipButton
//           variant="ghost"
//           className={cn(
//             "border-border text-muted-foreground/80 h-5 rounded-full border border-dashed text-xs transition-opacity",
//           )}
//           tooltip={c.plain("actions.add")}
//           aria-label={c.plain("actions.add")}
//         >
//           <IconPlus className="h-3 w-3" />
//         </TooltipButton>
//       }
//     />

//     <PopoverContent className="w-64 p-2" align="start">
//       <Input
//         placeholder={searchPlaceholder}
//         value={search}
//         onChange={(e) => {
//           setSearch(e.target.value)
//         }}
//         onKeyDown={(e) => {
//           if (e.key !== "Enter" || !search.trim()) {
//             return
//           }

//           if (canCreateInline) {
//             handleCreate()
//           }
//         }}
//       />

//       <div className="scroll-y flex max-h-48 flex-col gap-0.5">
//         {isLoading
//           ? Array.from({ length: 5 }).map((_, idx) => (
//               <div
//                 key={`loading-${idx}`}
//                 className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
//               >
//                 <Skeleton className="h-3 w-3" />
//                 <Skeleton className="h-3 w-16" />
//               </div>
//             ))
//           : filteredItems.map((item, idx) => (
//               <button
//                 key={`${item.uuid}-${idx}`}
//                 type="button"
//                 aria-label={tLabels("add.withInput", { input: item.name })}
//                 onClick={() => {
//                   handleSelect(item)
//                 }}
//                 className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
//               >
//                 <RelationGlyph item={item} />
//                 {item.name}
//               </button>
//             ))}

//         {showCreateInline && (
//           <button
//             type="button"
//             aria-label={tLabels("create.withInput", {
//               input: `"${search.trim()}"`,
//             })}
//             onClick={handleCreate}
//             className="hover:bg-accent text-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs"
//           >
//             <IconPlus className="h-3 w-3" />
//             {tLabels("create.withInput", {
//               input: `"${search.trim()}"`,
//             })}
//           </button>
//         )}

//         {renderCreateAction?.(search, () => {
//           setIsOpen(false)
//         })}
//       </div>
//     </PopoverContent>
//   </Popover>
