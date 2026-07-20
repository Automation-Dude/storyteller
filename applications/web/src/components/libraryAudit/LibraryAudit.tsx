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
import { useState } from "react"

import {
  type AuditBook,
  type AuditIssue,
  type LibraryAudit as AuditData,
} from "@/database/auditLibrary"
import { useGetLibraryAuditQuery } from "@/store/api"

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
  { issue: "NO-LANG", color: "gray" },
  { issue: "NO-DESC", color: "gray" },
]

const COLOR_OF = new Map(ISSUE_ORDER.map((i) => [i.issue, i.color]))

export const ISSUE_LABELS: Record<AuditIssue, string> = {
  "NO-COVER": "No cover",
  "BLANK-COVER": "Blank cover",
  "TINY-COVER": "Tiny cover",
  "BAD-TITLE": "Filename title",
  "NO-AUTHOR": "No author",
  "NO-LANG": "No language",
  "NO-DESC": "No description",
}

export function LibraryAudit() {
  const { data, isFetching, isError, refetch } = useGetLibraryAuditQuery()

  const [repairing, setRepairing] = useState<AuditBook | null>(null)
  const [autoRepairOpen, setAutoRepairOpen] = useState(false)

  return (
    <Stack gap="lg">
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Box>
          <Title order={2}>Library audit</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Books an e-reader shelf shows badly: missing, blank or tiny covers,
            no author or language, or a filename-like title.
          </Text>
        </Box>
        <Group gap="sm" wrap="nowrap">
          {data && data.books.length > 0 ? (
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
                className={isFetching ? "animate-spin" : undefined}
              />
            }
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Rescan
          </Button>
        </Group>
      </Group>

      {isError ? (
        <Alert color="red" title="Couldn't scan the library">
          The audit failed to run. Try Rescan; if it keeps failing, check the
          server logs.
        </Alert>
      ) : isFetching && !data ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Scanning every book&apos;s cover and metadata, this can take a
            moment on a large library.
          </Text>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={44} radius="sm" />
          ))}
        </Stack>
      ) : data ? (
        <>
          <SummaryCards data={data} />
          {data.books.length === 0 ? (
            <Alert color="green" title="All clear">
              Every book has a real cover, an author and a sensible title.
            </Alert>
          ) : (
            <FlaggedTable data={data} onRepair={setRepairing} />
          )}
        </>
      ) : null}

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
