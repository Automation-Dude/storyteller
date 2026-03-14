import { CSS } from "@dnd-kit/utilities"
import {
  type ColumnDef,
  type Header,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Reorder, isDragging, useDragControls } from "framer-motion"
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  GripVertical,
  Headphones,
  Loader2,
  RefreshCw,
  Search,
  Star,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Link } from "react-router"

import { getCoverUrl } from "@/api/api"
import type { BookWithRelations } from "@/api/models/books"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useOptionalBookSelection } from "@/hooks/useBookSelection"
import { cn } from "@/lib/utils"
import {
  type BookColumn,
  type SortableColumn,
  isSortableColumn,
  selectTableColumns,
  viewSettingsSlice,
} from "@/store/slices/viewSettingsSlice"

type SortDirection = "asc" | "desc"

type BookTableProps = {
  books: BookWithRelations[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  showMuted: boolean
  emptyMessage?: string | undefined
  emptySubMessage?: string | undefined
  onClearFilters?: () => void
  hasActiveFilters?: boolean
  sortField?: SortableColumn
  sortDirection?: SortDirection
  onSortChange?: (field: SortableColumn, direction: SortDirection) => void
}

function CoverCell({ book }: { book: BookWithRelations }) {
  const [coverError, setCoverError] = useState(false)
  const hasAudiobook = book.audiobook !== null
  const hasEbook = book.ebook !== null

  const coverUrl = getCoverUrl(book.uuid, {
    width: 60,
    height: 90,
    audio: hasAudiobook && !hasEbook,
    version:
      book.ebook?.updatedAt ?? book.audiobook?.updatedAt ?? book.updatedAt,
  })

  if (coverError) {
    return (
      <div className="bg-muted flex h-12 w-8 items-center justify-center rounded">
        <BookOpen className="text-muted-foreground/50 h-4 w-4" />
      </div>
    )
  }

  return (
    <img
      src={coverUrl}
      alt=""
      loading="lazy"
      onError={() => {
        setCoverError(true)
      }}
      className="h-12 w-8 rounded object-cover"
    />
  )
}

function TitleCell({ book }: { book: BookWithRelations }) {
  return (
    <Link
      to={`/books/${book.uuid}`}
      prefetch="intent"
      className="hover:text-primary font-medium hover:underline"
    >
      {book.title}
    </Link>
  )
}

function AuthorsCell({ book }: { book: BookWithRelations }) {
  return (
    <span className="text-muted-foreground">
      {book.authors.map((a) => a.name).join(", ") || "-"}
    </span>
  )
}

function NarratorsCell({ book }: { book: BookWithRelations }) {
  return (
    <span className="text-muted-foreground">
      {book.narrators.map((n) => n.name).join(", ") || "-"}
    </span>
  )
}

function SeriesCell({ book }: { book: BookWithRelations }) {
  const primarySeries = book.series.find((s) => s.featured) ?? book.series[0]
  if (!primarySeries) return <span className="text-muted-foreground">-</span>

  return (
    <span>
      {primarySeries.name}
      {primarySeries.position && (
        <span className="text-muted-foreground">
          {" "}
          #{primarySeries.position}
        </span>
      )}
    </span>
  )
}

function CollectionsCell({ book }: { book: BookWithRelations }) {
  if (book.collections.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {book.collections.slice(0, 2).map((c) => (
        <Badge key={String(c.uuid)} variant="outline" className="text-xs">
          {c.name}
        </Badge>
      ))}
      {book.collections.length > 2 && (
        <Badge variant="outline" className="text-xs">
          +{book.collections.length - 2}
        </Badge>
      )}
    </div>
  )
}

function TagsCell({ book }: { book: BookWithRelations }) {
  if (book.tags.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {book.tags.slice(0, 2).map((t) => (
        <Badge key={String(t.uuid)} variant="secondary" className="text-xs">
          {t.name}
        </Badge>
      ))}
      {book.tags.length > 2 && (
        <Badge variant="secondary" className="text-xs">
          +{book.tags.length - 2}
        </Badge>
      )}
    </div>
  )
}

function StatusCell({ book }: { book: BookWithRelations }) {
  if (!book.status) return <span className="text-muted-foreground">-</span>
  return <Badge variant="outline">{book.status.name}</Badge>
}

function MediaTypeCell({ book }: { book: BookWithRelations }) {
  const hasAudiobook = book.audiobook !== null
  const hasEbook = book.ebook !== null
  const isSynced =
    book.readaloud !== null && book.readaloud?.status === "ALIGNED"

  if (isSynced) {
    return (
      <Badge variant="secondary" className="gap-1">
        <RefreshCw className="h-3 w-3" />
        ReadAloud
      </Badge>
    )
  }

  return (
    <div className="flex gap-1">
      {hasEbook && (
        <Badge variant="outline" className="gap-1">
          <BookOpen className="h-3 w-3" />
        </Badge>
      )}
      {hasAudiobook && (
        <Badge variant="outline" className="gap-1">
          <Headphones className="h-3 w-3" />
        </Badge>
      )}
    </div>
  )
}

function DateCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">-</span>

  const formatted = new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  return <span className="text-muted-foreground">{formatted}</span>
}

