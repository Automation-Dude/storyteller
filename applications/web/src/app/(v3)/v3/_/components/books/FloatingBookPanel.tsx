"use client"

import { useHotkey } from "@tanstack/react-hotkeys"
import dynamic from "next/dynamic"
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import { BookDetailDrawer } from "@v3/_/components/books/BookListLayout"
import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
} from "@v3/_/components/ui/page-layout"
import { useBookInSidePanel } from "@v3/_/hooks/use-open-book"

import { BookDetailsSkeleton } from "@/app/(v3)/v3/_/components/books/BookDetails/BookDetailsSkeleton"
import { useIsMobile } from "@/app/(v3)/v3/_/hooks/use-mobile"
import { cn } from "@/cn"
import { useAppSelector } from "@/store/appState"
import { type UUID } from "@/uuid"

const DynamicBookDetailsContent = dynamic(
  () =>
    import("@/app/(v3)/v3/_/components/books/BookDetails/BookDetailsPage").then(
      (mod) => mod.BookDetailsContent,
    ),
  {
    ssr: false,
    loading: () => <BookDetailsSkeleton compact={true} />,
  },
)

// pages that host their own `?book=` panel (BookListPage) claim the param so
// the app-wide floating panel stays out of the way there.
const FloatingBookPanelClaimContext = createContext<(() => () => void) | null>(
  null,
)

export function useClaimBookPanel() {
  const claim = useContext(FloatingBookPanelClaimContext)
  useEffect(() => claim?.(), [claim])
}

export function FloatingBookPanelProvider({
  children,
}: {
  children: ReactNode
}) {
  const [claims, setClaims] = useState(0)

  const claim = useCallback(() => {
    setClaims((count) => count + 1)
    return () => {
      setClaims((count) => count - 1)
    }
  }, [])

  return (
    <FloatingBookPanelClaimContext.Provider value={claim}>
      {children}
      <FloatingBookPanel suppressed={claims > 0} />
    </FloatingBookPanelClaimContext.Provider>
  )
}

const CLOSE_DURATION_MS = 250

function FloatingBookPanel({ suppressed }: { suppressed: boolean }) {
  const isMobile = useIsMobile()
  const { selectedBookUuid, setSelectedBookUuid } = useBookInSidePanel()

  const storedWidth = useAppSelector(
    (state) => state.uiSettings.detailPanelWidth,
  )
  const width = Math.max(
    MIN_PANEL_WIDTH,
    Math.min(MAX_PANEL_WIDTH, storedWidth),
  )

  const open = !suppressed && !!selectedBookUuid

  const handleClose = useCallback(() => {
    void setSelectedBookUuid(null)
  }, [setSelectedBookUuid])

  useHotkey(
    "Escape",
    () => {
      if (open) handleClose()
    },
    { ignoreInputs: true },
  )

  // keep the closing panel's content mounted while it slides shut
  const lastUuidRef = useRef<string | null>(null)
  useEffect(() => {
    if (selectedBookUuid) lastUuidRef.current = selectedBookUuid
  }, [selectedBookUuid])

  const [rendered, setRendered] = useState(open)
  const [slidIn, setSlidIn] = useState(false)

  useEffect(() => {
    if (open) {
      setRendered(true)
      // double rAF so a fresh mount paints off-screen before sliding in
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlidIn(true)
        })
      })
      return () => {
        cancelAnimationFrame(raf)
      }
    }

    setSlidIn(false)
    const timeout = setTimeout(() => {
      setRendered(false)
    }, CLOSE_DURATION_MS)
    return () => {
      clearTimeout(timeout)
    }
  }, [open])

  if (isMobile) {
    return (
      <BookDetailDrawer
        selectedBookUuid={open ? selectedBookUuid : null}
        onClose={handleClose}
      />
    )
  }

  const shownUuid = selectedBookUuid ?? lastUuidRef.current
  if (!rendered || !shownUuid) return null

  return (
    <div
      role="dialog"
      aria-label="Book details"
      className={cn(
        "bg-surface-raised fixed inset-y-2 right-2 z-50 flex max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl shadow-2xl",
        "transition-transform duration-250 ease-out",
        slidIn ? "translate-x-0" : "translate-x-[calc(100%+1rem)]",
      )}
      style={{ width }}
    >
      <DynamicBookDetailsContent
        uuid={shownUuid as UUID}
        compact
        onClose={handleClose}
      />
    </div>
  )
}
