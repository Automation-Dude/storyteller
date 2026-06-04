import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"


import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@v3/_/components/ui/field"
import { Input } from "@v3/_/components/ui/input"
import { Textarea } from "@v3/_/components/ui/textarea"

import { useCreateCollectionMutation } from "@/store/api"

const collectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
})

type CollectionFormData = z.infer<typeof collectionSchema>

type CreateCollectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (uuid: string) => void
  initialName?: string
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
  initialName = "",
}: CreateCollectionDialogProps) {
  const [createCollection, { isLoading }] = useCreateCollectionMutation()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CollectionFormData>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: initialName,
      description: "",
    },
  })

  const handleClose = useCallback(() => {
    reset()
    onOpenChange(false)
  }, [reset, onOpenChange])

  const onSubmit = useCallback(
    async (data: CollectionFormData) => {
      try {
        const result = await createCollection({
          name: data.name,
          description: data.description ?? "",
          public: true,
          users: [],
          importPath: null,
        }).unwrap()
        onCreated?.(result.uuid)
        handleClose()
      } catch {
        // error handling is done via the mutation error state
      }
    },
    [createCollection, onCreated, handleClose],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>
            Create a new collection to organize your books.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="collection-name">Name</FieldLabel>
              <Input
                id="collection-name"
                placeholder="My Collection"
                {...register("name")}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="collection-description">
                Description
              </FieldLabel>
              <Textarea
                id="collection-description"
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
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
