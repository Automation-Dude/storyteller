"use client"

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Image,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core"
import { IconExternalLink, IconSearch } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"

import { type AuditBook, type AuditIssue } from "@/database/auditLibrary"
import { type OpenLibraryCandidate } from "@/metadata/openLibrary"
import {
  useApplyRepairsMutation,
  useLazySearchMetadataQuery,
  useSuggestRepairsMutation,
} from "@/store/api"

import { ISSUE_LABELS } from "./LibraryAudit"

const COVER_ISSUES: AuditIssue[] = ["NO-COVER", "BLANK-COVER", "TINY-COVER"]

type Fields = {
  title: string
  authors: string
  language: string
  description: string
  coverUrl: string
  seriesName: string
  seriesPosition: string
}

const EMPTY: Fields = {
  title: "",
  authors: "",
  language: "",
  description: "",
  coverUrl: "",
  seriesName: "",
  seriesPosition: "",
}

function fillFromCandidate(candidate: OpenLibraryCandidate): Partial<Fields> {
  return {
    title: candidate.title,
    authors: candidate.authors.join(", "),
    // The language list spans every edition; only claim English when an
    // English edition actually exists, never a random translation's code.
    language: candidate.languages.includes("eng") ? "en" : "",
    coverUrl: candidate.coverUrl ?? "",
    ...(candidate.description && { description: candidate.description }),
  }
}

/** "1989 · 42 editions · rated 3.9" - whichever parts the match has. */
function matchDetail(candidate: OpenLibraryCandidate): string {
  const parts: string[] = []
  if (candidate.firstPublishYear) parts.push(String(candidate.firstPublishYear))
  if (candidate.editionCount)
    parts.push(
      `${candidate.editionCount} edition${candidate.editionCount === 1 ? "" : "s"}`,
    )
  if (candidate.ratingsAverage)
    parts.push(`rated ${candidate.ratingsAverage.toFixed(1)}`)
  return parts.join(" · ")
}

