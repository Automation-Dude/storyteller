"use client"

import { Box, Button, Group, Paper, Progress, Stack, Text } from "@mantine/core"

import { usePermissions } from "@/hooks/usePermissions"
import {
  useCancelScanMutation,
  useGetScanStateQuery,
  useListBooksQuery,
  useProcessBookMutation,
  useTriggerBookScanMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { BookOptions } from "./BookOptions"
import { ProcessingFailedMessage } from "./ProcessingFailedMessage"

type Props = {
  bookUuid: UUID
}

export const ProcessingTaskTypes = {
  SYNC_CHAPTERS: "Synchronizing chapters",
  SPLIT_TRACKS: "Pre-processing audio",
  TRANSCRIBE_CHAPTERS: "Transcribing tracks",
}

export function BookStatus({ bookUuid }: Props) {
  const { book } = useListBooksQuery(undefined, {
    selectFromResult: (result) => ({
      book: result.data?.find((book) => book.uuid === bookUuid),
    }),
  })

  const permissions = usePermissions()

  const [processBook] = useProcessBookMutation()
  const [triggerBookScan, { isLoading: isTriggeringScan }] =
    useTriggerBookScanMutation()
  const [cancelScan, { isLoading: isCancellingScan }] = useCancelScanMutation()

  const { data: scanState } = useGetScanStateQuery(undefined, {
    pollingInterval: 5_000,
    skip: !permissions?.bookProcess,
  })

  if (!book) return null

  const aligned = !!book.readaloud?.filepath
  // Same precondition as canAlign in work/alignmentStatus: a format only counts
  // if it is present and not flagged missing on disk.
  const hasEbook = !!book.ebook && !book.ebook.missing
  const hasAudiobook = !!book.audiobook && !book.audiobook.missing

  const userFriendlyTaskType =
    book.readaloud?.currentStage &&
    ProcessingTaskTypes[book.readaloud.currentStage]

  if (!permissions?.bookRead) return null

  return (
    <Paper>
      <Group justify="space-between" wrap="nowrap" align="center">
        <BookOptions aligned={aligned} book={book} />

        {book.readaloud || (hasEbook && hasAudiobook) ? (
          <Stack justify="space-between" className="grow">
            {book.readaloud?.status ? (
              book.readaloud.status === "QUEUED" ? (
                "Queued for alignment"
              ) : book.readaloud.status === "ALIGNED" ? (
                "Aligned"
              ) : (
                <Box>
                  {userFriendlyTaskType}
                  {book.readaloud.status === "STOPPED" ? " (stopped)" : ""}
                  {book.readaloud.status === "ERROR" && (
                    <ProcessingFailedMessage />
                  )}
                  <Progress
                    value={Math.floor(book.readaloud.stageProgress * 100)}
                  />
                </Box>
              )
            ) : permissions.bookProcess ? (
              <Button
                variant="outline"
                className="self-start"
                onClick={() => {
                  void processBook({ uuid: book.uuid })
                }}
              >
                Create readaloud
              </Button>
            ) : (
              <Text>Unprocessed</Text>
            )}
          </Stack>
        ) : permissions.bookProcess ? (
          // The book has no readaloud and is missing a source format, so it
          // cannot be aligned yet (mirrors canAlign in work/alignmentStatus).
          // Say which format is missing instead of showing nothing, so it is
          // clear why there is no "Create readaloud" button and what to add.
          <Text size="sm" c="dimmed" className="grow self-center">
            {!hasEbook && !hasAudiobook
              ? "Add an ebook and an audiobook to create a read-aloud."
              : !hasAudiobook
                ? "Add an audiobook (the + button above) to create a read-aloud."
                : "Add an ebook (the + button above) to create a read-aloud."}
          </Text>
        ) : (
          <Box />
        )}

        {permissions.bookProcess && (
          <Group gap="xs">
            <Button
              variant="subtle"
              size="compact-sm"
              loading={isTriggeringScan}
              onClick={() => {
                void triggerBookScan({ uuid: book.uuid, force: true })
              }}
            >
              Scan
            </Button>

            {scanState?.running && (
              <Button
                variant="subtle"
                color="red"
                size="compact-sm"
                loading={isCancellingScan}
                onClick={() => {
                  void cancelScan()
                }}
              >
                Cancel scan
              </Button>
            )}
          </Group>
        )}
      </Group>
    </Paper>
  )
}
