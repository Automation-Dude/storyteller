"use client"

import {
  IconArrowLeft,
  IconArrowsSort,
  IconBook2,
  IconBriefcase,
  IconChevronRight,
  IconExternalLink,
  IconHeadphones,
  IconSortAscending,
  IconSortDescending,
  IconSparkles,
  IconX,
} from "@tabler/icons-react"
import {
  type ColumnDef,
  type ExpandedState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Fragment, useMemo, useState } from "react"

import { GradePill } from "@v3/_/components/books/grade-pill"
import { Button } from "@v3/_/components/ui/button"
import { ScrollArea } from "@v3/_/components/ui/scroll-area"
import { Switch } from "@v3/_/components/ui/switch"
import { V3Link } from "@v3/_/components/v3-link"
import { cn } from "@v3/_/lib/utils"

import {
  type BookAlignmentReportView,
  type FlagTone,
  type ReportChapterRow,
} from "@/alignmentReportView"
import { useGetBookAlignmentReportQuery } from "@/store/api"
import { type UUID } from "@/uuid"

// seconds -> H:MM:SS / M:SS.
function fmtClock(seconds: number | null): string {
  if (seconds == null) return "—"
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

const TONE_BADGE: Record<FlagTone, string> = {
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
}

function Badge({
  tone = "info",
  className,
  children,
}: {
  tone?: FlagTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function AlignmentReportContent({
  uuid,
  compact = false,
  onClose,
  onBack,
  // when embedded under a book detail hero we drop our own header chrome; the
  // hero already names the book and the panel header owns close.
  embedded = false,
}: {
  uuid: UUID
  compact?: boolean
  onClose?: () => void
  onBack?: () => void
  embedded?: boolean
}) {
  const { data, isLoading, isError } = useGetBookAlignmentReportQuery({ uuid })

  return (
    <div className="flex h-full flex-col">
      {data ? (
        <ReportHeader
          view={data}
          compact={compact}
          onClose={onClose}
          onBack={onBack}
          embedded={embedded}
        />
      ) : (
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-1">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Back"
                onClick={onBack}
              >
                <IconArrowLeft className="size-4" />
              </Button>
            )}
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Alignment report
            </span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Close"
              onClick={onClose}
            >
              <IconX className="size-4" />
            </Button>
          )}
        </header>
      )}

      {isLoading && (
        <p className="text-muted-foreground p-4 text-sm">Loading report…</p>
      )}
      {isError && (
        <p className="text-muted-foreground p-4 text-sm">
          No alignment report is available for this book.
        </p>
      )}

      {data && (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-4">
            <StatStrip view={data} />
            <ChapterTable chapters={data.chapters} />
            <UnalignedChapters view={data} />
            <UnalignedAudio view={data} />
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

// soft gradient tinted by grade, so the whole thing feels alive rather than grey.
const GRADE_GLOW: Record<string, string> = {
  "A+": "from-emerald-200/70 dark:from-emerald-500/20",
  A: "from-emerald-200/70 dark:from-emerald-500/20",
  "A-": "from-cyan-200/70 dark:from-cyan-500/20",
  B: "from-sky-200/70 dark:from-sky-500/20",
  "B-": "from-blue-200/70 dark:from-blue-500/20",
  C: "from-yellow-200/70 dark:from-yellow-500/20",
  D: "from-orange-200/70 dark:from-orange-500/20",
  F: "from-red-200/70 dark:from-red-500/20",
}

function ReportHeader({
  view,
  compact,
  onClose,
  onBack,
  embedded,
}: {
  view: BookAlignmentReportView
  compact: boolean
  onClose?: () => void
  onBack?: () => void
  embedded?: boolean
}) {
  return (
    <header
      className={cn(
        "relative bg-gradient-to-br to-transparent px-4 py-3",
        !embedded && "border-b",
        GRADE_GLOW[view.summary.grade] ?? "from-muted",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="Back to details"
              onClick={onBack}
            >
              <IconArrowLeft className="size-4" />
            </Button>
          )}
          <GradePill
            grade={view.summary.grade}
            className="px-2.5 py-1 text-sm"
          />
          <div className="flex flex-col">
            <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase">
              <IconSparkles className="size-3" /> Alignment report
            </span>
            {!embedded && (
              <h1
                className={cn(
                  "font-serif font-medium",
                  compact ? "text-base" : "text-xl",
                )}
              >
                {view.bookTitle ?? "Untitled"}
              </h1>
            )}
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Close"
            onClick={onClose}
          >
            <IconX className="size-4" />
          </Button>
        )}
      </div>

      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <V3Link
          href={`/books/${view.bookUuid}/alignment`}
          className="hover:text-primary inline-flex items-center gap-1 hover:underline"
        >
          <IconExternalLink className="size-3.5" /> Open full page
        </V3Link>
        {!embedded && (
          <V3Link
            href={`/books/${view.bookUuid}`}
            className="hover:text-primary inline-flex items-center gap-1 hover:underline"
          >
            <IconBook2 className="size-3.5" /> Book
          </V3Link>
        )}
        {view.jobUuid && (
          <V3Link
            href="/settings?tab=queue"
            className="hover:text-primary inline-flex items-center gap-1 hover:underline"
          >
            <IconBriefcase className="size-3.5" /> Created by a job
          </V3Link>
        )}
        <span>{new Date(view.createdAt).toLocaleDateString()}</span>
      </div>
    </header>
  )
}

function StatStrip({ view }: { view: BookAlignmentReportView }) {
  const { summary } = view
  const audioPct =
    view.totalAudioDuration > 0
      ? Math.round((view.alignedAudioDuration / view.totalAudioDuration) * 100)
      : null

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat
        label="Score"
        value={summary.score != null ? `${summary.score}%` : "—"}
        tone={
          summary.score == null
            ? "muted"
            : summary.score >= 97
              ? "good"
              : summary.score >= 90
                ? "warn"
                : "bad"
        }
      />
      <Stat
        label="Audio aligned"
        value={audioPct != null ? `${audioPct}%` : "—"}
        sub={`${fmtClock(view.alignedAudioDuration)} / ${fmtClock(view.totalAudioDuration)}`}
        tone={
          audioPct == null
            ? "muted"
            : audioPct >= 99
              ? "good"
              : audioPct >= 95
                ? "warn"
                : "bad"
        }
      />
      <Stat
        label="Missing sentences"
        value={`${summary.missingSentences}`}
        tone={summary.missingSentences === 0 ? "good" : "warn"}
      />
      <Stat
        label="Muted chapters"
        value={`${summary.mutedChapters}`}
        tone={summary.mutedChapters === 0 ? "muted" : "warn"}
      />
      <Stat
        label="Unaligned audio"
        value={`${summary.unalignedAudio}`}
        tone={summary.unalignedAudio === 0 ? "muted" : "bad"}
      />
      <Stat label="Chapters" value={`${summary.chapters}`} tone="muted" />
      <Stat
        label="Failed chapters"
        value={`${summary.failedChapters}`}
        tone={summary.failedChapters === 0 ? "muted" : "bad"}
      />
    </div>
  )
}

