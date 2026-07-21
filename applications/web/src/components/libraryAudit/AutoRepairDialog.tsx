"use client"

import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Progress,
  Stack,
  Text,
} from "@mantine/core"
import { useEffect, useState } from "react"

import { type AuditBook } from "@/database/auditLibrary"
import { applicableChoice } from "@/metadata/proposals"
import { type RepairChoice } from "@/metadata/repair"
import { type RepairProposal } from "@/metadata/resolve"
import { useApplyRepairsMutation, useSuggestRepairsMutation } from "@/store/api"

import { ISSUE_LABELS } from "./LibraryAudit"

// Small enough that fixes start appearing within a second or two, large enough
// that a big library does not make hundreds of round trips.
const SCAN_BATCH = 10
const APPLY_BATCH = 10

type Row = {
  book: AuditBook
  proposal: RepairProposal
  change: RepairChoice
  checked: boolean
  applied?: boolean
}

/** One "field: value" line per thing the repair will change, before to after. */
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
  opened,
  onClose,
}: {
  books: AuditBook[]
  opened: boolean
  onClose: () => void
}) {
  const [suggest] = useSuggestRepairsMutation()
  const [applyRepairs] = useApplyRepairsMutation()

  const [phase, setPhase] = useState<
    "scanning" | "review" | "applying" | "done"
  >("scanning")
  const [scanned, setScanned] = useState(0)
  const [checking, setChecking] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [applied, setApplied] = useState(0)
  const [failed, setFailed] = useState(0)

  useEffect(() => {
    if (!opened) {
      setPhase("scanning")
      setScanned(0)
      setChecking(null)
      setRows([])
      setApplied(0)
      setFailed(0)
      return
    }

    const run = { cancelled: false }
    // Read through a call so control-flow analysis cannot decide the flag is
    // "always false": it is flipped later by the cleanup, during an await.
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
            const change = applicableChoice(proposal)
            if (Object.keys(change).length) {
              found.push({ book, proposal, change, checked: true })
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
  }, [opened, books, suggest])

  const checkedRows = rows.filter((r) => r.checked)

  async function onApply() {
    setPhase("applying")
    setApplied(0)
    setFailed(0)
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
        // Mark the chunk fixed so each one visibly lands as it is written.
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
    setFailed(failures)
    setPhase("done")
  }

  const total = books.length
  const scanPct = total ? Math.round((scanned / total) * 100) : 0
  const applyPct = checkedRows.length
    ? Math.round((applied / checkedRows.length) * 100)
    : 0

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Auto-repair from Open Library"
      size="xl"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Scans every flagged book, keeps only confident matches, and lets you
          review before anything is written. A backup is taken first.
        </Text>

        {/* Live status line + progress bar, always visible so there is motion. */}
        <Stack gap={6}>
          <Group gap="sm" wrap="nowrap">
            {phase === "scanning" || phase === "applying" ? (
              <Loader size="xs" />
            ) : null}
            <Text size="sm" c="dimmed">
              {phase === "scanning"
                ? `Scanning ${scanned} of ${total} books - ${rows.length} fixes found`
                : phase === "applying"
                  ? `Applying fixes: ${applied} of ${checkedRows.length} done`
                  : phase === "done"
                    ? `Applied ${applied} book${applied === 1 ? "" : "s"}.${
                        failed > 0 ? ` ${failed} failed.` : ""
                      }`
                    : `${rows.length} fixes ready to apply`}
            </Text>
          </Group>
          {phase === "scanning" && checking ? (
            <Text size="xs" c="dimmed" truncate>
              Checking: {checking}
            </Text>
          ) : null}
          <Progress
            size="sm"
            value={
              phase === "applying" || phase === "done" ? applyPct : scanPct
            }
          />
        </Stack>

        <Box style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {rows.length === 0 ? (
            <Text size="sm" c="dimmed" py="md">
              {phase === "scanning"
                ? "Looking each flagged book up and gathering fixes..."
                : "No confident matches to apply automatically. Use per-book Repair for the rest."}
            </Text>
          ) : (
            <Stack gap={0}>
              {rows.map((row, index) => (
                <Group
                  key={row.book.uuid}
                  align="flex-start"
                  gap="sm"
                  py="xs"
                  wrap="nowrap"
                  style={{
                    opacity: row.applied ? 0.6 : undefined,
                    borderTop:
                      index === 0
                        ? undefined
                        : "1px solid var(--mantine-color-default-border)",
                  }}
                >
                  {phase === "review" ? (
                    <Checkbox
                      mt={2}
                      checked={row.checked}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked
                        setRows((prev) =>
                          prev.map((r, i) =>
                            i === index ? { ...r, checked } : r,
                          ),
                        )
                      }}
                    />
                  ) : (
                    <Text size="xs" mt={2} w={20} ta="center">
                      {row.applied ? "OK" : ""}
                    </Text>
                  )}
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" fw={500} truncate>
                        {row.book.title}
                      </Text>
                      {row.book.issues.map((issue) => (
                        <Badge
                          key={issue}
                          variant="outline"
                          color="gray"
                          size="xs"
                          style={{ flexShrink: 0 }}
                        >
                          {ISSUE_LABELS[issue]}
                        </Badge>
                      ))}
                    </Group>
                    <Stack gap={2}>
                      {changeParts(row).map((part, i) => (
                        <Text key={i} size="xs" c="dimmed">
                          <Text span size="xs" c="var(--mantine-color-text)">
                            {part.label}
                          </Text>
                          {part.detail ? (
                            <Text span size="xs" fs="italic">
                              {" "}
                              - {part.detail}
                            </Text>
                          ) : null}
                        </Text>
                      ))}
                    </Stack>
                  </Stack>
                </Group>
              ))}
            </Stack>
          )}
        </Box>

        <Group justify="flex-end" gap="sm">
          {phase === "review" && rows.length > 0 ? (
            <>
              <Text size="sm" c="dimmed" mr="auto">
                {checkedRows.length} selected
              </Text>
              <Button variant="subtle" color="gray" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => void onApply()}
                disabled={checkedRows.length === 0}
              >
                Apply {checkedRows.length}
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              onClick={onClose}
              disabled={phase === "applying"}
            >
              {phase === "done" ? "Close" : "Cancel"}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
