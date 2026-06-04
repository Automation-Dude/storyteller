"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  type FieldPath,
  type UseFormReturn,
  useForm,
} from "react-hook-form"
import { toast } from "sonner"

import { type Role } from "@/components/books/edit/marcRelators"
import { type BookWithRelations } from "@/database/books"
import { useUpdateBookMutation } from "@/store/api"

import { type BookFormValues, bookFormSchema } from "./schema"

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
    textCover: null,
    audioCover: null,
  }
}

type BookFormContextValue = {
  book: BookWithRelations
  form: UseFormReturn<BookFormValues>
  /** whether the current user may edit this book at all */
  canEdit: boolean
  /** global edit mode: every field renders its editor at once */
  isEditing: boolean
  isSaving: boolean
  setIsEditing: (value: boolean) => void
  /** the single field currently being edited inline (outside global mode) */
  editingField: FieldPath<BookFormValues> | null
  setEditingField: (name: FieldPath<BookFormValues> | null) => void
  /** true when a field's editor should be shown (global mode or this field) */
  isFieldActive: (name: FieldPath<BookFormValues>) => boolean
  submitForm: () => Promise<boolean>
  /** validate + save a single field, then leave inline edit mode for it */
  commitField: (name: FieldPath<BookFormValues>) => Promise<boolean>
  /** revert all unsaved changes and exit any inline edit */
  discard: () => void
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
  canEdit?: boolean
  isEditing: boolean
  onEditingChange: (value: boolean) => void
  children: React.ReactNode
}

export function BookFormProvider({
  book,
  canEdit = false,
  isEditing,
  onEditingChange,
  children,
}: BookFormProviderProps) {
  const [updateBook, { isLoading: isSaving }] = useUpdateBookMutation()
  const [editingField, setEditingFieldState] =
    useState<FieldPath<BookFormValues> | null>(null)

  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
    defaultValues: bookToFormValues(book),
  })

  // keep form in sync with book data when the underlying book changes
  useEffect(() => {
    form.reset(bookToFormValues(book))
  }, [book, form])

  const submitFormValues = useCallback(
    async (values: BookFormValues) => {
      const result = await updateBook({
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
          // rating is per-user and submitted separately via setBookRating
        },
        textCover: values.textCover,
        audioCover: values.audioCover,
      })

      return result.error == null
    },
    [book.uuid, updateBook],
  )

  const submitForm = useCallback(async (): Promise<boolean> => {
    let success = false

    await form.handleSubmit(async (values) => {
      success = await submitFormValues(values)
    })()

    return success
  }, [form, submitFormValues])

  const setEditingField = useCallback(
    (name: FieldPath<BookFormValues> | null) => {
      setEditingFieldState(name)
    },
    [],
  )

  const commitField = useCallback(
    async (name: FieldPath<BookFormValues>): Promise<boolean> => {
      const valid = await form.trigger(name)
      if (!valid) return false

      const success = await submitFormValues(form.getValues())
      if (success) {
        setEditingFieldState(null)
      }
      return success
    },
    [form, submitFormValues],
  )

  const setIsEditing = useCallback(
    (value: boolean) => {
      if (value) {
        form.reset(bookToFormValues(book))
      }
      setEditingFieldState(null)
      onEditingChange(value)
    },
    [form, book, onEditingChange],
  )

  const discard = useCallback(() => {
    form.reset(bookToFormValues(book))
    setEditingFieldState(null)
    onEditingChange(false)
  }, [form, book, onEditingChange])

  const isFieldActive = useCallback(
    (name: FieldPath<BookFormValues>) =>
      canEdit && (isEditing || editingField === name),
    [canEdit, isEditing, editingField],
  )

  const errors = form.formState.errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the errors in the form", {
        description: Object.values(errors)
          .map((error) => error.message)
          .filter(Boolean)
          .join(", "),
      })
    }
  }, [errors])

  const contextValue = useMemo(
    () => ({
      book,
      form,
      canEdit,
      isEditing,
      isSaving,
      setIsEditing,
      editingField,
      setEditingField,
      isFieldActive,
      submitForm,
      commitField,
      discard,
    }),
    [
      book,
      form,
      canEdit,
      isEditing,
      isSaving,
      setIsEditing,
      editingField,
      setEditingField,
      isFieldActive,
      submitForm,
      commitField,
      discard,
    ],
  )

  return (
    <BookFormContext.Provider value={contextValue}>
      {children}
    </BookFormContext.Provider>
  )
}
