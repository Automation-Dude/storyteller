"use client"

import { IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { Input } from "@v3/_/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { cn } from "@v3/_/lib/utils"

import { type BookWithRelations } from "@/database/books"
import {
  FIELD_LABELS,
  MEDIA_TYPE_VALUES,
  OPERATOR_LABELS,
  type ShelfFilterAnd,
  type ShelfFilterCondition,
  type ShelfFilterField,
  type ShelfFilterNode,
  type ShelfFilterNot,
  type ShelfFilterOperator,
  type ShelfFilterOr,
  createAndBlock,
  createEmptyCondition,
  createNotBlock,
  createOrBlock,
  getFieldType,
  getOperatorsForField,
  operatorRequiresArrayValue,
  operatorRequiresRangeValue,
  operatorRequiresValue,
} from "@/database/shelfFilter"
import { type ShelfOrderBy } from "@/database/shelves"
import {
  getCoverUrl,
  useListCollectionsQuery,
  useListCreatorsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
  useListTagsQuery,
  usePreviewShelfFilterMutation,
} from "@/store/api"

type ShelfFilterEditorProps = {
  filter: ShelfFilterNode | null
  onChange: (filter: ShelfFilterNode | null) => void
  orderBy?: ShelfOrderBy
  orderDirection?: "asc" | "desc"
  limitCount?: number | null
}

function isFilterValid(node: ShelfFilterNode | null): boolean {
  if (!node) return false

  if (node.type === "condition") {
    if (!operatorRequiresValue(node.operator)) return true
    if (node.value === undefined || node.value === null) return false
    if (typeof node.value === "string" && node.value.trim() === "") return false
    if (Array.isArray(node.value) && node.value.length === 0) return false
    return true
  }

  if (node.type === "not") {
    return isFilterValid(node.child)
  }

  if (node.children.length === 0) return false
  return node.children.every((child) => isFilterValid(child))
}

export function ShelfFilterEditor({
  filter,
  onChange,
  orderBy = "createdAt",
  orderDirection = "desc",
  limitCount,
}: ShelfFilterEditorProps) {
  const [previewBooks, setPreviewBooks] = useState<BookWithRelations[]>([])
  const [previewFilter, { isLoading: isLoadingPreview }] =
    usePreviewShelfFilterMutation()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filterValid = isFilterValid(filter)

  const runPreview = useCallback(async () => {
    if (!filter || !filterValid) {
      setPreviewBooks([])
      return
    }

    try {
      const books = await previewFilter({
        filter,
        orderBy,
        orderDirection,
        limit: limitCount ?? 20,
      }).unwrap()

      setPreviewBooks(books)
    } catch (error) {
      console.error("Failed to preview filter:", error)
    }
  }, [filter, filterValid, orderBy, orderDirection, limitCount, previewFilter])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      void runPreview()
    }, 400)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [runPreview])

  if (!filter) {
    return (
      <div className="flex flex-col gap-3">
        <AddNodeDropdown onAdd={onChange} />
        <FilterPreview books={[]} isLoading={false} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterNodeEditor
        node={filter}
        onChange={onChange}
        onRemove={() => {
          onChange(null)
        }}
        isRoot
      />

      <FilterPreview
        books={previewBooks}
        isLoading={isLoadingPreview}
        isInvalid={!filterValid}
      />
    </div>
  )
}

type AddNodeDropdownProps = {
  onAdd: (node: ShelfFilterNode) => void
}

function AddNodeDropdown({ onAdd }: AddNodeDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 w-fit gap-1 text-xs">
            <IconPlus className="size-3" />
            Add
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => {
            onAdd(createEmptyCondition())
          }}
        >
          Condition
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onAdd(createAndBlock())
          }}
        >
          AND group
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onAdd(createOrBlock())
          }}
        >
          OR group
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onAdd(createNotBlock())
          }}
        >
          NOT
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type FilterPreviewProps = {
  books: BookWithRelations[]
  isLoading: boolean
  isInvalid?: boolean
}

function FilterPreview({ books, isLoading, isInvalid }: FilterPreviewProps) {
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-2 text-xs">
        <IconLoader2 className="size-3 animate-spin" />
        Loading preview...
      </div>
    )
  }

  if (isInvalid) {
    return (
      <div className="text-muted-foreground py-2 text-xs">
        Complete the filter to see preview
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-muted-foreground py-2 text-xs">
        No books match this filter
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-1 overflow-x-clip">
      <div className="text-muted-foreground text-xs">
        {books.length} book{books.length !== 1 ? "s" : ""} match
      </div>

      <div className="scroll-y max-h-[160px] max-w-full">
        {books.map((book) => (
          <PreviewBookItem key={book.uuid} book={book} />
        ))}
      </div>
    </div>
  )
}

