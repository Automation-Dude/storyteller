"use client"

import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/cn"

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
            "bg-background/95 supports-[backdrop-filter]:bg-background/80 z-50 flex items-center gap-2 rounded-full border p-2 shadow-lg backdrop-blur",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
