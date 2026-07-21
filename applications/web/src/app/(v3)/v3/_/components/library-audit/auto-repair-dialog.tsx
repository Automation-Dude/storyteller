"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { type AuditBook } from "@/database/auditLibrary"
import { applicableChoice } from "@/metadata/proposals"
import { type RepairChoice } from "@/metadata/repair"
import { type RepairProposal } from "@/metadata/resolve"
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

// Small enough that fixes start appearing within a second or two, large enough
// that a big library does not make hundreds of round trips.
const SCAN_BATCH = 10
const APPLY_BATCH = 10

type Row = {
  book: AuditBook
  proposal: RepairProposal
  change: RepairChoice
  checked: boolean
  /**
   * "ready" is safe unattended (file-sourced or a confident catalogue match);
   * "review" matched below auto-apply confidence and waits for a person to
   * endorse it. Hiding those entirely made the scan look like it found
   * nothing on books it had actually matched.
   */
  kind: "ready" | "review"
  applied?: boolean
}

/** One "field: value" chip per thing the repair will change, before to after. */
function changeParts(row: Row): { label: string; detail?: string }[] {
  const { change, proposal } = row
  const parts: { label: string; detail?: string }[] = []
  if (change.title)
    parts.push({
      label:
        proposal.currentTitle && proposal.currentTitle !== change.title
          ? `title: ${proposal.currentTitle} -> ${change.title}`
          : `title: ${change.title}`,
    })
  if (change.authors) {
    const before = proposal.currentAuthors.join(", ")
    const after = change.authors.join(", ")
    parts.push({
      label:
        before && before !== after
          ? `author: ${before} -> ${after}`
          : `author: ${after}`,
    })
  }
  if (change.language) parts.push({ label: `language: ${change.language}` })
  if (change.series)
    parts.push({
      label:
        change.series.position != null
          ? `series: ${change.series.name} #${change.series.position}`
          : `series: ${change.series.name}`,
    })
  if (change.description)
    parts.push({
      label: "description",
      detail:
        change.description.length > 140
          ? `${change.description.slice(0, 140)}...`
          : change.description,
    })
  if (change.coverUrl) parts.push({ label: "cover" })
  return parts
}

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
  const [applyRepairs] = useApplyRepairsMutation()

  const [phase, setPhase] = useState<
    "scanning" | "review" | "applying" | "done"
  >("scanning")
  const [scanned, setScanned] = useState(0)
  const [checking, setChecking] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [applied, setApplied] = useState(0)

  useEffect(() => {
    if (!open) {
      setPhase("scanning")
      setScanned(0)
      setChecking(null)
      setRows([])
      setApplied(0)
      return
    }

    const run = { cancelled: false }
    const stopped = () => run.cancelled
    const byUuid = new Map(books.map((b) => [b.uuid, b]))

    async function scan() {
      for (let i = 0; i < books.length; i += SCAN_BATCH) {
        if (stopped()) return
        const batch = books.slice(i, i + SCAN_BATCH)
        setChecking(batch[0]?.title ?? null)
        try {
          const { proposals } = await suggest({
            bookUuids: batch.map((b) => b.uuid),
          }).unwrap()
          const found: Row[] = []
          for (const proposal of proposals) {
            const book = byUuid.get(proposal.bookUuid)
            if (!book) continue
            const applicable = applicableChoice(proposal)
            if (Object.keys(applicable).length) {
              found.push({
                book,
                proposal,
                change: applicable,
                checked: true,
                kind: "ready",
              })
            } else if (Object.keys(proposal.choice).length) {
              // A below-confidence match is a lead, not a write: list it
              // unchecked with what it matched, so a person can endorse it.
              found.push({
                book,
                proposal,
                change: proposal.choice,
                checked: false,
                kind: "review",
              })
            }
          }
          // Show the fixes the moment the batch returns, so the list grows live.
          if (found.length && !stopped()) setRows((prev) => [...prev, ...found])
        } catch {
          // A failed batch just contributes no suggestions; keep going.
        }
        if (!stopped()) setScanned(Math.min(i + SCAN_BATCH, books.length))
      }
      if (!stopped()) {
        setChecking(null)
        setPhase("review")
      }
    }

    void scan()
    return () => {
      run.cancelled = true
    }
  }, [open, books, suggest])

  const checkedRows = rows.filter((r) => r.checked)
  const readyRows = rows.filter((r) => r.kind === "ready")
  const reviewRows = rows.filter((r) => r.kind === "review")
  const nothingCount = Math.max(0, scanned - rows.length)

  const toggleRow = (uuid: AuditBook["uuid"], checked: boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.book.uuid === uuid ? { ...r, checked } : r)),
    )
  }

  async function onApply() {
    setPhase("applying")
    setApplied(0)
    const targets = rows.filter((r) => r.checked)
    let done = 0
    let failures = 0
    for (let i = 0; i < targets.length; i += APPLY_BATCH) {
      const chunk = targets.slice(i, i + APPLY_BATCH)
      try {
        const result = await applyRepairs({
          repairs: chunk.map((r) => ({ bookUuid: r.book.uuid, ...r.change })),
        }).unwrap()
        done += result.applied
        failures += result.failed
        const fixed = new Set(chunk.map((r) => r.book.uuid))
        // Mark the chunk fixed so each one turns green as it lands.
        setRows((prev) =>
          prev.map((r) =>
            fixed.has(r.book.uuid) ? { ...r, applied: true } : r,
          ),
        )
        setApplied(done)
      } catch {
        failures += chunk.length
      }
    }
    setPhase("done")
    if (failures > 0) {
      toast.warning(t("autoRepair.someFailed", { failed: failures }))
    } else {
      toast.success(t("autoRepair.done", { applied: done }))
    }
  }

  const total = books.length
  const scanPct = total ? Math.round((scanned / total) * 100) : 0
  const applyPct = checkedRows.length
    ? Math.round((applied / checkedRows.length) * 100)
    : 0

  const rowItem = (row: Row) => (
    <li
      key={row.book.uuid}
      className={`flex items-start gap-3 py-2 ${row.applied ? "opacity-60" : ""}`}
    >
      {phase === "review" ? (
        <Checkbox
          checked={row.checked}
          onCheckedChange={(checked) => {
            toggleRow(row.book.uuid, checked)
          }}
          className="mt-1"
        />
      ) : (
        <span className="mt-1 w-4 text-center text-xs">
          {row.applied ? "OK" : ""}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{row.book.title}</span>
          {row.kind === "review" ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {t("autoRepair.reviewBadge")}
            </Badge>
          ) : null}
          {row.book.issues.map((issue) => (
            <Badge
              key={issue}
              variant="outline"
              className="shrink-0 text-[10px]"
            >
              {t(`issues.${issue}`)}
            </Badge>
          ))}
        </div>
        {row.kind === "review" && row.proposal.best ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t("autoRepair.matchedAs", {
              title: row.proposal.best.title,
              authors: row.proposal.best.authors.join(", "),
            })}
          </p>
        ) : null}
        <ul className="mt-1 flex flex-col gap-0.5">
          {changeParts(row).map((part, i) => (
            <li key={i} className="text-muted-foreground text-xs">
              <span className="text-foreground">{part.label}</span>
              {part.detail ? (
                <span className="italic"> - {part.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </li>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("autoRepair.title")}</DialogTitle>
          <DialogDescription>{t("autoRepair.description")}</DialogDescription>
        </DialogHeader>

        {/* Live status line + progress bar, always visible so there is motion. */}
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            {phase === "scanning" || phase === "applying" ? <Spinner /> : null}
            <span>
              {phase === "scanning"
                ? t("autoRepair.scanningLive", {
                    scanned,
                    total,
                    found: rows.length,
                  })
                : phase === "applying"
                  ? t("autoRepair.applyingLive", {
                      applied,
                      total: checkedRows.length,
                    })
                  : phase === "done"
                    ? t("autoRepair.appliedSummary", { applied })
                    : t("autoRepair.readyLive", { found: rows.length })}
            </span>
          </div>
          {phase === "scanning" && checking ? (
            <div className="text-muted-foreground truncate text-xs">
              {t("autoRepair.checking", { title: checking })}
            </div>
          ) : null}
          {phase === "scanning" || phase === "review" ? (
            <div className="text-muted-foreground text-xs">
              {t("autoRepair.tally", {
                ready: readyRows.length,
                review: reviewRows.length,
                none: nothingCount,
              })}
            </div>
          ) : null}
          <div className="bg-muted h-2 w-full overflow-hidden rounded">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{
                width: `${phase === "applying" || phase === "done" ? applyPct : scanPct}%`,
              }}
            />
          </div>
        </div>

        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-sm">
              {phase === "scanning"
                ? t("autoRepair.scanningHint")
                : t("autoRepair.noConfident")}
            </p>
          ) : (
            <div className="flex flex-col">
              <ul className="flex flex-col divide-y">
                {readyRows.map((row) => rowItem(row))}
              </ul>
              {reviewRows.length > 0 ? (
                <p className="mt-3 mb-1 text-xs font-medium">
                  {t("autoRepair.reviewHeading")}
                </p>
              ) : null}
              <ul className="flex flex-col divide-y">
                {reviewRows.map((row) => rowItem(row))}
              </ul>
            </div>
          )}
        </div>

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
                disabled={checkedRows.length === 0}
              >
                {t("autoRepair.apply", { count: checkedRows.length })}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
              }}
              disabled={phase === "applying"}
            >
              {phase === "done" ? t("autoRepair.close") : t("repair.cancel")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