const STAT_TONE = {
  good: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  warn: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  bad: "bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  muted: "bg-muted/60 text-foreground",
} as const

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone: keyof typeof STAT_TONE
}) {
  return (
    <div
      className={cn("flex flex-col gap-0.5 rounded-lg p-2.5", STAT_TONE[tone])}
    >
      <span className="text-lg leading-none font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-xs opacity-70">{label}</span>
      {sub && (
        <span className="text-[10px] tabular-nums opacity-60">{sub}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// chapter table
// ---------------------------------------------------------------------------

function shortHref(href: string): string {
  return (href.split("/").pop() ?? href).replace(/\.[^.]+$/, "")
}

const columns: ColumnDef<ReportChapterRow>[] = [
  {
    id: "expander",
    enableSorting: false,
    header: () => null,
    cell: ({ row }) => (
      <IconChevronRight
        className={cn(
          "text-muted-foreground size-4 transition-transform",
          row.getIsExpanded() && "rotate-90",
        )}
      />
    ),
  },
  {
    id: "chapter",
    header: "Chapter",
    accessorFn: (r) => r.label,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.label}</span>
        {row.original.title && (
          <span className="text-muted-foreground truncate text-[10px]">
            {shortHref(row.original.href)}
          </span>
        )}
      </div>
    ),
  },
  {
    id: "audio",
    enableSorting: false,
    header: "Audio",
    cell: ({ row }) => {
      const files = row.original.audioFiles
      if (files.length === 0) return <Badge tone="error">no audio</Badge>
      return (
        <span className="text-muted-foreground truncate text-xs">
          {files.map((f) => f.title ?? shortHref(f.filepath)).join(", ")}
        </span>
      )
    },
  },
  {
    id: "duration",
    header: "Dur.",
    accessorFn: (r) => r.audioFiles.reduce((s, f) => s + (f.duration ?? 0), 0),
    cell: ({ getValue }) => {
      const total = getValue<number>()
      return (
        <span className="text-muted-foreground tabular-nums">
          {total > 0 ? fmtClock(total) : "—"}
        </span>
      )
    },
  },
  {
    id: "sentences",
    header: "Sentences",
    // sort by share of unmatched sentences (the user's "delta in percentage").
    accessorFn: (r) => r.deltaPct,
    cell: ({ row }) => <SentenceCell row={row.original} />,
  },
  {
    id: "notes",
    enableSorting: false,
    header: "Notes",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.flags.map((f) => (
          <Badge key={f.label} tone={f.tone}>
            {f.label}
          </Badge>
        ))}
      </div>
    ),
  },
]

