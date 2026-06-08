"use client"

import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/cn"

// the shared bottom action bar: a small floating slab that slides up from the
// bottom of its container. used by the book edit bar, the bulk selection
// toolbar, and the sidebar entity actions so they all look and move the same.
// placement (fixed vs absolute, centering) is left to `className` since each
// context anchors to a different element.
export function ActionBar({
  show = true,
  className,
  children,
}: {
  show?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "bg-background/95 supports-[backdrop-filter]:bg-background/80 z-50 flex items-center gap-2 rounded-lg border p-2 shadow-lg backdrop-blur",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
