import { useHotkey } from "@tanstack/react-hotkeys"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
// import { BookOpen, FileText, Headphones, RefreshCw, Search } from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v3/_/components/ui/command"

import { useDebounce } from "@/app/(v3)/v3/_/hooks/use-debounce"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import * as icon from "@/icons"
import { api, getCoverUrl } from "@/store/api"


// import { useDebounce}

export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)

  const router = useRouter()
  const { data, isFetching } = api.endpoints.listInfiniteBooks.useInfiniteQuery(
    { search: debouncedSearch || undefined, limit: 10 },
    { skip: !debouncedSearch },
  )

  useHotkey("Mod+K", () => {
    setOpen((prev) => !prev)
  })
  // const [
  //   triggerContentSearch,
  //   { data: contentData, isFetching: isContentFetching },
  // ] = useLazySearchContentQuery()

  // useEffect(() => {
  //   if (debouncedSearch && debouncedSearch.length >= 3) {
  //     triggerContentSearch({ query: debouncedSearch, limit: 5 })
  //   }
  // }, [debouncedSearch, triggerContentSearch])

  const books = data?.pages.flatMap((page) => page) ?? []

  const isLoading = isFetching
  const hasNoResults = debouncedSearch && !isLoading && books.length === 0

  const handleSelectBook = useCallback(
    (book: BookWithRelations) => {
      setOpen(false)
      setSearch("")
      router.push(`/books/${book.uuid}`)
    },
    [router],
  )

  const handleOpenChange = useCallback((open: boolean) => {
    setOpen(open)
    if (!open) {
      setSearch("")
    }
  }, [])

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search"
      description="Search for books by title, author, or content"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search books, authors, or content..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {!debouncedSearch && (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-4">
                <icon.Search className="text-muted-foreground h-8 w-8" />
                <p>Start typing to search...</p>
                <p className="text-muted-foreground text-xs">
                  Search by title, author, or book content
                </p>
              </div>
            </CommandEmpty>
          )}
          {hasNoResults && <CommandEmpty>No results found.</CommandEmpty>}
          {books.length > 0 && (
            <CommandGroup heading="Books">
              {books.map((book) => (
                <CommandItem
                  key={book.uuid}
                  value={`book-${book.uuid}`}
                  onSelect={() => {
                    handleSelectBook(book)
                  }}
                  className="flex items-center gap-3 py-2"
                >
                  <img
                    src={getCoverUrl(book.uuid, {
                      width: 40,
                      height: 60,
                      updatedAt: book.ebook?.updatedAt ?? book.updatedAt,
                    })}
                    alt=""
                    className="h-12 w-8 rounded object-cover"
                  />
                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <span className="truncate font-medium">{book.title}</span>
                    {book.authors.length > 0 && (
                      <span className="text-muted-foreground truncate text-xs">
                        {book.authors.map((a) => a.name).join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {book.readaloud && (
                      <IconReadaloud className="h-3.5 w-3.5 text-orange-500" />
                    )}
                    {book.audiobook && !book.readaloud && (
                      <icon.Headphones className="text-muted-foreground h-3.5 w-3.5" />
                    )}
                    {book.ebook && !book.readaloud && (
                      <icon.BookAlt className="text-muted-foreground h-3.5 w-3.5" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {/* {contentResults.length > 0 && (
            <>
              {books.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Content matches">
                {contentResults.map((result, index) => (
                  <CommandItem
                    key={`content-${result.bookUuid}-${result.spineItemIndex}-${index}`}
                    value={`content-${result.bookUuid}-${index}`}
                    onSelect={() => handleSelectContent(result)}
                    className="flex items-start gap-3 py-2"
                  >
                    <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                      <span className="text-sm font-medium">
                        {result.book.title}
                      </span>
                      <span
                        className="text-muted-foreground line-clamp-2 text-xs"
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                      />
                      {result.book.authors.length > 0 && (
                        <span className="text-muted-foreground text-xs">
                          {result.book.authors.map((a) => a.name).join(", ")}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )} */}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

export function useCommandSearch() {
  const [, setOpen] = useState(false)

  const openSearch = useCallback(() => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }, [])

  return { openSearch, setOpen }
}
