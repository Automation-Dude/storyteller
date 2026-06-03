"use client"

import dynamic from "next/dynamic"
import { type ReactNode, useCallback } from "react"
import { Drawer } from "vaul"

import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { SiteHeader } from "@v3/_/components/site-header"
import {
  PageHeader,
  PageLayout,
  PageMain,
  PagePanel,
  PageSidebar,
} from "@v3/_/components/ui/page-layout"
import { useIsMobile } from "@v3/_/hooks/use-mobile"

import { type BookWithRelations } from "@/database/books"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { uiSettingsSlice } from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

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

  headerBreadcrumbs: ({ label: string; url?: string } | { render: ReactNode })[]
  headerActions?: ReactNode

  children: ReactNode

  selectedBookUuid: string | null
  // the matching row from the list query. forwarded to the detail content,
  // which seeds the getBook cache from it so the panel needs no extra fetch.
  selectedBook?: BookWithRelations
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
  selectedBook,
  onClosePanel,
  allBookUuids,
}: BookListLayoutProps) {
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()

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
          selectedBook={selectedBook}
          onClose={onClosePanel}
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
            <DynamicBookDetailsContent
              uuid={selectedBookUuid as UUID}
              initialBook={selectedBook}
              compact
              onClose={onClosePanel}
            />
          )}
        </PagePanel>
      </PageLayout>

      {selectionToolbar}
    </>
  )
}

export function BookDetailDrawer({
  selectedBookUuid,
  selectedBook,
  onClose,
}: {
  selectedBookUuid: string | null
  selectedBook?: BookWithRelations
  onClose: () => void
}) {
  return (
    <Drawer.Root
      open={!!selectedBookUuid}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />

        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 z-50 flex max-h-[85svh] flex-col overflow-clip rounded-t-2xl">
          <div className="bg-muted-foreground/20 mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full" />

          <Drawer.Title className="sr-only">Book Details</Drawer.Title>

          <div className="scroll-y flex-1 px-0 pb-8">
            {selectedBookUuid && (
              <DynamicBookDetailsContent
                uuid={selectedBookUuid as UUID}
                initialBook={selectedBook}
                compact
                onClose={onClose}
              />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
