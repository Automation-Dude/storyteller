"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { IconLoader2, IconPlus, IconSearch, IconX } from "@tabler/icons-react"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import { Input } from "@v3/_/components/ui/input"
import { Label } from "@v3/_/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { Textarea } from "@v3/_/components/ui/textarea"

import { type BookWithRelations } from "@/database/books"
import { type ShelfFilterNode } from "@/database/shelfFilter"
import { type ShelfOrderBy, type ShelfWithBooks } from "@/database/shelves"
import {
  getCoverUrl,
  useCreateUserShelfMutation,
  useListBooksQuery,
  useUpdateUserShelfMutation,
} from "@/store/api"

import { ShelfFilterEditor } from "./ShelfFilterEditor"

const shelfFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  orderBy: z.enum([
    "createdAt",
    "updatedAt",
    "title",
    "publicationDate",
    "rating",
  ]),
  orderDirection: z.enum(["asc", "desc"]),
  limitCount: z.number().nullable(),
})

type ShelfFormValues = z.infer<typeof shelfFormSchema>

type ShelfEditorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shelf?: ShelfWithBooks | null
  onSaved?: (shelf: ShelfWithBooks) => void
}

type SelectionMode = "filter" | "manual"

export function ShelfEditor({
  open,
  onOpenChange,
  shelf,
  onSaved,
}: ShelfEditorProps) {
  const isEditing = !!shelf

  const initialMode: SelectionMode =
    shelf?.filter !== null
      ? "filter"
      : shelf.books.length > 0
        ? "manual"
        : "filter"

  const [selectionMode, setSelectionMode] = useState<SelectionMode>(initialMode)

  const [filter, setFilter] = useState<ShelfFilterNode | null>(
    shelf?.filter ?? null,
  )

  const [selectedBookUuids, setSelectedBookUuids] = useState<string[]>(
    shelf?.books.map((b) => b.bookUuid) ?? [],
  )

  const form = useForm<ShelfFormValues>({
    resolver: zodResolver(shelfFormSchema),
    defaultValues: {
      name: shelf?.name ?? "",
      description: shelf?.description ?? "",
      orderBy: shelf?.orderBy ?? "createdAt",
      orderDirection: shelf?.orderDirection ?? "desc",
      limitCount: shelf?.limitCount ?? null,
    },
  })

  useEffect(() => {
    if (open && shelf) {
      form.reset({
        name: shelf.name,
        description: shelf.description ?? "",
        orderBy: shelf.orderBy ?? "createdAt",
        orderDirection: shelf.orderDirection ?? "desc",
        limitCount: shelf.limitCount ?? null,
      })

      setFilter(shelf.filter ?? null)
      setSelectedBookUuids(shelf.books.map((b) => b.bookUuid))

      setSelectionMode(
        shelf.filter !== null
          ? "filter"
          : shelf.books.length > 0
            ? "manual"
            : "filter",
      )
    } else if (open && !shelf) {
      form.reset({
        name: "",
        description: "",
        orderBy: "createdAt",
        orderDirection: "desc",
        limitCount: null,
      })

      setFilter(null)
      setSelectedBookUuids([])
      setSelectionMode("filter")
    }
  }, [open, shelf, form])

  const [createShelf, { isLoading: isCreating }] = useCreateUserShelfMutation()
  const [updateShelf, { isLoading: isUpdating }] = useUpdateUserShelfMutation()

  const isSaving = isCreating || isUpdating

  const handleSubmit = form.handleSubmit(async (data: ShelfFormValues) => {
    try {
      const payload = {
        name: data["name"].trim(),
        description: data["description"]?.trim() || null,
        filter: selectionMode === "filter" ? filter : null,
        orderBy: data["orderBy"] as ShelfOrderBy,
        orderDirection: data["orderDirection"],
        limitCount: data["limitCount"],
        books: selectionMode === "manual" ? selectedBookUuids : [],
      }

      if (isEditing) {
        const updated = await updateShelf({
          uuid: shelf.uuid,
          ...payload,
        }).unwrap()

        onSaved?.(updated)
      } else {
        const created = await createShelf(payload).unwrap()
        onSaved?.(created)
      }

      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save shelf:", error)
    }
  })

  const handleModeChange = (mode: SelectionMode) => {
    setSelectionMode(mode)

    if (mode === "filter") {
      setSelectedBookUuids([])
    } else {
      setFilter(null)
    }
  }

  const addBook = (uuid: string) => {
    if (!selectedBookUuids.includes(uuid)) {
      setSelectedBookUuids([...selectedBookUuids, uuid])
    }
  }

  const removeBook = (uuid: string) => {
    setSelectedBookUuids(selectedBookUuids.filter((u) => u !== uuid))
  }

  const orderBy = useWatch({ control: form.control, name: "orderBy" })
  const orderDirection = useWatch({
    control: form.control,
    name: "orderDirection",
  })
  const limitCount = useWatch({ control: form.control, name: "limitCount" })

  const hasNonDefaultSort =
    orderBy !== "createdAt" || orderDirection !== "desc" || limitCount !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Shelf" : "Create Shelf"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update your shelf settings."
                : "Create a shelf with dynamic filters or manual selection."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shelf-name">Name</Label>
              <Input
                id="shelf-name"
                {...form.register("name")}
                placeholder="My Shelf"
              />
              {form.formState.errors.name && (
                <span className="text-destructive text-xs">
                  {form.formState.errors.name.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shelf-description">Description</Label>
              <Textarea
                id="shelf-description"
                {...form.register("description")}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Book Selection</Label>

                <div className="flex items-center gap-2">
                  {filter !== null && selectionMode === "filter" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilter(null)
                      }}
                      className="h-6 gap-1 text-xs"
                    >
                      <IconX className="size-3" />
                      Clear filter
                    </Button>
                  )}

                  <div className="bg-muted flex rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleModeChange("filter")
                      }}
                      className={`rounded px-2 py-1 text-xs transition-colors ${
                        selectionMode === "filter"
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      Dynamic Filter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleModeChange("manual")
                      }}
                      className={`rounded px-2 py-1 text-xs transition-colors ${
                        selectionMode === "manual"
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>
              </div>

              {selectionMode === "filter" && (
                <ShelfFilterEditor
                  filter={filter}
                  onChange={setFilter}
                  orderBy={orderBy}
                  orderDirection={orderDirection}
                  limitCount={limitCount}
                />
              )}

              {selectionMode === "manual" && (
                <div className="flex flex-col gap-2">
                  {selectedBookUuids.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBookUuids([])
                        }}
                        className="h-6 gap-1 text-xs"
                      >
                        <IconX className="size-3" />
                        Clear selection
                      </Button>
                    </div>
                  )}

                  <BookSelector
                    selectedBookUuids={selectedBookUuids}
                    onAdd={addBook}
                    onRemove={removeBook}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Sort & Limit</Label>

                {hasNonDefaultSort && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      form.setValue("orderBy", "createdAt")
                      form.setValue("orderDirection", "desc")
                      form.setValue("limitCount", null)
                    }}
                    className="h-6 gap-1 text-xs"
                  >
                    <IconX className="size-3" />
                    Reset
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-muted-foreground text-xs">
                    Sort by
                  </Label>
                  <Select
                    value={orderBy}
                    onValueChange={(v) => {
                      if (!v) return
                      form.setValue("orderBy", v)
                    }}
                  >
                    <SelectTrigger className="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="createdAt">Date Added</SelectItem>
                      <SelectItem value="updatedAt">Date Updated</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="publicationDate">
                        Publication Date
                      </SelectItem>
                      <SelectItem value="rating">Rating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Select
                  value={orderDirection}
                  onValueChange={(v) => {
                    form.setValue("orderDirection", v as "asc" | "desc")
                  }}
                >
                  <SelectTrigger className="h-7 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descending</SelectItem>
                    <SelectItem value="asc">Ascending</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                  <Label className="text-muted-foreground text-xs">Limit</Label>
                  <Input
                    type="number"
                    className="h-7 w-16 text-xs"
                    value={limitCount ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                      form.setValue(
                        "limitCount",
                        val === "" ? null : parseInt(val, 10),
                      )
                    }}
                    placeholder="All"
                    min={1}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <IconLoader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type BookSelectorProps = {
  selectedBookUuids: string[]
  onAdd: (uuid: string) => void
  onRemove: (uuid: string) => void
}

