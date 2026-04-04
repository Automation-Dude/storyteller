import { z } from "zod"

const editableCreatorSchema = z.object({
  name: z.string(),
  role: z.string(),
})

export type EditableCreator = z.infer<typeof editableCreatorSchema>

export const bookFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  publicationDate: z.string().nullable(),
  authors: z.array(z.string()),
  narrators: z.array(z.string()),
  creators: z.array(editableCreatorSchema),
  rating: z.number().nullable(),
  textCover: z.instanceof(File).nullable(),
  audioCover: z.instanceof(File).nullable(),
})

export type BookFormValues = z.infer<typeof bookFormSchema>
