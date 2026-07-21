"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { type AuditBook } from "@/database/auditLibrary"
import { applicableChoice } from "@/metadata/proposals"
import { type RepairChoice } from "@/metadata/repair"
import { useApplyRepairsMutation, useSuggestRepairsMutation } from "@/store/api"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import { Spinner } from "@v3/_/components/ui/spinner"

const BATCH = 25

function summarise(choice: RepairChoice): string {
  const parts: string[] = []
  if (choice.title) parts.push(`"${choice.title}"`)
  if (choice.authors) parts.push(choice.authors.join(", "))
  if (choice.language) parts.push(choice.language)
  if (choice.series)
    parts.push(
      choice.series.position != null
        ? `${choice.series.name} #${choice.series.position}`
        : choice.series.name,
    )
  if (choice.description) parts.push("description")
  if (choice.coverUrl) parts.push("cover")
  return parts.join(" · ")
}

type Row = { book: AuditBook; change: RepairChoice; checked: boolean }

export function AutoRepairDialog({
  books,
  open,
  onOpenChange,
}: {
  books: AuditBook[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("LibraryAuditPage")
  const [suggest] = useSuggestRepairsMutation()
  const [applyRepairs, apply] = useApplyRepairsMutation()

  const [phase, setPhase] = useState<"scanning" | "review" | "done">("scanning")
  const [scanned, setScanned] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [applied, setApplied] = useState(0)

  useEffect(() => {
    if (!open) {
      setPhase("scanning")
      setScanned(0)
      setRows([])
      setApplied(0)
      return
    }

    const run = { cancelled: false }
    // Read through a call so control-flow analysis cannot decide the flag is
    // "always false": it is flipped later by the cleanup, during an await.
    const stopped = () => run.cancelled
    const byUuid = new Map(books.map((b) => [b.uuid, b]))

    async function scan() {
      const found: Row[] = []
      for (let i = 0; i < books.length; i += BATCH) {
        if (stopped()) return
        const batch = books.slice(i, i + BATCH)
        try {
          const { proposals } = await suggest({
            bookUuids: batch.map((b) => b.uuid),
          }).unwrap()
          for (const proposal of proposals) {
            const book = byUuid.get(proposal.bookUuid)
            if (!book) continue
            const change = applicableChoice(proposal)
            if (Object.keys(change).length) {
              found.push({ book, change, checked: true })
            }
          }
        } catch {
          // A failed batch just contributes no suggestions; keep going.
        }
        if (!stopped()) setScanned(Math.min(i + BATCH, books.length))
      }
      if (!stopped()) {
        setRows(found)
        setPhase("review")
      }
    }

    void scan()
    return () => {
      run.cancelled = true
    }
  }, [open, books, suggest])

  const checkedRows = rows.filter((r) => r.checked)

  async function onApply() {
    const result = await applyRepairs({
      repairs: checkedRows.map((r) => ({
        bookUuid: r.book.uuid,
        ...r.change,
      })),
    }).unwrap()
    setApplied(result.applied)
    setPhase("done")
    if (result.failed > 0) {
      toast.warning(t("autoRepair.someFailed", { failed: result.failed }))
    } else {
      toast.success(t("autoRepair.done", { applied: result.applied }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("autoRepair.title")}</DialogTitle>
          <DialogDescription>{t("autoRepair.description")}</DialogDescription>
        </DialogHeader>

        {phase === "scanning" ? (
          <div className="text-muted-foreground flex items-center gap-3 py-8 text-sm">
            <Spinner />
            {t("autoRepair.scanning", { scanned, total: books.length })}
          </div>
        ) : phase === "done" ? (
          <p className="py-6 text-sm">
            {t("autoRepair.appliedSummary", { applied })}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-sm">
            {t("autoRepair.noConfident")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((row, index) => (
              <li key={row.book.uuid} className="flex items-start gap-3 py-2">
                <Checkbox
                  checked={row.checked}
                  onCheckedChange={(checked) => {
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === index ? { ...r, checked: checked } : r,
                      ),
                    )
                  }}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {row.book.title}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    {summarise(row.change)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {row.book.issues.map((issue) => (
                    <Badge
                      key={issue}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {t(`issues.${issue}`)}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          {phase === "review" && rows.length > 0 ? (
            <>
              <span className="text-muted-foreground mr-auto self-center text-sm">
                {t("autoRepair.selected", { count: checkedRows.length })}
              </span>
              <Button
                variant="ghost"
                onClick={() => {
                  onOpenChange(false)
                }}
              >
                {t("repair.cancel")}
              </Button>
              <Button
                onClick={() => void onApply()}
                disabled={apply.isLoading || checkedRows.length === 0}
              >
                {apply.isLoading ? <Spinner /> : null}
                {t("autoRepair.apply", { count: checkedRows.length })}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
              }}
            >
              {t("repair.cancel")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
