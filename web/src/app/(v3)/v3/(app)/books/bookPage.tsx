"use client"

import {
  IconArrowUpRight,
  IconPencil,
  IconPencilMinus,
  IconSquareCheck,
  IconX,
} from "@tabler/icons-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo } from "react"
import { Drawer } from "vaul"

import { useListInfiniteBooksInfiniteQuery } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { uiSettingsSlice } from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { type HeaderAction } from "@v3/_/components/header-actions"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  PageContent,
  PageHeader,
  PageLayout,
  PageMain,
  PagePanel,
} from "@v3/_/components/ui/page-layout"
import { ScrollArea } from "@v3/_/components/ui/scroll-area"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"
import { UserPermissionSet } from "@/database/users"

const DynamicBookDetailsContent = dynamic(
  () =>
    import("@v3/_/components/books/BookDetailsPage").then(
      (mod) => mod.BookDetailsContent,
    ),
  {
    ssr: false,
    loading: () => <BookDetailsSkeleton compact={true} />,
  },
)

export default function BookPage({
  permissions,
}: {
  permissions: UserPermissionSet
}) {
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()
  const panelWidth = useAppSelector(
    (state) => state.uiSettings.detailPanelWidth,
  )

  const {
    isSelecting,
    startSelecting,
    stopSelecting,
    toggleSelection,
    isSelected,
  } = useBookSelection()

  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )

  const {
    state,
    onChange,
    queryArg,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearFilters,
    filterPopoverOpen,
    setFilterPopoverOpen,
    handleSortChange: _handleSortChange,
  } = useBookFilters()

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListInfiniteBooksInfiniteQuery({
    ...queryArg,
  })

  const books = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  )

  const bookUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const showMuted =
    isSearching || (isFetching && !isFetchingNextPage && books.length > 0)

  const _actions: HeaderAction[] = useMemo(() => {
    return [
      {
        label: isSelecting ? "Done" : "Select",
        icon: isSelecting ? (
          <IconPencilMinus className="h-4 w-4" />
        ) : (
          <IconPencil className="h-4 w-4" />
        ),
        onClick: isSelecting ? stopSelecting : startSelecting,
      },
    ]
  }, [isSelecting, startSelecting, stopSelecting])

  const panelOpen = !!selectedBookUuid

  const handleBookClick = useCallback(
    (book: { uuid: string }) => {
      if (isSelecting) {
        toggleSelection(book.uuid)
        return
      }

      void setSelectedBookUuid(book.uuid)
    },
    [setSelectedBookUuid, isSelecting, toggleSelection],
  )

  const handleClosePanel = useCallback(() => {
    void setSelectedBookUuid(null)
  }, [setSelectedBookUuid])

  const handlePanelWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setDetailPanelWidth(width))
    },
    [dispatch],
  )

  const panelBookIsSelected = selectedBookUuid
    ? isSelected(selectedBookUuid)
    : false

  const handleTogglePanelBookSelection = useCallback(() => {
    if (!selectedBookUuid) return

    if (!isSelecting) {
      startSelecting()
    }

    toggleSelection(selectedBookUuid)
  }, [selectedBookUuid, isSelecting, startSelecting, toggleSelection])

  return (
    <>
      <PageLayout>
        <PageMain>
          <PageHeader>
            <SiteHeader breadcrumbs={[{ label: "Books" }]} />
          </PageHeader>

          <BookFilters
            state={state}
            onChange={onChange}
            filterPopoverOpen={filterPopoverOpen}
            setFilterPopoverOpen={setFilterPopoverOpen}
            showSaveSearch
          />

          <PageContent className="p-4">
            <BookGrid
              books={books}
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              showMuted={showMuted}
              emptySubMessage={
                deferredSearch || activeFilterCount > 0
                  ? "Try adjusting your search or filters"
                  : undefined
              }
              onClearFilters={clearFilters}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
            />
          </PageContent>
        </PageMain>

        {!isMobile && (
          <PagePanel
            open={panelOpen}
            width={panelWidth}
            onWidthChange={handlePanelWidthChange}
            className="border-l"
          >
            {selectedBookUuid && (
              <>
                <BookPanelHeader
                  bookUuid={selectedBookUuid}
                  isSelected={panelBookIsSelected}
                  onToggleSelection={handleTogglePanelBookSelection}
                  onClose={handleClosePanel}
                />

                <ScrollArea className="h-full flex-1">
                  <DynamicBookDetailsContent
                    uuid={selectedBookUuid as UUID}
                    compact
                  />
                </ScrollArea>
              </>
            )}
          </PagePanel>
        )}
      </PageLayout>

      {isMobile && (
        <Drawer.Root
          open={panelOpen}
          onOpenChange={(open) => {
            if (!open) handleClosePanel()
          }}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 z-50 flex max-h-[85svh] flex-col rounded-t-2xl">
              <div className="bg-muted-foreground/20 mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full" />

              <div className="flex items-center justify-between px-4 py-3">
                <Drawer.Title className="text-lg font-semibold">
                  Book Details
                </Drawer.Title>

                <div className="flex items-center gap-2">
                  {isSelecting && selectedBookUuid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTogglePanelBookSelection}
                      className={cn(
                        panelBookIsSelected &&
                          "border-primary bg-primary/5 text-primary",
                      )}
                    >
                      <IconSquareCheck className="mr-1 h-4 w-4" />
                      {panelBookIsSelected ? "Selected" : "Select"}
                    </Button>
                  )}

                  {selectedBookUuid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      render={
                        <Link href={`/v3/books/${selectedBookUuid}`}>
                          <IconArrowUpRight className="mr-1 h-4 w-4" />
                          Full Page
                        </Link>
                      }
                    />
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-0 pb-8">
                {selectedBookUuid && (
                  <DynamicBookDetailsContent
                    canEdit={permissions.bookUpdate}
                    canDownload={permissions.bookDownload}
                    uuid={selectedBookUuid as UUID}
                    compact
                  />
                )}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}

      <SelectionToolbar allBookUuids={bookUuids} />
    </>
  )
}

function BookPanelHeader({
  bookUuid,
  isSelected,
  onToggleSelection,
  onClose,
}: {
  bookUuid: string
  isSelected: boolean
  onToggleSelection: () => void
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-4 py-2 transition-colors",
        isSelected && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => {
            onToggleSelection()
          }}
          className="h-5 w-5"
        />

        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href={`/v3/books/${bookUuid}`}>
              <IconArrowUpRight className="mr-1 h-4 w-4" />
              Open Full Page
            </Link>
          }
        />
      </div>

      <Button variant="ghost" size="icon-sm" onClick={onClose}>
        <IconX className="h-4 w-4" />
      </Button>
    </div>
  )
}
