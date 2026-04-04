"use client"

import {
  IconArrowUpRight,
  IconEdit,
  IconSquareCheck,
  IconX,
} from "@tabler/icons-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { type ReactNode, useCallback, useState } from "react"
import { Drawer } from "vaul"

import { useAppDispatch, useAppSelector } from "@/store/appState"
import { uiSettingsSlice } from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  PageHeader,
  PageLayout,
  PageMain,
  PagePanel,
  PageSidebar,
} from "@v3/_/components/ui/page-layout"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"

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

type BookListLayoutProps = {
  sidebar?: ReactNode
  sidebarWidth?: number
  onSidebarWidthChange?: (width: number) => void

  headerBreadcrumbs: { label: string; url?: string }[]
  headerActions?: ReactNode

  children: ReactNode

  selectedBookUuid: string | null
  onClosePanel: () => void

  allBookUuids?: string[]
}

export function BookListLayout({
  sidebar,
  sidebarWidth,
  onSidebarWidthChange,
  headerBreadcrumbs,
  headerActions,
  children,
  selectedBookUuid,
  onClosePanel,
  allBookUuids,
}: BookListLayoutProps) {
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()
  const selection = useOptionalBookSelection()
  const [panelIsEditing, setPanelIsEditing] = useState(false)

  const panelWidth = useAppSelector(
    (state) => state.uiSettings.detailPanelWidth,
  )

  const panelOpen = !!selectedBookUuid

  const handlePanelWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setDetailPanelWidth(width))
    },
    [dispatch],
  )

  const panelBookIsSelected = selectedBookUuid
    ? selection?.isSelected(selectedBookUuid) ?? false
    : false

  const handleTogglePanelBookSelection = useCallback(() => {
    if (!selectedBookUuid || !selection) {
      return
    }

    if (!selection.isSelecting) {
      selection.startSelecting()
    }

    selection.toggleSelection(selectedBookUuid)
  }, [selectedBookUuid, selection])

  const handleClosePanel = useCallback(() => {
    setPanelIsEditing(false)
    onClosePanel()
  }, [onClosePanel])

  const selectionToolbar = allBookUuids ? (
    <SelectionToolbar allBookUuids={allBookUuids} />
  ) : null

  if (isMobile) {
    return (
      <>
        <PageLayout>
          <PageMain>
            <PageHeader>
              <SiteHeader
                breadcrumbs={headerBreadcrumbs}
                actions={headerActions}
              />
            </PageHeader>

            {children}
          </PageMain>
        </PageLayout>

        <BookDetailDrawer
          selectedBookUuid={selectedBookUuid}
          onClose={handleClosePanel}
        />

        {selectionToolbar}
      </>
    )
  }

  return (
    <>
      <PageLayout>
        {sidebar && (
          <PageSidebar
            width={sidebarWidth ?? 280}
            {...(onSidebarWidthChange && {
              onWidthChange: onSidebarWidthChange,
            })}
            className="border-r"
          >
            {sidebar}
          </PageSidebar>
        )}

        <PageMain>
          <PageHeader>
            <SiteHeader
              breadcrumbs={headerBreadcrumbs}
              actions={headerActions}
            />
          </PageHeader>

          {children}
        </PageMain>

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
                showSelection={!!selection}
                isEditing={panelIsEditing}
                onToggleEdit={() => {
                  setPanelIsEditing((prev) => !prev)
                }}
              />

              <DynamicBookDetailsContent
                uuid={selectedBookUuid as UUID}
                compact
                isEditing={panelIsEditing}
                onEditingChange={setPanelIsEditing}
              />
            </>
          )}
        </PagePanel>
      </PageLayout>

      {selectionToolbar}
    </>
  )
}

export function BookDetailDrawer({
  selectedBookUuid,
  onClose,
}: {
  selectedBookUuid: string | null
  onClose: () => void
}) {
  const selection = useOptionalBookSelection()
  const panelOpen = !!selectedBookUuid

  const panelBookIsSelected = selectedBookUuid
    ? selection?.isSelected(selectedBookUuid) ?? false
    : false

  const handleTogglePanelBookSelection = useCallback(() => {
    if (!selectedBookUuid || !selection) {
      return
    }

    if (!selection.isSelecting) {
      selection.startSelecting()
    }

    selection.toggleSelection(selectedBookUuid)
  }, [selectedBookUuid, selection])

  return (
    <Drawer.Root
      open={panelOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
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
              {selection?.isSelecting && selectedBookUuid && (
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
                uuid={selectedBookUuid as UUID}
                compact
              />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function BookPanelHeader({
  bookUuid,
  isSelected,
  onToggleSelection,
  onClose,
  showSelection,
  isEditing,
  onToggleEdit,
}: {
  bookUuid: string
  isSelected: boolean
  onToggleSelection: () => void
  onClose: () => void
  showSelection: boolean
  isEditing: boolean
  onToggleEdit: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-4 py-2 transition-colors",
        isSelected && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-3">
        {showSelection && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {
              onToggleSelection()
            }}
            className="h-5 w-5"
          />
        )}

        <Button
          variant="ghost"
          nativeButton={false}
          size="sm"
          render={
            <Link href={`/v3/books/${bookUuid}`}>
              <IconArrowUpRight className="mr-1 h-4 w-4" />
              Open Full Page
            </Link>
          }
        />
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant={isEditing ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={onToggleEdit}
        >
          <IconEdit className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <IconX className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