function BookSelector({
  selectedBookUuids,
  onAdd,
  onRemove,
}: BookSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const { data: allBooks = [], isLoading } = useListBooksQuery()

  const selectedBooks = useMemo(() => {
    return selectedBookUuids
      .map((uuid) => allBooks.find((b) => b.uuid === uuid))
      .filter((b): b is BookWithRelations => b !== undefined)
  }, [allBooks, selectedBookUuids])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase()

    return allBooks
      .filter(
        (book) =>
          !selectedBookUuids.includes(book.uuid) &&
          (book.title.toLowerCase().includes(query) ||
            book.authors.some((a) => a.name.toLowerCase().includes(query))),
      )
      .slice(0, 10)
  }, [allBooks, searchQuery, selectedBookUuids])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <IconSearch className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
          }}
          placeholder="Search by title or author..."
          className="pl-8"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <IconLoader2 className="size-4 animate-spin" />
        </div>
      )}

      {searchQuery.trim() && searchResults.length === 0 && !isLoading && (
        <div className="text-muted-foreground py-2 text-center text-sm">
          No books found
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="scroll-y flex max-h-[140px] flex-col gap-0.5">
          {searchResults.map((book) => (
            <BookListItem
              key={book.uuid}
              book={book}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    onAdd(book.uuid)
                  }}
                >
                  <IconPlus className="size-3" />
                </Button>
              }
            />
          ))}
        </div>
      )}

      {selectedBooks.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label className="text-muted-foreground text-xs">
            {selectedBooks.length} selected
          </Label>

          <div className="scroll-y flex max-h-[140px] flex-col gap-0.5">
            {selectedBooks.map((book) => (
              <BookListItem
                key={book.uuid}
                book={book}
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      onRemove(book.uuid)
                    }}
                  >
                    <IconX className="size-3" />
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      )}

      {selectedBooks.length === 0 && !searchQuery.trim() && (
        <div className="text-muted-foreground py-2 text-center text-xs">
          Search to add books to this shelf
        </div>
      )}
    </div>
  )
}

type BookListItemProps = {
  book: BookWithRelations
  action: React.ReactNode
}

function BookListItem({ book, action }: BookListItemProps) {
  const authorNames = book.authors.map((a) => a.name).join(", ")

  return (
    <div className="hover:bg-muted/50 flex items-center gap-2 rounded-md py-1 pr-1 pl-1">
      <img
        src={getCoverUrl(book.uuid, { height: 32, updatedAt: book.updatedAt })}
        alt=""
        className="h-8 w-6 rounded object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{book.title}</div>
        {authorNames && (
          <div className="text-muted-foreground truncate text-xs">
            {authorNames}
          </div>
        )}
      </div>

      {action}
    </div>
  )
}
