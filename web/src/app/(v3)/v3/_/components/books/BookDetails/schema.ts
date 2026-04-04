import { z } from "zod"

export const bookFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  publicationDate: z.string().nullable(),
  authors: z.array(z.string()).nullable(),
  narrators: z.array(z.string()).nullable(),
  creators: z.array(z.string()).nullable(),
  textCover: z.instanceof(File).nullable(),
  audioCover: z.instanceof(File).nullable(),
})

export type BookFormValues = z.infer<typeof bookFormSchema>
