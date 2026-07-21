"use client"

import { IconRefresh, IconWand } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  type AuditBook,
  type AuditIssue,
  type LibraryAudit as AuditData,
} from "@/database/auditLibrary"
import {
  useGetLibraryAuditQuery,
  useRescanLibraryAuditMutation,
} from "@/store/api"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v3/_/components/ui/card"
import { Skeleton } from "@v3/_/components/ui/skeleton"

import { AutoRepairDialog } from "./auto-repair-dialog"
import { RepairDialog } from "./repair-dialog"

/**
 * The issues in the order they are shown, with how loud each one should look.
 * A missing or blank cover and a filename title are the ones that make a shelf
 * look broken, so they are "destructive"; a missing language or description is
 * real but quieter.
 */
const ISSUE_ORDER: {
  issue: AuditIssue
  variant: "destructive" | "secondary" | "outline"
}[] = [
  { issue: "NO-COVER", variant: "destructive" },
  { issue: "BLANK-COVER", variant: "destructive" },
  { issue: "TINY-COVER", variant: "outline" },
  { issue: "BAD-TITLE", variant: "destructive" },
  { issue: "NO-AUTHOR", variant: "destructive" },
  { issue: "BAD-AUTHOR", variant: "secondary" },
  { issue: "NO-LANG", variant: "secondary" },
  { issue: "NO-DESC", variant: "secondary" },
  { issue: "NO-SERIES", variant: "secondary" },
]

const VARIANT_OF = new Map(ISSUE_ORDER.map((i) => [i.issue, i.variant]))

/** "5 minutes ago" style stamp so a finished rescan is visibly fresh. */
function relativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)} minute(s) ago`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} hour(s) ago`
  return `${Math.round(hours / 24)} day(s) ago`
}

export function LibraryAudit() {
  const t = useTranslations("LibraryAuditPage")
  const [pollInterval, setPollInterval] = useState(2000)
  const { data, isError } = useGetLibraryAuditQuery(undefined, {
    pollingInterval: pollInterval,
  })
  const [rescan] = useRescanLibraryAuditMutation()

  const [repairing, setRepairing] = useState<AuditBook | null>(null)
  const [autoRepairOpen, setAutoRepairOpen] = useState(false)

  const ready = data?.status === "ready"
  const computing = !ready
  const [rescanning, setRescanning] = useState(false)

  // Poll only while the background pass is running; stop once it is ready.
  useEffect(() => {
    setPollInterval(data && data.status !== "ready" ? 2000 : 0)
  }, [data])

  // When a rescan we started finishes, announce the result once.
  useEffect(() => {
    if (rescanning && ready) {
      setRescanning(false)
      toast.success(t("rescanDone", { flagged: data.flagged }))
    }
  }, [rescanning, ready, data, t])

  const onRescan = () => {
    setRescanning(true)
    toast.info(t("rescanStarted"))
    void rescan()
  }

  const label = (issue: AuditIssue) => t(`issues.${issue}`)

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("heading")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("subheading")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {ready && data.books.length > 0 ? (
            <Button
              size="sm"
              onClick={() => {
                setAutoRepairOpen(true)
              }}
            >
              <IconWand />
              {t("autoRepair.button")}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={onRescan}
            disabled={computing}
          >
            <IconRefresh className={computing ? "animate-spin" : undefined} />
            {computing ? t("rescanning") : t("rescan")}
          </Button>
        </div>
      </div>
      {computing && data && data.total > 0 ? (
        <div className="border-primary/30 bg-primary/5 text-primary -mt-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <IconRefresh className="animate-spin" size={16} />
          {t("scanningBanner")}
        </div>
      ) : ready && data.computedAt ? (
        <p className="text-muted-foreground -mt-4 text-xs">
          {t("lastScanned", { when: relativeTime(data.computedAt) })}
        </p>
      ) : null}

      {isError ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("errorTitle")}</CardTitle>
            <CardDescription>{t("errorBody")}</CardDescription>
          </CardHeader>
        </Card>
      ) : !data || (computing && data.total === 0) ? (
        <ScanningState message={t("scanning")} />
      ) : (
        <>
          <SummaryCards data={data} label={label} />
          {data.books.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("allClearTitle")}</CardTitle>
                <CardDescription>{t("allClearBody")}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <FlaggedTable
              data={data}
              label={label}
              t={t}
              onRepair={setRepairing}
            />
          )}
        </>
      )}

      {repairing ? (
        <RepairDialog
          book={repairing}
          open={true}
          onOpenChange={(open) => {
            if (!open) setRepairing(null)
          }}
        />
      ) : null}

      {data ? (
        <AutoRepairDialog
          books={data.books}
          open={autoRepairOpen}
          onOpenChange={setAutoRepairOpen}
        />
      ) : null}
    </div>
  )
}

function ScanningState({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{message}</p>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}

function SummaryCards({
  data,
  label,
}: {
  data: AuditData
  label: (issue: AuditIssue) => string
}) {
  const t = useTranslations("LibraryAuditPage")
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Card className="bg-muted/40">
        <CardHeader className="gap-1 py-4">
          <CardDescription>{t("flaggedLabel")}</CardDescription>
          <CardTitle className="text-2xl">
            {data.flagged}
            <span className="text-muted-foreground ml-1 text-base font-normal">
              / {data.total}
            </span>
          </CardTitle>
        </CardHeader>
      </Card>
      {ISSUE_ORDER.filter(({ issue }) => data.counts[issue] > 0).map(
        ({ issue }) => (
          <Card key={issue}>
            <CardHeader className="gap-1 py-4">
              <CardDescription>{label(issue)}</CardDescription>
              <CardTitle className="text-2xl">{data.counts[issue]}</CardTitle>
            </CardHeader>
          </Card>
        ),
      )}
    </div>
  )
}

function FlaggedTable({
  data,
  label,
  t,
  onRepair,
}: {
  data: AuditData
  label: (issue: AuditIssue) => string
  t: ReturnType<typeof useTranslations>
  onRepair: (book: AuditBook) => void
}) {
  // Sort the most-broken books to the top: they are the ones worth fixing first.
  const books = data.books
    .slice()
    .sort((a, b) => b.issues.length - a.issues.length)

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="px-4 py-3 font-medium">{t("colTitle")}</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  {t("colAuthor")}
                </th>
                <th className="px-4 py-3 font-medium">{t("colIssues")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr
                  key={book.uuid}
                  className="hover:bg-muted/40 border-b last:border-0"
                >
                  <td className="max-w-[24rem] px-4 py-3">
                    <span className="line-clamp-2 font-medium">
                      {book.title}
                    </span>
                  </td>
                  <td className="text-muted-foreground hidden px-4 py-3 sm:table-cell">
                    {book.authors.length ? (
                      book.authors.join(", ")
                    ) : (
                      <span className="italic">{t("noAuthorCell")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {book.issues.map((issue) => (
                        <Badge
                          key={issue}
                          variant={VARIANT_OF.get(issue) ?? "secondary"}
                        >
                          {label(issue)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onRepair(book)
                      }}
                    >
                      {t("repair.action")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