function SentenceCell({ row }: { row: ReportChapterRow }) {
  const { alignedSentenceCount: al, chapterSentenceCount: total, delta } = row
  const pct = row.coverage != null ? Math.round(row.coverage * 100) : null
  const barTone =
    pct == null
      ? "bg-muted-foreground/40"
      : pct >= 97
        ? "bg-emerald-500"
        : pct >= 90
          ? "bg-amber-500"
          : "bg-red-500"
  return (
    <div className="flex min-w-[7rem] flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="tabular-nums">
          {al}/{total}
        </span>
        {delta > 0 && (
          <span
            className={cn(
              "text-[10px] tabular-nums",
              row.deltaPct > 0.05 ? "text-red-600" : "text-amber-600",
            )}
          >
            −{delta}
          </span>
        )}
      </div>
      <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full", barTone)}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  )
}

function ChapterTable({ chapters }: { chapters: ReportChapterRow[] }) {
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [flaggedOnly, setFlaggedOnly] = useState(
    () => chapters.some((c) => c.flagged), // default to flagged when any exist
  )

  const flaggedCount = chapters.filter((c) => c.flagged).length
  const data = useMemo(
    () => (flaggedOnly ? chapters.filter((c) => c.flagged) : chapters),
    [chapters, flaggedOnly],
  )

  const table = useReactTable({
    data,
    columns,
    state: { expanded, sorting },
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          Chapters{" "}
          <span className="text-muted-foreground font-normal">
            ({data.length}
            {flaggedOnly && flaggedCount !== chapters.length
              ? ` of ${chapters.length}`
              : ""}
            )
          </span>
        </h2>
        {flaggedCount > 0 && (
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
            Flagged only
            <Switch checked={flaggedOnly} onCheckedChange={setFlaggedOnly} />
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort()
                  const dir = h.column.getIsSorted()
                  return (
                    <th
                      key={h.id}
                      className={cn(
                        "px-2 py-1.5 text-left text-xs font-medium",
                        sortable && "hover:text-foreground cursor-pointer",
                      )}
                      onClick={
                        sortable
                          ? h.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {h.isPlaceholder
                          ? null
                          : flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                        {sortable &&
                          (dir === "asc" ? (
                            <IconSortAscending className="size-3" />
                          ) : dir === "desc" ? (
                            <IconSortDescending className="size-3" />
                          ) : (
                            <IconArrowsSort className="size-3 opacity-40" />
                          ))}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isExpanded =
                typeof expanded === "boolean" || expanded[row.id]
              return (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "hover:bg-muted/40 cursor-pointer border-t",
                      row.original.flagged &&
                        "bg-amber-50/40 dark:bg-amber-950/10",
                    )}
                    onClick={row.getToggleExpandedHandler()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="max-w-[16rem] truncate px-2 py-1.5 align-top"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr className="bg-muted/20 border-t">
                      <td colSpan={columns.length} className="p-3">
                        <ChapterDetail row={row.original} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// expanded detail: the matched ebook sentence vs the transcription, with the
// overlapping run highlighted in both so "which is which" is obvious.
// ---------------------------------------------------------------------------

function ChapterDetail({ row }: { row: ReportChapterRow }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Boundary
        label="First match"
        ebook={row.firstMatchedSentenceContext}
        transcript={row.transcriptionContext}
      />
      <Boundary
        label="Last match"
        ebook={row.lastMatchedSentenceContext}
        transcript={row.endTranscriptionContext}
      />
    </div>
  )
}

function Boundary({
  label,
  ebook,
  transcript,
}: {
  label: string
  ebook: {
    prevSentence: string | null
    matchedSentence: string
    nextSentence: string | null
  }
  transcript: { before: string; after: string }
}) {
  const transcriptText = `${transcript.before} ${transcript.after}`.trim()
  const { ebookNodes, otherNodes } = highlightOverlap(
    ebook.matchedSentence,
    transcriptText,
  )

  return (
    <div className="bg-muted/40 border-muted-foreground/40 flex flex-col gap-2 border-l-2 px-2.5 py-1.5">
      <div className="">
        <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
          <IconBook2 className="size-3" /> Ebook · {label}
        </span>
        <p className="text-xs leading-relaxed">
          {ebook.prevSentence && (
            <span className="text-muted-foreground/70">
              {ebook.prevSentence}{" "}
            </span>
          )}
          {ebookNodes}
          {ebook.nextSentence && (
            <span className="text-muted-foreground/70">
              {" "}
              {ebook.nextSentence}
            </span>
          )}
        </p>
      </div>
      <div className="">
        <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
          <IconHeadphones className="size-3" /> Transcription
        </span>
        <p className="text-xs leading-relaxed">{otherNodes}</p>
      </div>
    </div>
  )
}

function normToken(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
}

// longest common contiguous run of (normalized) word tokens. cheap, no trigrams;
// good enough to point the eye at the shared span.
function longestCommonRun(
  a: string[],
  b: string[],
): { aStart: number; bStart: number; len: number } {
  const na = a.map(normToken)
  const nb = b.map(normToken)
  let best = { aStart: 0, bStart: 0, len: 0 }
  let prevRow = new Array<number>(nb.length + 1).fill(0)
  for (let i = 1; i <= na.length; i++) {
    const curRow = new Array<number>(nb.length + 1).fill(0)
    for (let j = 1; j <= nb.length; j++) {
      if (na[i - 1] && na[i - 1] === nb[j - 1]) {
        const run = (prevRow[j - 1] ?? 0) + 1
        curRow[j] = run
        if (run > best.len)
          best = { aStart: i - run, bStart: j - run, len: run }
      }
    }
    prevRow = curRow
  }
  return best
}

const HL = "rounded bg-yellow-200/80 px-0.5 dark:bg-yellow-500/30"

function highlightOverlap(
  ebookText: string,
  transcriptText: string,
): { ebookNodes: React.ReactNode; otherNodes: React.ReactNode } {
  const a = ebookText.match(/\S+/g) ?? []
  const b = transcriptText.match(/\S+/g) ?? []
  const run = longestCommonRun(a, b)

  // need a couple of real words to be worth highlighting.
  if (run.len < 2) {
    return { ebookNodes: ebookText, otherNodes: transcriptText }
  }

  const wrap = (
    tokens: string[],
    start: number,
    len: number,
    key: string,
  ): React.ReactNode => {
    const before = tokens.slice(0, start).join(" ")
    const hit = tokens.slice(start, start + len).join(" ")
    const after = tokens.slice(start + len).join(" ")
    return (
      <Fragment key={key}>
        {before && <span>{before} </span>}
        <mark className={HL}>{hit}</mark>
        {after && <span> {after}</span>}
      </Fragment>
    )
  }

  return {
    ebookNodes: wrap(a, run.aStart, run.len, "e"),
    otherNodes: wrap(b, run.bStart, run.len, "t"),
  }
}

// ---------------------------------------------------------------------------
// unaligned sections (proper tables, coloured badges)
// ---------------------------------------------------------------------------

const REASON_TONE: Record<string, FlagTone> = {
  "not-found": "error",
  "too-short": "warn",
  "is-nav": "info",
  "no-text": "info",
}

function UnalignedChapters({ view }: { view: BookAlignmentReportView }) {
  if (view.unalignedChapters.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">
        Unaligned chapters{" "}
        <span className="text-muted-foreground font-normal">
          ({view.unalignedChapters.length})
        </span>
      </h2>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <tbody>
            {view.unalignedChapters.map((uc, i) => (
              <tr key={i} className="border-t first:border-t-0">
                <td className="px-2.5 py-1.5 font-medium">{uc.label}</td>
                <td className="w-0 px-2.5 py-1.5">
                  <Badge tone={REASON_TONE[uc.reason] ?? "info"}>
                    {uc.reason}
                  </Badge>
                </td>
                <td className="text-muted-foreground truncate px-2.5 py-1.5 text-xs italic">
                  {uc.preview ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function UnalignedAudio({ view }: { view: BookAlignmentReportView }) {
  if (view.unalignedAudioFiles.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300">
        <IconHeadphones className="size-4" />
        Unaligned audio{" "}
        <span className="font-normal opacity-70">
          ({view.unalignedAudioFiles.length})
        </span>
      </h2>
      <div className="divide-y overflow-hidden rounded-lg border border-red-200 dark:border-red-900/50">
        {view.unalignedAudioFiles.map((uaf, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 bg-red-50/40 px-2.5 py-2 dark:bg-red-950/20"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {uaf.title ?? shortHref(uaf.filepath)}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {fmtClock(uaf.duration)}
              </span>
            </div>
            {uaf.transcription ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                <span className="text-red-600/80 dark:text-red-400/80">
                  heard:
                </span>{" "}
                {uaf.transcription}
              </p>
            ) : (
              <p className="text-muted-foreground/60 text-xs italic">
                no transcription on file
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
