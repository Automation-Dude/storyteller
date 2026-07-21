"use client"

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core"
import { IconRefresh, IconWand } from "@tabler/icons-react"
import { useEffect, useState } from "react"

import {
  type AuditBook,
  type AuditIssue,
  type CachedLibraryAudit as AuditData,
} from "@/database/auditLibrary"
import { type SeriesReport, type UnlinkedMember } from "@/metadata/seriesAudit"
import {
  useApplyRepairsMutation,
  useGetLibraryAuditQuery,
  useLookupSeriesPartsMutation,
  useRescanLibraryAuditMutation,
} from "@/store/api"

import { AutoRepairDialog } from "./AutoRepairDialog"
import { RepairDialog } from "./RepairDialog"

// The issues in the order they are shown, with how loud each looks. A missing
// or blank cover and a filename title are what make a shelf look broken, so
// they are red; a missing language or description is real but quieter.
const ISSUE_ORDER: { issue: AuditIssue; color: string }[] = [
  { issue: "NO-COVER", color: "red" },
  { issue: "BLANK-COVER", color: "red" },
  { issue: "TINY-COVER", color: "yellow" },
  { issue: "BAD-TITLE", color: "red" },
  { issue: "NO-AUTHOR", color: "red" },
  { issue: "BAD-AUTHOR", color: "gray" },
  { issue: "NO-LANG", color: "gray" },
  { issue: "NO-DESC", color: "gray" },
  { issue: "NO-SERIES", color: "gray" },
]

const COLOR_OF = new Map(ISSUE_ORDER.map((i) => [i.issue, i.color]))

export const ISSUE_LABELS: Record<AuditIssue, string> = {
  "NO-COVER": "No cover",
  "BLANK-COVER": "Blank cover",
  "TINY-COVER": "Tiny cover",
  "BAD-TITLE": "Filename title",
  "NO-AUTHOR": "No author",
  "BAD-AUTHOR": "Broken author name",
  "NO-LANG": "No language",
  "NO-DESC": "No description",
  "NO-SERIES": "No series",
}

function relativeTime(iso: string): string {
  const secs = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  )
  if (secs < 60) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  return `${Math.round(hours / 24)} day(s) ago`
}

export function LibraryAudit() {
  const [pollInterval, setPollInterval] = useState(2000)
  const { data, isError } = useGetLibraryAuditQuery(undefined, {
    pollingInterval: pollInterval,
  })
  const [rescan] = useRescanLibraryAuditMutation()

  const [repairing, setRepairing] = useState<AuditBook | null>(null)
  const [autoRepairOpen, setAutoRepairOpen] = useState(false)

  const ready = data?.status === "ready"
  const computing = !ready

  // Poll only while the background pass is running; stop once it is ready.
  useEffect(() => {
    setPollInterval(data && data.status !== "ready" ? 2000 : 0)
  }, [data])

  return (
    <Stack gap="lg">
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Box>
          <Title order={2}>Library audit</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Books an e-reader shelf shows badly: missing, blank or tiny covers,
            no author or language, or a filename-like title.
          </Text>
          {ready && data.computedAt ? (
            <Text size="xs" c="dimmed" mt={4}>
              Last scanned {relativeTime(data.computedAt)}
            </Text>
          ) : null}
        </Box>
        <Group gap="sm" wrap="nowrap">
          {ready && data.books.length > 0 ? (
            <Button
              size="sm"
              leftSection={<IconWand size={16} />}
              onClick={() => {
                setAutoRepairOpen(true)
              }}
            >
              Auto-repair
            </Button>
          ) : null}
          <Button
            variant="default"
            size="sm"
            leftSection={
              <IconRefresh
                size={16}
                className={computing ? "animate-spin" : undefined}
              />
            }
            onClick={() => void rescan()}
            disabled={computing}
          >
            {computing ? "Scanning..." : "Rescan"}
          </Button>
        </Group>
      </Group>

      {isError ? (
        <Alert color="red" title="Couldn't load the audit">
          The audit could not be loaded. Try Rescan; if it keeps failing, check
          the server logs.
        </Alert>
      ) : !data || (computing && data.total === 0) ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Preparing the audit in the background...
          </Text>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={44} radius="sm" />
          ))}
        </Stack>
      ) : (
        <>
          {computing ? (
            <Alert color="blue" variant="light" title="Scanning">
              Checking every book&apos;s cover and metadata, {data.scanned} of{" "}
              {data.total} so far. Results fill in as it goes.
            </Alert>
          ) : null}
          <SummaryCards data={data} />
          {data.books.length === 0 ? (
            ready ? (
              <Alert color="green" title="All clear">
                Every book has a real cover, an author and a sensible title.
              </Alert>
            ) : null
          ) : (
            <FlaggedTable data={data} onRepair={setRepairing} />
          )}
          <SeriesSection series={data.series} />
        </>
      )}

      {repairing ? (
        <RepairDialog
          book={repairing}
          opened
          onClose={() => {
            setRepairing(null)
          }}
        />
      ) : null}

      {data ? (
        <AutoRepairDialog
          books={data.books}
          opened={autoRepairOpen}
          onClose={() => {
            setAutoRepairOpen(false)
          }}
        />
      ) : null}
    </Stack>
  )
}

