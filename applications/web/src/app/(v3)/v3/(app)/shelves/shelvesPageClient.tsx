"use client"


import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function ShelvesPageClient(props?: { initialShelfUuid?: string }) {
  const t = useTranslation("LibraryPage")

  return (
    <LibraryPage
      title={t("Shelves.plain")}
      section={librarySections.shelves}
      noneLabel={t("allItems")}
      {...(props?.initialShelfUuid && {
        initialSelectedItem: props.initialShelfUuid,
      })}
    />
  )

  // const [selectedItem, setSelectedItem] = useQueryState("item", parseAsString)

  // const { data: shelves = [] } = useListUserShelvesQuery()

  // const activeShelfUuid =
  //   selectedItem && selectedItem !== "_none" ? selectedItem : null

  // const activeShelf = activeShelfUuid
  //   ? shelves.find((s) => s.uuid === activeShelfUuid)
  //   : null

  // const sidebar = (
  //   <div className="flex h-full flex-col overflow-y-auto border-r">
  //     <div className="flex flex-col gap-0.5 p-2">
  //       {shelves.map((shelf) => {
  //         const { label } = extractEmojiIcon(shelf.name)
  //         const isActive = shelf.uuid === activeShelfUuid

  //         return (
  //           <button
  //             key={shelf.uuid}
  //             type="button"
  //             onClick={() => {
  //               void setSelectedItem(shelf.uuid)
  //             }}
  //             className={cn(
  //               "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
  //               isActive
  //                 ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
  //                 : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
  //             )}
  //           >
  //             <span className="truncate">{label || shelf.name}</span>
  //           </button>
  //         )
  //       })}
  //     </div>
  //   </div>
  // )

  // return (
  //   <BookListPage
  //     source={{
  //       kind: "shelf",
  //       shelfUuid: (activeShelfUuid ?? "") as UUID,
  //     }}
  //     skip={!activeShelfUuid}
  //     breadcrumbs={[
  //       { label: t("title") },
  //       ...(activeShelf
  //         ? [
  //             {
  //               label:
  //                 extractEmojiIcon(activeShelf.name).label || activeShelf.name,
  //             },
  //           ]
  //         : []),
  //     ]}
  //     headerActions={
  //       activeShelf ? (
  //         <ShelfActionsMenu
  //           shelf={activeShelf}
  //           onDeleted={() => {
  //             void setSelectedItem(null)
  //           }}
  //         />
  //       ) : undefined
  //     }
  //     sidebar={sidebar}
  //     filtersClassName="pt-1"
  //     emptyMessage={
  //       activeShelfUuid ? t.plain("emptyShelf") : t.plain("selectAShelf")
  //     }
  //     emptyFilteredSubMessage={t.plain("adjustFilters")}
  //   />
  // )
}
