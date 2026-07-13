"use client"

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

type CompactHeaderState = {
  isCompact: boolean
  sentinelRef: (node: HTMLDivElement | null) => void
}

const CompactHeaderContext = createContext<CompactHeaderState>({
  isCompact: false,
  sentinelRef: () => {},
})

export function CompactHeaderProvider({ children }: { children: ReactNode }) {
  const [isCompact, setIsCompact] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const currentSentinel = useRef<HTMLDivElement | null>(null)

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    currentSentinel.current = node

    if (!node) return

    // the sentinel is a zero-height div at the top of the scrollable content.
    // when it leaves the viewport (scrolled past), we switch to compact mode.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        setIsCompact(!entry.isIntersecting)
      },
      { threshold: 0 },
    )

    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return (
    <CompactHeaderContext.Provider value={{ isCompact, sentinelRef }}>
      {children}
    </CompactHeaderContext.Provider>
  )
}

export function useCompactHeader() {
  return useContext(CompactHeaderContext)
}

export function CompactHeaderSentinel() {
  const { sentinelRef } = useCompactHeader()
  return <div ref={sentinelRef} className="h-0 w-full" aria-hidden />
}