function RatingCell({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-muted-foreground">-</span>

  return (
    <div className="flex items-center gap-1">
      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      <span>{rating}</span>
    </div>
  )
}

function LanguageCell({ language }: { language: string | null }) {
  if (!language) return <span className="text-muted-foreground">-</span>
  return <span className="text-muted-foreground">{language}</span>
}

type ColumnMeta = {
  sortable: boolean
  columnId: BookColumn
  label: string
}

const columnDefinitions: Record<
  BookColumn,
  Omit<ColumnDef<BookWithRelations>, "header"> & { meta: ColumnMeta }
> = {
  cover: {
    id: "cover",
    cell: ({ row }) => <CoverCell book={row.original} />,
    size: 50,
    enableResizing: false,
    meta: { sortable: false, columnId: "cover", label: "" },
  },
  title: {
    id: "title",
    cell: ({ row }) => <TitleCell book={row.original} />,
    size: 200,
    meta: { sortable: true, columnId: "title", label: "Title" },
  },
  authors: {
    id: "authors",
    cell: ({ row }) => <AuthorsCell book={row.original} />,
    size: 150,
    meta: { sortable: false, columnId: "authors", label: "Authors" },
  },
  narrators: {
    id: "narrators",
    cell: ({ row }) => <NarratorsCell book={row.original} />,
    size: 150,
    meta: { sortable: false, columnId: "narrators", label: "Narrators" },
  },
  series: {
    id: "series",
    cell: ({ row }) => <SeriesCell book={row.original} />,
    size: 150,
    meta: { sortable: false, columnId: "series", label: "Series" },
  },
  collections: {
    id: "collections",
    cell: ({ row }) => <CollectionsCell book={row.original} />,
    size: 150,
    meta: { sortable: false, columnId: "collections", label: "Collections" },
  },
  tags: {
    id: "tags",
    cell: ({ row }) => <TagsCell book={row.original} />,
    size: 150,
    meta: { sortable: false, columnId: "tags", label: "Tags" },
  },
  status: {
    id: "status",
    cell: ({ row }) => <StatusCell book={row.original} />,
    size: 100,
    meta: { sortable: false, columnId: "status", label: "Status" },
  },
  mediaType: {
    id: "mediaType",
    cell: ({ row }) => <MediaTypeCell book={row.original} />,
    size: 100,
    meta: { sortable: false, columnId: "mediaType", label: "Media" },
  },
  createdAt: {
    id: "createdAt",
    cell: ({ row }) => <DateCell date={row.original.createdAt} />,
    size: 100,
    meta: { sortable: true, columnId: "createdAt", label: "Added" },
  },
  updatedAt: {
    id: "updatedAt",
    cell: ({ row }) => <DateCell date={row.original.updatedAt} />,
    size: 100,
    meta: { sortable: true, columnId: "updatedAt", label: "Updated" },
  },
  publicationDate: {
    id: "publicationDate",
    cell: ({ row }) => <DateCell date={row.original.publicationDate} />,
    size: 100,
    meta: { sortable: true, columnId: "publicationDate", label: "Published" },
  },
  language: {
    id: "language",
    cell: ({ row }) => <LanguageCell language={row.original.language} />,
    size: 80,
    meta: { sortable: false, columnId: "language", label: "Language" },
  },
  rating: {
    id: "rating",
    cell: ({ row }) => <RatingCell rating={row.original.rating} />,
    size: 70,
    meta: { sortable: false, columnId: "rating", label: "Rating" },
  },
}

function SelectionColumn(): ColumnDef<BookWithRelations> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    size: 40,
    enableResizing: false,
  }
}