function SummaryCards({ data }: { data: AuditData }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
      <Card withBorder padding="md">
        <Text size="sm" c="dimmed">
          Flagged
        </Text>
        <Text size="xl" fw={600}>
          {data.flagged}
          <Text span size="md" c="dimmed" fw={400} ml={4}>
            / {data.total}
          </Text>
        </Text>
      </Card>
      {ISSUE_ORDER.filter(({ issue }) => data.counts[issue] > 0).map(
        ({ issue }) => (
          <Card key={issue} withBorder padding="md">
            <Text size="sm" c="dimmed">
              {ISSUE_LABELS[issue]}
            </Text>
            <Text size="xl" fw={600}>
              {data.counts[issue]}
            </Text>
          </Card>
        ),
      )}
    </SimpleGrid>
  )
}

function SeriesSection({ series }: { series: SeriesReport[] }) {
  // A complete, fully-linked series has nothing to say; show the ones with a
  // hole in the run or a stray book on the shelf that belongs in them.
  const actionable = series.filter(
    (s) => s.missingPositions.length > 0 || s.unlinked.length > 0,
  )
  if (actionable.length === 0) return null
  return (
    <Stack gap="sm">
      <Box>
        <Title order={3}>Series</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Numbered runs with holes, and books on the shelf that belong to a
          series but are not filed in it.
        </Text>
      </Box>
      {actionable.map((report) => (
        <SeriesCard key={report.name} report={report} />
      ))}
    </Stack>
  )
}

function SeriesCard({ report }: { report: SeriesReport }) {
  const [lookup, lookupState] = useLookupSeriesPartsMutation()
  const [applyRepairs] = useApplyRepairsMutation()
  const [named, setNamed] = useState<Map<number, string> | null>(null)
  const [lookupFailed, setLookupFailed] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)

  const highest = report.havePositions[report.havePositions.length - 1]

  async function onName() {
    try {
      const { result } = await lookup({
        name: report.name,
        author: report.authorHint,
      }).unwrap()
      const parts = result?.parts ?? []
      if (parts.length === 0) {
        setLookupFailed(true)
        return
      }
      setNamed(
        new Map(
          parts
            .filter((part) => part.ordinal !== null)
            .map((part) => [part.ordinal as number, part.title]),
        ),
      )
    } catch {
      setLookupFailed(true)
    }
  }

  async function onLink(member: UnlinkedMember) {
    setLinking(member.uuid)
    try {
      await applyRepairs({
        repairs: [
          {
            bookUuid: member.uuid,
            series: { name: member.clueName, position: member.position },
          },
        ],
      }).unwrap()
    } catch {
      // The audit refetch will show the row again; nothing else to do here.
    }
    setLinking(null)
  }

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box style={{ minWidth: 0 }}>
          <Text fw={600} truncate>
            {report.name}
          </Text>
          <Text size="xs" c="dimmed">
            {report.members.length} book
            {report.members.length === 1 ? "" : "s"}
            {highest ? `, numbered to #${highest}` : ""}
            {report.authorHint ? ` - ${report.authorHint}` : ""}
          </Text>
        </Box>
        {report.missingPositions.length > 0 && !named && !lookupFailed ? (
          <Button
            size="xs"
            variant="default"
            onClick={() => void onName()}
            loading={lookupState.isLoading}
          >
            Name the missing books
          </Button>
        ) : null}
      </Group>
      {report.missingPositions.length > 0 ? (
        <Text size="sm" mt={6}>
          Missing {report.missingPositions.map((n) => `#${n}`).join(", ")}
        </Text>
      ) : null}
      {named ? (
        <Stack gap={2} mt={4}>
          {report.missingPositions.map((n) => (
            <Text key={n} size="xs" c="dimmed">
              #{n}: {named.get(n) ?? "not listed on Wikidata"}
            </Text>
          ))}
        </Stack>
      ) : lookupFailed ? (
        <Text size="xs" c="dimmed" mt={4}>
          Wikidata does not list this series&apos; volumes.
        </Text>
      ) : null}
      {report.unlinked.length > 0 ? (
        <Stack gap={4} mt="sm">
          <Text size="xs" fw={500}>
            In your library, not filed in the series:
          </Text>
          {report.unlinked.map((member) => (
            <Group key={member.uuid} gap="sm" wrap="nowrap">
              <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
                {member.title}
                {member.position != null ? ` (#${member.position})` : ""}
              </Text>
              <Button
                size="xs"
                onClick={() => void onLink(member)}
                loading={linking === member.uuid}
              >
                Add to series
              </Button>
            </Group>
          ))}
        </Stack>
      ) : null}
    </Card>
  )
}

function FlaggedTable({
  data,
  onRepair,
}: {
  data: AuditData
  onRepair: (book: AuditBook) => void
}) {
  // Sort the most-broken books to the top: worth fixing first.
  const books = data.books
    .slice()
    .sort((a, b) => b.issues.length - a.issues.length)

  return (
    <Card withBorder padding={0}>
      <Table.ScrollContainer minWidth={520}>
        <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th visibleFrom="sm">Author</Table.Th>
              <Table.Th>Issues</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {books.map((book) => (
              <Table.Tr key={book.uuid}>
                <Table.Td style={{ maxWidth: "24rem" }}>
                  <Text fw={500} lineClamp={2}>
                    {book.title}
                  </Text>
                </Table.Td>
                <Table.Td visibleFrom="sm" c="dimmed">
                  {book.authors.length ? (
                    book.authors.join(", ")
                  ) : (
                    <Text span fs="italic" c="dimmed">
                      no author
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap={6}>
                    {book.issues.map((issue) => (
                      <Badge
                        key={issue}
                        variant="light"
                        color={COLOR_OF.get(issue) ?? "gray"}
                      >
                        {ISSUE_LABELS[issue]}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td ta="right">
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => {
                      onRepair(book)
                    }}
                  >
                    Repair
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  )
}
