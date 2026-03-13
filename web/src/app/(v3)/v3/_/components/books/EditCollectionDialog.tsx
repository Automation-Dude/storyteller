import { useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"

import { useUpdateCollectionMutation } from "@/api/api"
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

const collectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

type CollectionFormData = z.infer<typeof collectionSchema>

type EditCollectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection: {
    uuid: string
    name: string
    description: string | null
  } | null
  onUpdated?: () => void
}

export function EditCollectionDialog({
  open,
  onOpenChange,
  collection,
  onUpdated,
}: EditCollectionDialogProps) {
  const [updateCollection, { isLoading }] = useUpdateCollectionMutation()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CollectionFormData>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: collection?.name ?? "",
      description: collection?.description ?? "",
    },
  })

  useEffect(() => {
    if (collection) {
      reset({
        name: collection.name,
        description: collection.description ?? "",
      })
    }
  }, [collection, reset])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const onSubmit = useCallback(
    async (data: CollectionFormData) => {
      if (!collection) return
      try {
        await updateCollection({
          uuid: collection.uuid as `${string}-${string}-${string}-${string}-${string}`,
          update: {
            name: data.name,
            description: data.description ?? null,
          },
        }).unwrap()
        onUpdated?.()
        handleClose()
      } catch {
        // error handling is done via the mutation error state
      }
    },
    [updateCollection, collection, onUpdated, handleClose],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
          <DialogDescription>
            Update the collection name and description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="edit-collection-name">Name</FieldLabel>
              <Input
                id="edit-collection-name"
                placeholder="Collection name"
                {...register("name")}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-collection-description">
                Description
              </FieldLabel>
              <Textarea
                id="edit-collection-description"
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
