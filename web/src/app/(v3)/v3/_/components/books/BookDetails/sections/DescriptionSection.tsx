"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { EditableText } from "@v3/_/components/books/BookDetails/EditableField"

import { cn } from "@/cn"
import { PreviewCardPortal } from "@base-ui/react"
import { createPortal } from "react-dom"
import { useScroll } from "framer-motion"

const COLLAPSED_HEIGHT = 96

function CollapsibleDescription({ html }: { html: string }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    setIsOverflowing(el.scrollHeight > COLLAPSED_HEIGHT + 8)
  }, [html])

  const contentRect = contentRef.current?.getBoundingClientRect()
  console.log(contentRect, contentRef.current?.scrollTop)

  const { scrollY, scrollX, scrollYProgress } = useScroll({
    target: contentRef,
  })
  console.log("scrollY", scrollY, scrollX, scrollYProgress)
  scrollY.on("change", (latest) => {
    console.log("latest", latest)
  })

  return (
    <div className="relative">
      <div className="relative">
        <div
          ref={contentRef}
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none overflow-hidden text-xs transition-[max-height] duration-300",
          )}
          style={{
            maxHeight: expanded
              ? contentRef.current?.scrollHeight
              : COLLAPSED_HEIGHT,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {!expanded && isOverflowing && (
          <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t to-transparent" />
        )}
      </div>

      {isOverflowing &&
        createPortal(
          <button
            type="button"
            onClick={() => {
              setExpanded((prev) => !prev)
            }}
            // this needs to hover over the editable field
            className="text-primary bg-red absolute z-50 mt-1 h-20 w-20 text-xs font-medium hover:underline"
            style={{
              // contentRef.current?.getBoundingClientRect().y +
              top:
                contentRef.current?.getBoundingClientRect().top -
                  contentRef.current?.scrollTop ?? 0,
              left:
                contentRef.current?.getBoundingClientRect().left +
                  contentRef.current?.scrollLeft ?? 0,
            }}
          >
            {expanded ? "Hide" : "Show more"}
          </button>,
          document.body,
        )}
    </div>
  )
}

export function DescriptionSection({ className }: { className?: string }) {
  const t = useTranslations("BookDetailsPage")
  const tLabels = useTranslations("Labels")

  return (
    <section className={className}>
      <h2 className="section-label mb-3">{tLabels("description")}</h2>

      <EditableText
        name="description"
        as="div"
        multiline
        placeholder={t("noDescriptionAvailable")}
        renderDisplay={(html) => <CollapsibleDescription html={html} />}
      />
    </section>
  )
}