function PreviewBookItem({ book }: { book: BookWithRelations }) {
  const authorNames = book.authors.map((a) => a.name).join(", ")

  return (
    <div className="flex items-center gap-2 py-1">
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
    </div>
  )
}

type FilterNodeEditorProps = {
  node: ShelfFilterNode
  onChange: (node: ShelfFilterNode) => void
  onRemove: () => void
  isRoot?: boolean
}

function FilterNodeEditor({
  node,
  onChange,
  onRemove,
  isRoot = false,
}: FilterNodeEditorProps) {
  if (node.type === "condition") {
    return (
      <ConditionEditor
        condition={node}
        onChange={onChange}
        onRemove={onRemove}
      />
    )
  }

  if (node.type === "not") {
    return (
      <NotBlockEditor
        block={node}
        onChange={onChange}
        onRemove={onRemove}
        isRoot={isRoot}
      />
    )
  }

  return (
    <LogicalBlockEditor
      block={node}
      onChange={onChange}
      onRemove={onRemove}
      isRoot={isRoot}
    />
  )
}

type LogicalBlockEditorProps = {
  block: ShelfFilterAnd | ShelfFilterOr
  onChange: (block: ShelfFilterNode) => void
  onRemove: () => void
  isRoot?: boolean
}

function LogicalBlockEditor({
  block,
  onChange,
  onRemove,
  isRoot = false,
}: LogicalBlockEditorProps) {
  const handleTypeChange = (newType: "and" | "or") => {
    onChange({ ...block, type: newType })
  }

  const handleChildChange = (index: number, child: ShelfFilterNode) => {
    const newChildren = [...block.children]
    newChildren[index] = child
    onChange({ ...block, children: newChildren })
  }

  const handleChildRemove = (index: number) => {
    const newChildren = block.children.filter((_, i) => i !== index)

    if (newChildren.length === 0) {
      onRemove()
      return
    }

    onChange({ ...block, children: newChildren })
  }

  const handleAddNode = (node: ShelfFilterNode) => {
    onChange({ ...block, children: [...block.children, node] })
  }

  const items = [
    { value: "and", label: "AND" },
    { value: "or", label: "OR" },
  ]

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Select
          value={block.type}
          onValueChange={(v) => {
            handleTypeChange(v as "and" | "or")
          }}
          items={items}
        >
          <SelectTrigger className="h-6 w-16 text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground text-xs">
          {block.type === "and" ? "all match" : "any match"}
        </span>

        {!isRoot && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            className="ml-auto"
          >
            <IconTrash className="size-3" />
          </Button>
        )}
      </div>

      <div
        className={cn(
          "border-muted flex flex-col gap-1",
          !isRoot ? "ml-3 border-l pl-3" : "",
        )}
      >
        {block.children.map((child, index) => (
          <FilterNodeEditor
            key={index}
            node={child}
            onChange={(newChild) => {
              handleChildChange(index, newChild)
            }}
            onRemove={() => {
              handleChildRemove(index)
            }}
          />
        ))}

        <AddNodeDropdown onAdd={handleAddNode} />
      </div>
    </div>
  )
}

type NotBlockEditorProps = {
  block: ShelfFilterNot
  onChange: (block: ShelfFilterNode) => void
  onRemove: () => void
  isRoot?: boolean
}

function NotBlockEditor({
  block,
  onChange,
  onRemove,
  isRoot = false,
}: NotBlockEditorProps) {
  const handleChildChange = (child: ShelfFilterNode) => {
    onChange({ ...block, child })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">NOT</span>
        <span className="text-muted-foreground text-xs">must not match</span>

        {!isRoot && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            className="ml-auto"
          >
            <IconTrash className="size-3" />
          </Button>
        )}
      </div>

      <div className="border-muted ml-3 border-l pl-3">
        <FilterNodeEditor
          node={block.child}
          onChange={handleChildChange}
          onRemove={onRemove}
        />
      </div>
    </div>
  )
}

type ConditionEditorProps = {
  condition: ShelfFilterCondition
  onChange: (condition: ShelfFilterNode) => void
  onRemove: () => void
}

