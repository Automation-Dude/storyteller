"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { createContext, useCallback, useContext, useEffect, useMemo } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"

import { type Role } from "@/components/books/edit/marcRelators"
import { type BookWithRelations } from "@/database/books"
import { useUpdateBookMutation } from "@/store/api"

import { bookFormSchema, type BookFormValues } from "./schema"

function bookToFormValues(book: BookWithRelations): BookFormValues {
  return {
    title: book.title,
    subtitle: book.subtitle,
    description: book.description,
    language: book.language,
    publicationDate: book.publicationDate,
    authors: book.authors.map((a) => a.name),
    narrators: book.narrators.map((n) => n.name),
    creators: book.creators
      .filter((c) => c.role !== "aut" && c.role !== "nrt")
      .map((c) => ({ name: c.name, role: c.role ?? "" })),
    rating: book.rating,
    textCover: null,
    audioCover: null,
  }
}

type BookFormContextValue = {
  book: BookWithRelations
  form: UseFormReturn<BookFormValues>
  isEditing: boolean
  isSaving: boolean
  setIsEditing: (value: boolean) => void
  submitForm: () => Promise<boolean>
  submitPartial: (partial: Partial<BookFormValues>) => Promise<void>
}

const BookFormContext = createContext<BookFormContextValue | null>(null)

export function useBookForm() {
  const context = useContext(BookFormContext)

  if (!context) {
    throw new Error("useBookForm must be used within a BookFormProvider")
  }

  return context
}

type BookFormProviderProps = {
  book: BookWithRelations
  isEditing: boolean
  onEditingChange: (value: boolean) => void
  children: React.ReactNode
}

export function BookFormProvider({
  book,
  isEditing,
  onEditingChange,
  children,
}: BookFormProviderProps) {
  const [updateBook, { isLoading: isSaving }] = useUpdateBookMutation()

  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: bookToFormValues(book),
  })

  // keep form in sync with book data when not editing
  useEffect(() => {
    if (isEditing) return
    form.reset(bookToFormValues(book))
  }, [book, form, isEditing])

  const submitFormValues = useCallback(
    async (values: BookFormValues) => {
      await updateBook({
        update: {
          uuid: book.uuid,
          title: values.title,
          subtitle: values.subtitle,
          description: values.description,
          language: values.language,
          publicationDate: values.publicationDate,
          authors: values.authors,
          narrators: values.narrators,
          creators: values.creators
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name,
              fileAs: c.name,
              role: (c.role || "oth") as Role,
            })),
          rating: values.rating,
        },
        textCover: values.textCover,
        audioCover: values.audioCover,
      })
    },
    [book.uuid, updateBook],
  )

  const submitForm = useCallback(async (): Promise<boolean> => {
    let success = false

    await form.handleSubmit(async (values) => {
      await submitFormValues(values)
      success = true
    })()

    return success
  }, [form, submitFormValues])

  const submitPartial = useCallback(
    async (partial: Partial<BookFormValues>) => {
      for (const [key, value] of Object.entries(partial)) {
        form.setValue(key as keyof BookFormValues, value as never)
      }

      await submitFormValues(form.getValues())
    },
    [form, submitFormValues],
  )

  const setIsEditing = useCallback(
    (value: boolean) => {
      if (value) {
        form.reset(bookToFormValues(book))
      }

      onEditingChange(value)
    },
    [form, book, onEditingChange],
  )

  const contextValue = useMemo(
    () => ({
      book,
      form,
      isEditing,
      isSaving,
      setIsEditing,
      submitForm,
      submitPartial,
    }),
    [book, form, isEditing, isSaving, setIsEditing, submitForm, submitPartial],
  )

  return (
    <BookFormContext.Provider value={contextValue}>
      {children}
    </BookFormContext.Provider>
  )
}
