import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect } from "react"
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
import { useTranslation } from "@v3/_/hooks/use-translation"

import { useUpdateTagMutation } from "@/store/api"

const tagSchema = z.object({
  name: z.string().min(1),
})

type TagFormData = z.infer<typeof tagSchema>

type EditTagDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag: { uuid: string; name: string } | null
  onUpdated?: () => void
}

export function EditTagDialog({
  open,
  onOpenChange,
  tag,
  onUpdated,
}: EditTagDialogProps) {
  const t = useTranslation("EntityActions")
  const [updateTag, { isLoading }] = useUpdateTagMutation()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: { name: tag?.name ?? "" },
  })

  useEffect(() => {
    if (tag) {
      reset({ name: tag.name })
    }
  }, [tag, reset])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const onSubmit = useCallback(
    async (data: TagFormData) => {
      if (!tag) return

      try {
        await updateTag({
          uuid: tag.uuid as `${string}-${string}-${string}-${string}-${string}`,
          update: { name: data.name },
        }).unwrap()

        onUpdated?.()
        handleClose()
      } catch {
        // error handling via mutation state
      }
    },
    [updateTag, tag, onUpdated, handleClose],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.plain("editTag")}</DialogTitle>
          <DialogDescription>{t.plain("editTagDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="edit-tag-name">
                {t.plain("tagName")}
              </FieldLabel>
              <Input
                id="edit-tag-name"
                placeholder={t.plain("tagName")}
                {...register("name")}
              />
              {errors.name && (
                <FieldError>{t.plain("nameRequired")}</FieldError>
              )}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t.plain("cancel")}
            </Button>

            <Button type="submit" disabled={isLoading}>
              {isLoading ? t.plain("saving") : t.plain("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