function ConditionEditor({
  condition,
  onChange,
  onRemove,
}: ConditionEditorProps) {
  const operators = getOperatorsForField(condition.field)
  const fieldType = getFieldType(condition.field)
  const needsValue = operatorRequiresValue(condition.operator)
  const needsArrayValue = operatorRequiresArrayValue(condition.operator)
  const needsRangeValue = operatorRequiresRangeValue(condition.operator)

  const hasValidValue =
    !needsValue ||
    (condition.value !== undefined &&
      condition.value !== null &&
      (typeof condition.value !== "string" || condition.value.trim() !== "") &&
      (!Array.isArray(condition.value) || condition.value.length > 0))

  const handleFieldChange = (field: ShelfFilterField) => {
    const newOperators = getOperatorsForField(field)
    const newOperator = newOperators.includes(condition.operator)
      ? condition.operator
      : newOperators[0] ?? "is"

    onChange({
      ...condition,
      field,
      operator: newOperator,
      value: undefined,
    })
  }

  const handleOperatorChange = (operator: ShelfFilterOperator) => {
    onChange({
      ...condition,
      operator,
      value: operatorRequiresValue(operator) ? condition.value : undefined,
    })
  }

  const handleValueChange = (
    value: string | number | (string | number)[] | null,
  ) => {
    onChange({ ...condition, value: value ?? undefined })
  }

  const fieldItems = Object.entries(FIELD_LABELS).map(([field, label]) => ({
    value: field,
    label,
  }))

  const operatorItems = operators.map((op) => ({
    value: op,
    label: OPERATOR_LABELS[op],
  }))

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 py-1",
        !hasValidValue && "opacity-60",
      )}
    >
      <Select
        value={condition.field}
        onValueChange={(v) => {
          handleFieldChange(v as ShelfFilterField)
        }}
        items={fieldItems}
      >
        <SelectTrigger className="h-7 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fieldItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(v) => {
          handleOperatorChange(v as ShelfFilterOperator)
        }}
        items={operatorItems}
      >
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operatorItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsValue && (
        <div className="min-w-[140px] flex-1">
          <ConditionValueInput
            field={condition.field}
            fieldType={fieldType}
            isArray={needsArrayValue}
            isRange={needsRangeValue}
            value={condition.value}
            onChange={handleValueChange}
          />
        </div>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        className="shrink-0"
      >
        <IconTrash className="size-3" />
      </Button>
    </div>
  )
}

type ConditionValueInputProps = {
  field: ShelfFilterField
  fieldType: "string" | "number" | "date" | "uuid" | "array" | "enum"
  isArray: boolean
  isRange: boolean
  value:
    | string
    | number
    | (string | number)[]
    | [string, string]
    | [number, number]
    | null
    | undefined
  onChange: (value: string | number | (string | number)[] | null) => void
}

type NumericFieldConfig = {
  step: number
  min: number
  defaultMax: number
  placeholder: string
  unit?: string
  rangeSeparator: string
}

function getNumericFieldConfig(field: ShelfFilterField): NumericFieldConfig {
  switch (field) {
    case "rating":
    case "userRating":
      return {
        step: 0.5,
        min: 0,
        defaultMax: 5,
        placeholder: "Rating...",
        rangeSeparator: "to",
      }

    case "duration":
      return {
        step: 60,
        min: 0,
        defaultMax: 36000,
        placeholder: "Seconds...",
        unit: "sec",
        rangeSeparator: "to",
      }

    case "pageCount":
      return {
        step: 1,
        min: 0,
        defaultMax: 1000,
        placeholder: "Pages...",
        unit: "pages",
        rangeSeparator: "to",
      }

    case "fileSize":
      return {
        step: 1048576,
        min: 0,
        defaultMax: 1073741824,
        placeholder: "Bytes...",
        unit: "bytes",
        rangeSeparator: "to",
      }

    default:
      return {
        step: 1,
        min: 0,
        defaultMax: 100,
        placeholder: "Value...",
        rangeSeparator: "to",
      }
  }
}