export function RepairDialog({
  book,
  opened,
  onClose,
}: {
  book: AuditBook
  opened: boolean
  onClose: () => void
}) {
  const [suggest, suggestion] = useSuggestRepairsMutation()
  const [applyRepairs, apply] = useApplyRepairsMutation()
  const [searchMetadata, searchResult] = useLazySearchMetadataQuery()

  const [fields, setFields] = useState<Fields>(EMPTY)
  const [manualQuery, setManualQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const filledFor = useRef<string | null>(null)

  const needsCover = book.issues.some((i) => COVER_ISSUES.includes(i))

  // Ask Open Library once per time the dialog opens for this book, and prefill
  // the fields the book actually has a problem with from the best match.
  useEffect(() => {
    if (!opened) {
      filledFor.current = null
      return
    }
    if (filledFor.current === book.uuid) return
    filledFor.current = book.uuid
    setFields(EMPTY)
    setError(null)
    void suggest({ bookUuids: [book.uuid] })
      .unwrap()
      .then((result) => {
        // The resolver already worked out the complete fill for the fields
        // this book is missing (file metadata first, then the catalogue
        // match, description included); prefill exactly that.
        const choice = result.proposals[0]?.choice
        if (!choice) return
        setFields((prev) => ({
          ...prev,
          ...(choice.title && { title: choice.title }),
          ...(choice.authors?.length && { authors: choice.authors.join(", ") }),
          ...(choice.language && { language: choice.language }),
          ...(choice.description && { description: choice.description }),
          ...(choice.coverUrl && { coverUrl: choice.coverUrl }),
          ...(choice.series && {
            seriesName: choice.series.name,
            seriesPosition:
              choice.series.position != null
                ? String(choice.series.position)
                : "",
          }),
        }))
      })
      .catch(() => undefined)
  }, [opened, book.uuid, book.issues, needsCover, suggest])

  const best = suggestion.data?.proposals[0]?.best ?? null
  const candidates = searchResult.data?.candidates ?? []

  function useCandidate(candidate: OpenLibraryCandidate) {
    setFields((prev) => ({ ...prev, ...fillFromCandidate(candidate) }))
  }

  async function onApply() {
    setError(null)
    const choice: Record<
      string,
      string | string[] | { name: string; position?: number }
    > = {}
    if (fields.title.trim()) choice["title"] = fields.title.trim()
    if (fields.authors.trim())
      choice["authors"] = fields.authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    if (fields.language.trim()) choice["language"] = fields.language.trim()
    if (fields.description.trim())
      choice["description"] = fields.description.trim()
    if (fields.coverUrl.trim()) choice["coverUrl"] = fields.coverUrl.trim()
    if (fields.seriesName.trim()) {
      const position = Number.parseFloat(fields.seriesPosition)
      choice["series"] = {
        name: fields.seriesName.trim(),
        ...(Number.isFinite(position) && { position }),
      }
    }

    if (Object.keys(choice).length === 0) {
      setError("Fill in at least one field to apply.")
      return
    }

    try {
      const result = await applyRepairs({
        repairs: [{ bookUuid: book.uuid, ...choice }],
      }).unwrap()
      if (result.failed > 0) {
        setError(result.results[0]?.message ?? "The repair failed.")
      } else {
        onClose()
      }
    } catch {
      setError("The repair failed.")
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Repair book" size="xl">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {book.title}
        </Text>

        <Group gap={6}>
          {book.issues.map((issue) => (
            <Badge key={issue} variant="outline" color="gray">
              {ISSUE_LABELS[issue]}
            </Badge>
          ))}
        </Group>

        {suggestion.isLoading ? (
          <Group gap="xs" py="md" c="dimmed">
            <Loader size="sm" />{" "}
            <Text size="sm">Looking up Open Library...</Text>
          </Group>
        ) : (
          <>
            {best ? (
              <Text size="sm" c="dimmed">
                Best match:{" "}
                <Text span fw={500} c="var(--mantine-color-text)">
                  {best.title}
                </Text>
                {best.authors[0] ? ` / ${best.authors[0]}` : ""} (
                {Math.round(best.score * 100)}%)
                {matchDetail(best) ? (
                  <Text span c="dimmed">
                    {" "}
                    · {matchDetail(best)}
                  </Text>
                ) : null}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                No confident Open Library match. Search manually below or edit
                the fields by hand.
              </Text>
            )}

            <Group align="flex-start" gap="md" wrap="nowrap">
              <CoverPreview
                bookUuid={book.uuid}
                proposedUrl={fields.coverUrl}
              />
              <Stack gap="sm" style={{ flex: 1 }}>
                <TextInput
                  label="Title"
                  value={fields.title}
                  placeholder={book.title}
                  onChange={(e) => {
                    setFields((f) => ({ ...f, title: e.currentTarget.value }))
                  }}
                />
                <TextInput
                  label="Author"
                  value={fields.authors}
                  placeholder="comma separated"
                  onChange={(e) => {
                    setFields((f) => ({ ...f, authors: e.currentTarget.value }))
                  }}
                />
                <Group grow align="flex-start">
                  <TextInput
                    label="Language"
                    value={fields.language}
                    placeholder="en"
                    onChange={(e) => {
                      setFields((f) => ({
                        ...f,
                        language: e.currentTarget.value,
                      }))
                    }}
                  />
                  <TextInput
                    label="Cover URL"
                    value={fields.coverUrl}
                    placeholder="https://..."
                    onChange={(e) => {
                      setFields((f) => ({
                        ...f,
                        coverUrl: e.currentTarget.value,
                      }))
                    }}
                  />
                </Group>
                <Group grow align="flex-start">
                  <TextInput
                    label="Series"
                    value={fields.seriesName}
                    placeholder="e.g. Cradle"
                    onChange={(e) => {
                      setFields((f) => ({
                        ...f,
                        seriesName: e.currentTarget.value,
                      }))
                    }}
                  />
                  <TextInput
                    label="Book number"
                    value={fields.seriesPosition}
                    placeholder="e.g. 8"
                    onChange={(e) => {
                      setFields((f) => ({
                        ...f,
                        seriesPosition: e.currentTarget.value,
                      }))
                    }}
                  />
                </Group>
                <Textarea
                  label="Description"
                  autosize
                  minRows={3}
                  value={fields.description}
                  onChange={(e) => {
                    setFields((f) => ({
                      ...f,
                      description: e.currentTarget.value,
                    }))
                  }}
                />
              </Stack>
            </Group>

            <ManualSearch
              query={manualQuery}
              setQuery={setManualQuery}
              onSearch={() =>
                void searchMetadata({ q: manualQuery || book.title })
              }
              searching={searchResult.isFetching}
              candidates={candidates}
              onUse={useCandidate}
            />
          </>
        )}

        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void onApply()} loading={apply.isLoading}>
            Apply
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function CoverPreview({
  bookUuid,
  proposedUrl,
}: {
  bookUuid: string
  proposedUrl: string
}) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Stack gap={4} align="center">
        {/* A book cover, sometimes an external Open Library URL; next/image
            would need every host allow-listed, so a plain img is used. */}
        <Image
          src={`/api/v2/books/${bookUuid}/cover?w=110&h=165`}
          alt=""
          w={110}
          h={165}
          radius="sm"
          fit="cover"
          fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
        />
        <Text size="xs" c="dimmed">
          Current
        </Text>
      </Stack>
      {proposedUrl ? (
        <Stack gap={4} align="center">
          <Image
            src={proposedUrl}
            alt=""
            w={110}
            h={165}
            radius="sm"
            fit="cover"
            style={{ outline: "2px solid var(--mantine-color-green-5)" }}
          />
          <Text size="xs" c="dimmed">
            Proposed
          </Text>
        </Stack>
      ) : null}
    </Group>
  )
}

function ManualSearch({
  query,
  setQuery,
  onSearch,
  searching,
  candidates,
  onUse,
}: {
  query: string
  setQuery: (q: string) => void
  onSearch: () => void
  searching: boolean
  candidates: OpenLibraryCandidate[]
  onUse: (candidate: OpenLibraryCandidate) => void
}) {
  return (
    <Box>
      <Divider mb="sm" />
      <Text size="xs" fw={500} mb={6}>
        Search Open Library
      </Text>
      <Group gap="xs" wrap="nowrap">
        <TextInput
          style={{ flex: 1 }}
          value={query}
          placeholder="title and author"
          onChange={(e) => {
            setQuery(e.currentTarget.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch()
          }}
        />
        <Button
          variant="default"
          onClick={onSearch}
          loading={searching}
          leftSection={<IconSearch size={16} />}
        >
          Search
        </Button>
      </Group>
      {candidates.length > 0 ? (
        <Stack gap={2} mt="xs">
          {candidates.map((candidate) => (
            <Group
              key={candidate.workKey}
              justify="space-between"
              gap="xs"
              wrap="nowrap"
              px="xs"
              py={6}
            >
              <Text size="sm" truncate>
                {candidate.title}
                <Text span c="dimmed">
                  {candidate.authors[0] ? ` / ${candidate.authors[0]}` : ""}
                  {matchDetail(candidate) ? ` · ${matchDetail(candidate)}` : ""}
                  {candidate.description ? " · has description" : ""}
                </Text>
              </Text>
              <Group gap={4} wrap="nowrap">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  component="a"
                  href={`https://openlibrary.org${candidate.workKey}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open on Open Library"
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={() => {
                    onUse(candidate)
                  }}
                >
                  Use
                </Button>
              </Group>
            </Group>
          ))}
        </Stack>
      ) : null}
    </Box>
  )
}
