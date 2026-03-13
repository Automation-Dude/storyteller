import { useCallback, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"

import { api, useUpdateSeriesMutation } from "@/api/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const seriesSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

type SeriesFormData = z.infer<typeof seriesSchema>

type EditSeriesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  series: {
    uuid: string
    name: string
    description: string | null
  } | null
  onUpdated?: () => void
}

export function EditSeriesDialog({
  open,
  onOpenChange,
  series,
  onUpdated,
}: EditSeriesDialogProps) {
  const [updateSeries, { isLoading }] = useUpdateSeriesMutation()

  // fetch books in this series to preserve relations on update
  const { data: booksData } = api.endpoints.listInfiniteBooks.useInfiniteQuery(
    { series: series?.uuid, limit: 100 },
    { skip: !series?.uuid || !open },
  )

  const currentRelations = useMemo(() => {
    if (!booksData?.pages || !series) return []
    const books = booksData.pages.flat()
    return books.map((book) => {
      const seriesInfo = book.series.find((s) => s.uuid === series.uuid)
      return {
        bookUuid: book.uuid as `${string}-${string}-${string}-${string}-${string}`,
        position: seriesInfo?.position ?? null,
        featured: seriesInfo?.featured ?? false,
      }
    })
  }, [booksData, series])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SeriesFormData>({
    resolver: zodResolver(seriesSchema),
    defaultValues: {
      name: series?.name ?? "",
      description: series?.description ?? "",
    },
  })

  useEffect(() => {
    if (series) {
      reset({
        name: series.name,
        description: series.description ?? "",
      })
    }
  }, [series, reset])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const onSubmit = useCallback(
    async (data: SeriesFormData) => {
      if (!series) return
      try {
        await updateSeries({
          uuid: series.uuid as `${string}-${string}-${string}-${string}-${string}`,
          update: {
            name: data.name,
            description: data.description ?? "",
            relations: currentRelations,
          },
        }).unwrap()
        onUpdated?.()
        handleClose()
      } catch {
        // error handling is done via the mutation error state
      }
    },
    [updateSeries, series, onUpdated, handleClose, currentRelations],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Series</DialogTitle>
          <DialogDescription>
            Update the series name and description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="edit-series-name">Name</FieldLabel>
              <Input
                id="edit-series-name"
                placeholder="Series name"
                {...register("name")}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-series-description">
                Description
              </FieldLabel>
              <Textarea
                id="edit-series-description"
                placeholder="Optional description..."
                rows={3}
                {...register("description")}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