function ConditionValueInput({
  field,
  fieldType,
  isArray,
  isRange,
  value,
  onChange,
}: ConditionValueInputProps) {
  const { data: tags = [] } = useListTagsQuery()
  const { data: collections = [] } = useListCollectionsQuery()
  const { data: series = [] } = useListSeriesQuery()
  const { data: statuses = [] } = useListStatusesQuery()
  const { data: creators = [] } = useListCreatorsQuery()

  if (field === "mediaType") {
    if (isArray) {
      return (
        <MultiSelectValue
          options={MEDIA_TYPE_VALUES.map((v) => ({ value: v, label: v }))}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      )
    }
    const mediaTypeItems = MEDIA_TYPE_VALUES.map((v) => ({
      value: v,
      label: v,
    }))

    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
        items={mediaTypeItems}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {mediaTypeItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field === "tags") {
    return (
      <MultiSelectValue
        options={tags.map((t) => ({ value: t.uuid, label: t.name }))}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
        placeholder="Select tags..."
      />
    )
  }

  if (field === "collections") {
    return (
      <MultiSelectValue
        options={collections.map((c) => ({ value: c.uuid, label: c.name }))}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
        placeholder="Select collections..."
      />
    )
  }

  if (field === "series") {
    return (
      <MultiSelectValue
        options={series.map((s) => ({ value: s.uuid, label: s.name }))}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
        placeholder="Select series..."
      />
    )
  }

  if (field === "creators") {
    return (
      <MultiSelectValue
        options={creators.map((c) => ({ value: c.uuid, label: c.name }))}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
        placeholder="Select creators..."
      />
    )
  }

  if (field === "status") {
    if (isArray) {
      return (
        <MultiSelectValue
          options={statuses.map((s) => ({ value: s.uuid, label: s.name }))}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          placeholder="Select statuses..."
        />
      )
    }

    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Select status..." />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.uuid} value={s.uuid}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (fieldType === "number") {
    const numericConfig = getNumericFieldConfig(field)

    if (isRange) {
      const rangeValue = Array.isArray(value)
        ? value
        : [numericConfig.min, numericConfig.defaultMax]

      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="h-7 w-20 text-xs"
            value={rangeValue[0] ?? numericConfig.min}
            onChange={(e) => {
              onChange([
                Number(e.target.value),
                rangeValue[1] ?? numericConfig.defaultMax,
              ])
            }}
            step={numericConfig.step}
            min={numericConfig.min}
          />
          <span className="text-muted-foreground text-xs">
            {numericConfig.rangeSeparator}
          </span>
          <Input
            type="number"
            className="h-7 w-20 text-xs"
            value={rangeValue[1] ?? numericConfig.defaultMax}
            onChange={(e) => {
              onChange([
                rangeValue[0] ?? numericConfig.min,
                Number(e.target.value),
              ])
            }}
            step={numericConfig.step}
            min={numericConfig.min}
          />
          {numericConfig.unit && (
            <span className="text-muted-foreground text-xs">
              {numericConfig.unit}
            </span>
          )}
        </div>
      )
    }

    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          className="h-7 w-20 text-xs"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => {
            onChange(Number(e.target.value))
          }}
          step={numericConfig.step}
          min={numericConfig.min}
          placeholder={numericConfig.placeholder}
        />
        {numericConfig.unit && (
          <span className="text-muted-foreground text-xs">
            {numericConfig.unit}
          </span>
        )}
      </div>
    )
  }

  if (fieldType === "date") {
    if (isRange) {
      const rangeValue = Array.isArray(value) ? value : ["", ""]

      return (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-7 text-xs"
            value={typeof rangeValue[0] === "string" ? rangeValue[0] : ""}
            onChange={(e) => {
              onChange([e.target.value, rangeValue[1] ?? ""])
            }}
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            className="h-7 text-xs"
            value={typeof rangeValue[1] === "string" ? rangeValue[1] : ""}
            onChange={(e) => {
              onChange([rangeValue[0] ?? "", e.target.value])
            }}
          />
        </div>
      )
    }

    return (
      <Input
        type="date"
        className="h-7 text-xs"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => {
          onChange(e.target.value)
        }}
      />
    )
  }

  if (isArray) {
    const arrayValue = Array.isArray(value) ? value.join(", ") : ""

    return (
      <Input
        className="h-7 text-xs"
        value={arrayValue}
        onChange={(e) => {
          const values = e.target.value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v)
          onChange(values.length > 0 ? values : null)
        }}
        placeholder="Comma-separated values..."
      />
    )
  }

  return (
    <Input
      className="h-7 text-xs"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => {
        onChange(e.target.value || null)
      }}
      placeholder="Enter value..."
    />
  )
}

type MultiSelectValueProps = {
  options: Array<{ value: string; label: string }>
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

function MultiSelectValue({
  options,
  value,
  onChange,
  placeholder = "Select...",
}: MultiSelectValueProps) {
  const [open, setOpen] = useState(false)

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter((l): l is string => !!l)

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
        }}
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-7 w-full items-center justify-between rounded-md border px-2 text-xs focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={cn(
            "truncate",
            !selectedLabels.length && "text-muted-foreground",
          )}
        >
          {selectedLabels.length > 0
            ? selectedLabels.length > 2
              ? `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`
              : selectedLabels.join(", ")
            : placeholder}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false)
            }}
          />

          <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 shadow-md">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  toggleOption(option.value)
                }}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs",
                  value.includes(option.value) && "bg-accent/50",
                )}
              >
                <div
                  className={cn(
                    "flex size-4 items-center justify-center rounded border",
                    value.includes(option.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground",
                  )}
                >
                  {value.includes(option.value) && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                {option.label}
              </button>
            ))}

            {options.length === 0 && (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                No options available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