function SortableHeader({
  header,
  sortField,
  sortDirection,
  onSortChange,
}: {
  header: Header<BookWithRelations, unknown>
  sortField?: SortableColumn | undefined
  sortDirection?: SortDirection | undefined
  onSortChange?:
    | ((field: SortableColumn, direction: SortDirection) => void)
    | undefined
}) {
  const meta = header.column.columnDef.meta as ColumnMeta | undefined
  const columnId = meta?.columnId
  const isSortable = meta?.sortable && columnId && isSortableColumn(columnId)
  const isCurrentSort = sortField === columnId

  // const style = {
  //   transform: CSS.Transform.toString(transform),
  //   transition,
  //   width:
  //     header.column.columnDef.size !== 150
  //       ? header.column.columnDef.size
  //       : undefined,
  // }

  const handleSort = () => {
    if (!isSortable || !onSortChange || !columnId) return

    if (isCurrentSort) {
      onSortChange(columnId, sortDirection === "asc" ? "desc" : "asc")
    } else {
      onSortChange(columnId, "desc")
    }
  }

  const controls = useDragControls()

  if (header.isPlaceholder)
    return (
      <TableHead
        style={{
          width:
            header.column.columnDef.size !== 150
              ? header.column.columnDef.size
              : undefined,
        }}
      ></TableHead>
    )

  const content = (
    <div className="flex items-center gap-1">
      {columnId && columnId !== "cover" && (
        <span
          // {...attributes}
          // {...listeners}
          onPointerDown={(e) => controls.start(e)}
          className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab"
        >
          <GripVertical className="h-3 w-3" />
        </span>
      )}
      <span className={cn(isSortable && "cursor-pointer")} onClick={handleSort}>
        {meta?.label}
      </span>
      {isCurrentSort && (
        <span className="text-muted-foreground">
          {sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
        </span>
      )}
    </div>
  )

  return (
    <Reorder.Item
      value={columnId}
      as="th"
      dragControls={controls}
      dragListener={false}
      style={{
        width:
          header.column.columnDef.size !== 150
            ? header.column.columnDef.size
            : undefined,
      }}
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        isDragging && "opacity-50",
      )}
    >
      {content}
    </Reorder.Item>
  )
}

function TableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columnCount }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columnCount }).map((_, cellIndex) => (
                <TableCell key={cellIndex}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function BookTable({
  books,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  showMuted,
  emptyMessage = "No books found",
  emptySubMessage,
  onClearFilters,
  hasActiveFilters,
  sortField,
  sortDirection,
  onSortChange,
}: BookTableProps) {
  const dispatch = useDispatch()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const tableColumns = useSelector(selectTableColumns)

  const selection = useOptionalBookSelection()
  const isSelecting = selection?.isSelecting ?? false
  const isSelected = selection?.isSelected ?? (() => false)
  const toggleSelection = selection?.toggleSelection ?? (() => {})

  // const sensors = useSensors(
  //   useSensor(MouseSensor, {
  //     activationConstraint: { distance: 5 },
  //   }),
  //   useSensor(TouchSensor, {
  //     activationConstraint: { delay: 250, tolerance: 5 },
  //   }),
  //   useSensor(KeyboardSensor),
  // )

  const columns = useMemo(() => {
    const cols: ColumnDef<BookWithRelations>[] = []

    if (isSelecting) {
      cols.push(SelectionColumn())
    }

    for (const colId of tableColumns) {
      const def = columnDefinitions[colId]
      if (def) {
        cols.push({
          ...def,
          header: def.meta.label,
        } as ColumnDef<BookWithRelations>)
      }
    }

    return cols
  }, [tableColumns, isSelecting])

  const table = useReactTable({
    data: books,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.uuid,
  })

  const handleDragEnd = useCallback(
    (newOrder: BookColumn[]) => {
      // const { active, over } = event
      // if (!over || active.id === over.id) return

      // const oldIndex = tableColumns.indexOf(active.id as BookColumn)
      // const newIndex = tableColumns.indexOf(over.id as BookColumn)

      // if (oldIndex !== -1 && newIndex !== -1) {
      //   const newColumns = arrayMove(tableColumns, oldIndex, newIndex)
      dispatch(viewSettingsSlice.actions.setTableColumns(newOrder))
      // }
    },
    [tableColumns, dispatch],
  )

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )

  useEffect(() => {
    const element = loadMoreRef.current
    if (!element) return

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    })

    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [handleObserver])

  if (isLoading) {
    return <TableSkeleton columnCount={tableColumns.length} />
  }

  if (books.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
        <Search className="h-12 w-12 opacity-40" />
        <p className="text-lg font-medium">{emptyMessage}</p>
        {emptySubMessage && <p className="text-sm">{emptySubMessage}</p>}
        {hasActiveFilters && onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="mt-2"
          >
            Clear Filters
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-opacity duration-200",
          showMuted && "opacity-60",
        )}
      >
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <Reorder.Group
                values={tableColumns}
                onReorder={handleDragEnd}
                axis="x"
                as="tr"
                key={headerGroup.id}
                data-slot="table-row"
                className={cn(
                  "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
                )}
              >
                {headerGroup.headers.map((header) => (
                  <SortableHeader
                    key={header.id}
                    header={header}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSortChange={onSortChange}
                  />
                ))}
              </Reorder.Group>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={isSelected(row.original.uuid) && "selected"}
                className={cn(
                  showMuted && "opacity-60",
                  isSelecting && "cursor-pointer",
                )}
                onClick={
                  isSelecting
                    ? () => toggleSelection(row.original.uuid)
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div ref={loadMoreRef} className="mt-8 flex justify-center">
        {isFetchingNextPage && (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </>
  )
}
