import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { Button } from "@v3/_/components/ui/button"
import { ColorPicker } from "@v3/_/components/ui/color-picker"
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
import { IconPicker } from "@v3/_/components/ui/icon-picker"
import { Input } from "@v3/_/components/ui/input"
import { Textarea } from "@v3/_/components/ui/textarea"

import {
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

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
  collection?: {
    uuid: string
    name: string
    description: string | null
    icon: string | null
    color: string | null
  } | null
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
  initialName = "",
  collection,
}: CreateCollectionDialogProps) {
  const isEditing = !!collection
  const [createCollection, { isLoading: isCreating }] = useCreateCollectionMutation()
  const [updateCollection, { isLoading: isUpdating }] = useUpdateCollectionMutation()
  const isLoading = isCreating || isUpdating

  const [icon, setIcon] = useState<string | null>(collection?.icon ?? null)
  const [color, setColor] = useState<string | null>(collection?.color ?? null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CollectionFormData>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: collection?.name ?? initialName,
      description: collection?.description ?? "",
    },
  })

  useEffect(() => {
    if (open && collection) {
      reset({
        name: collection.name,
        description: collection.description ?? "",
      })
      setIcon(collection.icon ?? null)
      setColor(collection.color ?? null)
    } else if (open && !collection) {
      reset({ name: initialName, description: "" })
      setIcon(null)
      setColor(null)
    }
  }, [open, collection, initialName, reset])

  const handleClose = useCallback(() => {
    reset()
    onOpenChange(false)
  }, [reset, onOpenChange])

  const onSubmit = useCallback(
    async (data: CollectionFormData) => {
      try {
        if (isEditing) {
          await updateCollection({
            uuid: collection.uuid as UUID,
            update: {
              name: data.name,
              description: data.description ?? null,
              icon,
              color,
            },
          }).unwrap()

          onCreated?.(collection.uuid)
        } else {
          const result = await createCollection({
            name: data.name,
            description: data.description ?? "",
            public: true,
            users: [],
          }).unwrap()

          // update icon/color after creation if set
          if (icon || color) {
            await updateCollection({
              uuid: result.uuid,
              update: { icon, color },
            }).unwrap()
          }

          onCreated?.(result.uuid)
        }

        handleClose()
      } catch {
        // error handling is done via the mutation error state
      }
    },
    [createCollection, updateCollection, collection, isEditing, icon, color, onCreated, handleClose],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Collection" : "Create Collection"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the collection settings."
              : "Create a new collection to organize your books."}
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

            <Field>
              <FieldLabel>Icon & Color</FieldLabel>
              <div className="flex items-center gap-2">
                <IconPicker value={icon} onChange={setIcon} color={color} />
                <ColorPicker value={color} onChange={setColor} />
              </div>
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
              {isLoading
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
