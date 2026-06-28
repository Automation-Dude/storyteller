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
import { Badge } from "@/app/(v3)/v3/_/components/ui/badge"
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
  poor: "bg-poor-bg text-poor dark:bg-poor-950/40 dark:text-poor-300",
  moderate:
    "bg-moderate-bg text-moderate dark:bg-moderate-950/40 dark:text-moderate-300",
  info: "bg-highlight-bg text-highlight dark:bg-highlight-950/40 dark:text-highlight-300",
}

function FlagBadge({
  tone = "info",
  className,
  children,
}: {
  tone?: FlagTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <Badge
      className={cn(
        // "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </Badge>
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
          <div className="flex flex-col gap-7 p-4">
            <Masthead view={data} />
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
  "A+": "from-positive-bg/70 dark:from-positive/500/20",
  A: "from-positive-bg/70 dark:from-positive/500/20",
  "A-": "from-positive-bg/70 dark:from-positive/500/20",
  B: "from-good-bg/70 dark:from-good/500/20",
  "B-": "from-good-bg/70 dark:from-good/500/20",
  C: "from-moderate-bg/70 dark:from-moderate/500/20",
  D: "from-poor-bg/70 dark:from-poor/500/20",
  F: "from-poor-bg/70 dark:from-poor/500/20",
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
    <header className={cn("relative px-4 py-3")}>
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
          <div className="flex flex-col">
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
        </div>
      </div>
    </header>
  )
}

type GradeTone = "positive" | "good" | "moderate" | "poor"

function gradeTone(grade: string): GradeTone {
  if (grade.startsWith("A")) return "positive"
  if (grade.startsWith("B")) return "good"
  if (grade === "C") return "moderate"
  return "poor"
}

const TILE_TONE: Record<GradeTone, string> = {
  positive:
    "border-positive-border bg-positive-bg text-positive dark:border-positive-900 dark:bg-positive-950/40 dark:text-positive-300",
  good: "border-good-border bg-good-bg text-good dark:border-good-900 dark:bg-good-950/40 dark:text-good-300",
  moderate:
    "border-moderate-border bg-moderate-bg text-moderate dark:border-moderate-900 dark:bg-moderate-950/40 dark:text-moderate-300",
  poor: "border-poor-border bg-poor-bg text-poor dark:border-poor-900 dark:bg-poor-950/40 dark:text-poor-300",
}

const TILE_GLOW: Record<GradeTone, string> = {
  positive: "from-positive-bg/70 dark:from-positive-500/10",
  good: "from-good-bg/70 dark:from-good-500/10",
  moderate: "from-moderate-bg/70 dark:from-moderate-500/10",
  poor: "from-poor-bg/70 dark:from-poor-500/10",
}

const MARK_TONE = {
  positive: "text-positive dark:text-positive-400",
  good: "text-good dark:text-good-400",
  moderate: "text-moderate dark:text-moderate-400",
  poor: "text-poor dark:text-poor-400",
  muted: "text-foreground",
} as const

type MarkTone = keyof typeof MARK_TONE

// a one-border verdict + supporting sentence, derived from the summary so the card
// reads like a little report rather than a wall of numbers.
function verdictFor(view: BookAlignmentReportView): {
  lead: string
  em: string
  body: string
} {
  const { summary } = view
  const g = summary.grade
  const lead =
    g === "A+" || g === "A"
      ? "Excellent alignment"
      : g === "A-"
        ? "Strong alignment"
        : g.startsWith("B")
          ? "Good alignment"
          : g === "C"
            ? "Rough alignment"
            : g === "D"
              ? "Patchy alignment"
              : "Alignment struggled"
  const em =
    g === "A+"
      ? "nearly every sentence matched"
      : g === "A"
        ? "almost everything lined up"
        : g === "A-"
          ? "with only a handful of gaps"
          : g.startsWith("B")
            ? "with a few rough patches"
            : g === "C"
              ? "noticeable gaps remain"
              : g === "D"
                ? "large stretches drifted"
                : "much of the book did not match"

  const parts: string[] = []
  parts.push(
    summary.score != null
      ? `${summary.score}% of the ebook aligned to the narration across ${summary.chapters} chapters.`
      : `Across ${summary.chapters} chapters, no sentence-level alignment was recorded.`,
  )
  parts.push(
    summary.unalignedAudio === 0
      ? "All audio was placed."
      : `${summary.unalignedAudio} audio ${summary.unalignedAudio === 1 ? "file" : "files"} could not be placed.`,
  )
  if (summary.missingSentences > 0) {
    parts.push(
      summary.missingSentences <= 12
        ? "The few gaps are scattered single sentences, not whole sections."
        : `${summary.missingSentences} sentences went unmatched.`,
    )
  }
  return { lead, em, body: parts.join(" ") }
}

function Masthead({ view }: { view: BookAlignmentReportView }) {
  const { summary } = view
  const tone = gradeTone(summary.grade)
  const verdict = verdictFor(view)
  const audioPct =
    view.totalAudioDuration > 0
      ? Math.round((view.alignedAudioDuration / view.totalAudioDuration) * 100)
      : null

  const marks: {
    label: string
    value: string
    sub?: string
    tone: MarkTone
  }[] = [
    {
      label: "Score",
      value: summary.score != null ? `${summary.score}%` : "—",
      tone:
        summary.score == null
          ? "muted"
          : summary.score >= 97
            ? "good"
            : summary.score >= 90
              ? "moderate"
              : "poor",
    },
    {
      label: "Audio aligned",
      value: audioPct != null ? `${audioPct}%` : "—",
      sub: `${fmtClock(view.alignedAudioDuration)} / ${fmtClock(view.totalAudioDuration)}`,
      tone:
        audioPct == null
          ? "muted"
          : audioPct >= 99
            ? "good"
            : audioPct >= 95
              ? "moderate"
              : "poor",
    },
    { label: "Chapters", value: `${summary.chapters}`, tone: "muted" },
    {
      label: "Missing sentences",
      value: `${summary.missingSentences}`,
      tone: summary.missingSentences === 0 ? "good" : "moderate",
    },
    {
      label: "Failed chapters",
      value: `${summary.failedChapters}`,
      tone: summary.failedChapters === 0 ? "muted" : "poor",
    },
    {
      label: "Unaligned audio",
      value: `${summary.unalignedAudio}`,
      tone: summary.unalignedAudio === 0 ? "muted" : "moderate",
    },
  ]

  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div
        className={cn(
          "relative flex flex-wrap items-center gap-6 bg-gradient-to-br to-transparent p-6",
          TILE_GLOW[tone],
        )}
      >
        <div
          className={cn(
            "flex size-28 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border",
            TILE_TONE[tone],
          )}
        >
          <span className="font-serif text-5xl leading-none font-medium">
            {summary.grade}
          </span>
          <span className="font-mono text-xs opacity-80">
            {summary.score != null ? `${summary.score}%` : "—"}
          </span>
        </div>
        <div className="min-w-[16rem] flex-1">
          <h2 className="font-serif text-2xl leading-tight font-normal">
            {verdict.lead}
            {/* <em className="text-primary italic">{verdict.em}</em>. */}
          </h2>
          <p className="text-muted-foreground mt-1.5 max-w-prose text-sm leading-relaxed">
            {verdict.body}
          </p>
          <p className="text-muted-foreground/80 mt-2.5 font-mono text-[11px]">
            Last graded {new Date(view.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="bg-border grid grid-cols-3 gap-px border-t @xl/book:grid-cols-6">
        {marks.map((m) => (
          <div key={m.label} className="bg-card p-3.5">
            <div
              className={cn(
                "font-serif text-xl leading-none font-medium tabular-nums",
                MARK_TONE[m.tone],
              )}
            >
              {m.value}
            </div>
            <div className="text-muted-foreground mt-1.5 text-[10px] tracking-wide uppercase">
              {m.label}
            </div>
            {m.sub && (
              <div className="text-muted-foreground/80 mt-0.5 font-mono text-[10px] tabular-nums">
                {m.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
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
        <span className="font-serif font-medium">{row.original.label}</span>
        {row.original.title && (
          <span className="text-muted-foreground truncate font-mono text-[10px]">
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
      if (files.length === 0) return <FlagBadge tone="poor">no audio</FlagBadge>
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
          <FlagBadge key={f.label} tone={f.tone}>
            {f.label}
          </FlagBadge>
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
        ? "bg-positive/80"
        : pct >= 90
          ? "bg-good/80"
          : "bg-poor/80"
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
              row.deltaPct > 0.05 ? "text-poor" : "text-moderate",
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
        <h2 className="font-serif text-lg font-normal">
          Chapters{" "}
          <span className="text-muted-foreground font-mono text-xs">
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

      <div className="overflow-x-auto rounded-lg">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
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
                        "border-l-2 border-l-amber-400/80",
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
                      <td colSpan={columns.length} className="py-2">
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

function ChapterDetail({ row }: { row: ReportChapterRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MatchCard
        label="First match"
        ebook={row.firstMatchedSentenceContext}
        transcript={row.transcriptionContext}
      />
      <MatchCard
        label="Last match"
        ebook={row.lastMatchedSentenceContext}
        transcript={row.endTranscriptionContext}
      />
    </div>
  )
}

function MatchCard({
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
    <div className="bg-card overflow-hidden border">
      <div className="text-muted-foreground bg-muted/40 flex items-center gap-1.5 border-b px-3 py-2 text-[10px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className="px-3 py-2.5">
        <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-medium tracking-wider uppercase">
          <IconBook2 className="size-3" /> Ebook
        </span>
        <p className="mt-1 font-serif text-sm leading-relaxed">
          {ebook.prevSentence && (
            <span className="text-muted-foreground/60">
              {ebook.prevSentence}{" "}
            </span>
          )}
          {ebookNodes}
          {ebook.nextSentence && (
            <span className="text-muted-foreground/60">
              {" "}
              {ebook.nextSentence}
            </span>
          )}
        </p>
      </div>
      <div className="border-t border-dashed px-3 py-2.5">
        <span className="text-muted-foreground flex items-center gap-1 text-[9px] font-medium tracking-wider uppercase">
          <IconHeadphones className="size-3" /> Transcript
        </span>
        <p className="text-muted-foreground mt-1 font-mono text-[11px] leading-relaxed">
          {otherNodes}
        </p>
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

const HL =
  "box-decoration-clone bg-highlight-bg/70 px-0.5 border-b border-highlight text-foreground dark:bg-highlight/25"

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
  "not-found": "poor",
  "too-short": "moderate",
  "is-nav": "info",
  "no-text": "info",
}

function UnalignedChapters({ view }: { view: BookAlignmentReportView }) {
  if (view.unalignedChapters.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-lg font-normal">
        Unaligned chapters{" "}
        <span className="text-muted-foreground font-mono text-xs">
          ({view.unalignedChapters.length})
        </span>
      </h2>
      <div className="overflow-hidden border">
        <table className="w-full text-sm">
          <tbody>
            {view.unalignedChapters.map((uc, i) => (
              <tr key={i} className="border-t first:border-t-0">
                <td className="px-2.5 py-1.5 text-xs">{uc.label}</td>
                <td className="w-0 px-2.5 py-1.5">
                  <FlagBadge tone={REASON_TONE[uc.reason] ?? "info"}>
                    {uc.reason}
                  </FlagBadge>
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
      <h2 className="flex items-center gap-1.5 font-serif text-lg font-normal text-amber-700 dark:text-amber-400">
        <IconHeadphones className="size-4" />
        Unaligned audio{" "}
        <span className="text-muted-foreground font-mono text-xs">
          ({view.unalignedAudioFiles.length})
        </span>
      </h2>
      <div className="divide-y divide-amber-200/70 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40 dark:divide-amber-900/40 dark:border-amber-900/50 dark:bg-amber-950/20">
        {view.unalignedAudioFiles.map((uaf, i) => (
          <div key={i} className="flex flex-col gap-1 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs font-medium">
                {uaf.title ?? shortHref(uaf.filepath)}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-amber-700 tabular-nums dark:text-amber-400">
                {fmtClock(uaf.duration)}
              </span>
            </div>
            {uaf.transcription ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                <span className="font-medium text-amber-700 dark:text-amber-400">
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
      <p className="text-muted-foreground flex items-center gap-1.5 font-serif text-xs italic">
        <IconSparkles className="size-3.5 shrink-0" />
        These are usually the publisher&apos;s intro and end credits, not
        anything missing from the book.
      </p>
    </section>
  )
}
