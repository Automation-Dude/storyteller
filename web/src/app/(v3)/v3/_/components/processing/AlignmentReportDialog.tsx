"use client"

import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/(v3)/v3/_/components/ui/collapsible"
import { useGetJobReportQuery } from "@/store/api"
import { type UUID } from "@/uuid"


// minimal surfacing of a job's alignment report: headline counts plus the raw json.
// a richer report table / analytics view is a later product decision.
export function AlignmentReportDialog({
  jobUuid,
  bookTitle,
  open,
  onOpenChange,
}: {
  jobUuid: UUID
  bookTitle: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading, isError } = useGetJobReportQuery(
    { uuid: jobUuid },
    { skip: !open },
  )
  const [rawOpen, setRawOpen] = useState(false)

  const report = data?.report

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Alignment report</DialogTitle>
          <DialogDescription>
            {bookTitle ?? "Untitled"}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p className="text-muted-foreground text-sm">Loading report...</p>
        )}
        {isError && (
          <p className="text-muted-foreground text-sm">
            No alignment report is available for this job.
          </p>
        )}

        {report && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Aligned chapters" value={report.chapters.length} />
              <Stat
                label="Unaligned chapters"
                value={report.unalignedChapters.length}
              />
              <Stat label="Audio files" value={report.audioFiles.length} />
              <Stat
                label="Unaligned audio files"
                value={report.unalignedAudioFiles.length}
              />
            </div>

            {report.unalignedChapters.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">Unaligned chapters</span>
                <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                  {report.unalignedChapters.map((chapter, i) => (
                    <li key={i} className="truncate">
                      {chapter.href} · {chapter.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
              <CollapsibleTrigger className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline">
                {rawOpen ? "Hide raw json" : "Show raw json"}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="bg-muted mt-2 max-h-72 overflow-auto rounded-md p-3 text-[10px] leading-relaxed">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 flex flex-col gap-0.5 rounded-md p-2.5">
      <span className="text-lg font-medium tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  )
}
