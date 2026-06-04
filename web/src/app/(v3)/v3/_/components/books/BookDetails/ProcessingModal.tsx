import { IconProgress, IconReload, IconTrash } from "@tabler/icons-react"

import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import { Separator } from "@v3/_/components/ui/separator"

import { type BookWithRelations } from "@/database/books"
import {
  useDeleteBookAssetsMutation,
  useProcessBookMutation,
} from "@/store/api"
import { STAGE_ORDER } from "@/work/stages"

// NOTE: the old menu guarded processing with a GPU build warning
// (useGpuBuildWarning), but that hook renders a Mantine modal which is not
// allowed in v3. The guard is deferred until it can be rebuilt as a v3 dialog.

export function ProcessingModal({
  book,
  aligned,
  open,
  onOpenChange,
}: {
  book: BookWithRelations
  aligned: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [processBook] = useProcessBookMutation()
  const [deleteBookAssets] = useDeleteBookAssetsMutation()

  const currentStageOrder = book.readaloud?.currentStage
    ? STAGE_ORDER[book.readaloud.currentStage]
    : -1

  const canRestartFromSync = currentStageOrder >= 2
  const canRestartFromTranscription = currentStageOrder >= 1

  function run(action: () => void) {
    action()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Processing</DialogTitle>
          <DialogDescription>
            Re-run alignment or clear cached files for this book.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              run(() => void processBook({ uuid: book.uuid, restart: false }))
            }}
          >
            <IconProgress className="mr-2 h-4 w-4" />
            {aligned ? "Re-sync (keep all files)" : "Continue"}
          </Button>

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground px-1 text-xs font-semibold uppercase">
              Re-process
            </span>
            <Button
              variant="ghost"
              className="justify-start"
              disabled={!canRestartFromSync}
              onClick={() => {
                run(
                  () => void processBook({ uuid: book.uuid, restart: "sync" }),
                )
              }}
            >
              <IconProgress className="mr-2 h-4 w-4" />
              From sync step (keep transcriptions)
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              disabled={!canRestartFromTranscription}
              onClick={() => {
                run(
                  () =>
                    void processBook({
                      uuid: book.uuid,
                      restart: "transcription",
                    }),
                )
              }}
            >
              <IconReload className="mr-2 h-4 w-4" />
              From transcription step (keep audio)
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                run(
                  () => void processBook({ uuid: book.uuid, restart: "full" }),
                )
              }}
            >
              <IconReload className="mr-2 h-4 w-4" />
              Full restart (delete all cache)
            </Button>
          </div>

          <Separator className="my-1" />

          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => {
              run(() => void deleteBookAssets({ uuid: book.uuid }))
            }}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Delete cache files
          </Button>
          <Button
            variant="ghost"
            className="text-destructive justify-start"
            disabled={!aligned}
            title={
              aligned
                ? undefined
                : "You can't delete source files until the book has been synced successfully"
            }
            onClick={() => {
              run(
                () =>
                  void deleteBookAssets({ uuid: book.uuid, originals: true }),
              )
            }}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Delete source and cache files
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
