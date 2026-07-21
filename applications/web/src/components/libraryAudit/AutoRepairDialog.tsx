"use client"

import {
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from "@mantine/core"
import { useEffect, useState } from "react"

import { type AuditBook } from "@/database/auditLibrary"
import { applicableChoice } from "@/metadata/proposals"
import { type RepairChoice } from "@/metadata/repair"
import { useApplyRepairsMutation, useSuggestRepairsMutation } from "@/store/api"

import { ISSUE_LABELS } from "./LibraryAudit"

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
  opened,
  onClose,
}: {
  books: AuditBook[]
  opened: boolean
  onClose: () => void
}) {
  const [suggest] = useSuggestRepairsMutation()
  const [applyRepairs, apply] = useApplyRepairsMutation()

  const [phase, setPhase] = useState<"scanning" | "review" | "done">("scanning")
  const [scanned, setScanned] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [applied, setApplied] = useState(0)
  const [failed, setFailed] = useState(0)

  useEffect(() => {
    if (!opened) {
      setPhase("scanning")
      setScanned(0)
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
  }, [opened, books, suggest])

  const checkedRows = rows.filter((r) => r.checked)

  async function onApply() {
    try {
      const result = await applyRepairs({
        repairs: checkedRows.map((r) => ({
          bookUuid: r.book.uuid,
          ...r.change,
        })),
      }).unwrap()
      setApplied(result.applied)
      setFailed(result.failed)
    } catch {
      setFailed(checkedRows.length)
    }
    setPhase("done")
  }

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

        {phase === "scanning" ? (
          <Group gap="sm" py="lg" c="dimmed">
            <Loader size="sm" />
            <Text size="sm">
              Scanning {scanned} / {books.length}...
            </Text>
          </Group>
        ) : phase === "done" ? (
          <Text size="sm" py="md">
            Applied {applied} book{applied === 1 ? "" : "s"}.
            {failed > 0 ? ` ${failed} failed.` : ""}
          </Text>
        ) : rows.length === 0 ? (
          <Text size="sm" c="dimmed" py="md">
            No confident matches to apply automatically. Use per-book Repair for
            the rest.
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
                  borderTop:
                    index === 0
                      ? undefined
                      : "1px solid var(--mantine-color-default-border)",
                }}
              >
                <Checkbox
                  mt={2}
                  checked={row.checked}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked
                    setRows((prev) =>
                      prev.map((r, i) => (i === index ? { ...r, checked } : r)),
                    )
                  }}
                />
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {row.book.title}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {summarise(row.change)}
                  </Text>
                </Stack>
                <Group gap={4} wrap="wrap" style={{ flexShrink: 0 }}>
                  {row.book.issues.map((issue) => (
                    <Badge key={issue} variant="outline" color="gray" size="xs">
                      {ISSUE_LABELS[issue]}
                    </Badge>
                  ))}
                </Group>
              </Group>
            ))}
          </Stack>
        )}

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
                loading={apply.isLoading}
                disabled={checkedRows.length === 0}
              >
                Apply {checkedRows.length}
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={onClose}>
              {phase === "done" ? "Close" : "Cancel"}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
