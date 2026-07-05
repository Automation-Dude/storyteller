"use client"

import * as icon from "@/icons"
import { Reorder, motion, useDragControls } from "motion/react"
import { useEffect, useRef } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { type BookWithRelations } from "@/database/books"
import { DEFAULT_RATING_DIMENSIONS } from "@/database/ratingDimensions"
import { statusDisplayLabel } from "@/database/statusKinds"
import {
  FIELD_GROUPS,
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
  getFieldDef,
  getOperatorsForField,
  normalizeRootFilter,
  operatorRequiresArrayValue,
  operatorRequiresRangeValue,
  operatorRequiresValue,
} from "@/shelves"
import {
  getCoverUrl,
  useListCollectionsQuery,
  useListCreatorsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
  useListTagsQuery,
} from "@/store/api"
import { FieldIcon, IAdd } from "../ui/icon"
import {
  DurationInput,
  FileSizeInput,
  MultiCombobox,
  NumericInput,
} from "../books/filter-ui"

type FilterPreset = {
  key: string
  node: ShelfFilterCondition
}

const FILTER_PRESETS: FilterPreset[] = [
  {
    key: "highlyRated",
    node: {
      type: "condition",
      field: "userRating",
      operator: "greaterOrEqual",
      value: 4,
    },
  },
  {
    key: "audiobooksOnly",
    node: {
      type: "condition",
      field: "mediaType",
      operator: "is",
      value: "audiobook",
    },
  },
  {
    key: "ebooksOnly",
    node: {
      type: "condition",
      field: "mediaType",
      operator: "is",
      value: "ebook",
    },
  },
  {
    key: "syncedOnly",
    node: {
      type: "condition",
      field: "mediaType",
      operator: "is",
      value: "synced",
    },
  },
  {
    key: "hasReview",
    node: {
      type: "condition",
      field: "review",
      operator: "isNotEmpty",
      value: undefined,
    },
  },
  {
    key: "unrated",
    node: {
      type: "condition",
      field: "userRating",
      operator: "isEmpty",
      value: undefined,
    },
  },
  {
    key: "longBooks",
    node: {
      type: "condition",
      field: "pageCount",
      operator: "greaterOrEqual",
      value: 300,
    },
  },
]

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

type ShelfFilterEditorProps = {
  filter: ShelfFilterNode | null
  onChange: (filter: ShelfFilterNode | null) => void
}

export function isFilterValid(node: ShelfFilterNode | null): boolean {
  if (!node) return false

  if (node.type === "condition") {
    if (!operatorRequiresValue(node.operator)) return true

    const isMissingValue =
      node.value === undefined ||
      node.value === null ||
      (typeof node.value === "string" && node.value.trim() === "") ||
      (Array.isArray(node.value) && node.value.length === 0)

    return !isMissingValue
  }

  if (node.type === "not") {
    return isFilterValid(node.child)
  }

  if (node.children.length === 0) return false

  return node.children.every((child) => isFilterValid(child))
}

// ---------------------------------------------------------------------------
// root editor
// ---------------------------------------------------------------------------

export function ShelfFilterEditor({
  filter,
  onChange,
}: ShelfFilterEditorProps) {
  const root = normalizeRootFilter(filter)

  useEffect(() => {
    if (root !== filter) {
      onChange(root)
    }
  }, [root, filter, onChange])

  const handleApplyPreset = (preset: FilterPreset) => {
    const currentRoot = normalizeRootFilter(filter)

    if (currentRoot.type === "and" || currentRoot.type === "or") {
      onChange({
        ...currentRoot,
        children: [...currentRoot.children, structuredClone(preset.node)],
      })
    }
  }

  return (
    <div>
      <FilterNodeEditor
        node={root}
        onChange={onChange}
        onRemove={() => {
          onChange(null)
        }}
        isRoot
      />

      <div className="mt-1">
        <FilterPresetsDropdown onApply={handleApplyPreset} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// presets dropdown
// ---------------------------------------------------------------------------

function FilterPresetsDropdown({
  onApply,
}: {
  onApply: (preset: FilterPreset) => void
}) {
  const t = useTranslation("ShelfFilterEditor")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-fit gap-1 text-xs"
          >
            {t.plain("presets")}
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        {FILTER_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.key}
            onClick={() => {
              onApply(preset)
            }}
          >
            {t.plain(`preset.${preset.key}` as "preset.highlyRated")}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// add-node dropdown
// ---------------------------------------------------------------------------

function AddNodeDropdown({
  onAdd,
}: {
  onAdd: (node: ShelfFilterNode) => void
}) {
  const t = useTranslation("ShelfFilterEditor")
  const c = useCommon()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 w-fit gap-1 text-xs">
            <IAdd.base className="size-3" />
            {c.plain("actions.add")}
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => {
            onAdd(createEmptyCondition())
          }}
        >
          {t.plain("condition")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onAdd(createAndBlock())
          }}
        >
          {t.plain("andGroup")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onAdd(createOrBlock())
          }}
        >
          {t.plain("orGroup")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onAdd(createNotBlock())
          }}
        >
          {t.plain("not")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// preview
// ---------------------------------------------------------------------------

export type FilterPreviewProps = {
  books: BookWithRelations[]
  isLoading: boolean
  isInvalid?: boolean
}

export function FilterPreview({
  books,
  isLoading,
  isInvalid,
}: FilterPreviewProps) {
  const t = useTranslation("ShelfFilterEditor")

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-2 text-xs">
        <icon.Loader2 className="size-3 animate-spin" />
        {t.plain("loadingPreview")}
      </div>
    )
  }

  if (isInvalid) {
    return (
      <div className="text-muted-foreground py-2 text-xs">
        {t.plain("completeFilter")}
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-muted-foreground py-2 text-xs">
        {t.plain("noMatches")}
      </div>
    )
  }

  return (
    <div className="h-full overflow-x-clip">
      <div className="text-muted-foreground text-xs">
        {books.length === 20 ? "> " : ""}
        {t.plain("matchCount", { count: books.length })}
      </div>

      <div className="scroll-y max-h-full">
        {books.map((book) => (
          <PreviewBookItem key={book.uuid} book={book} />
        ))}
      </div>
    </div>
  )
}

export function PreviewBookItem({ book }: { book: BookWithRelations }) {
  const authorNames = book.authors.map((a) => a.name).join(", ")

  return (
    <div className="flex items-center gap-2 py-1">
      <img
        src={getCoverUrl(book.uuid, { height: 32, updatedAt: book.updatedAt })}
        alt=""
        className="h-8 w-6 shrink-0 rounded object-cover"
      />

      <div className="min-w-0">
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

// ---------------------------------------------------------------------------
// filter node editor (dispatcher)
// ---------------------------------------------------------------------------

type FilterNodeEditorProps = {
  node: ShelfFilterNode
  onChange: (node: ShelfFilterNode) => void
  onRemove: () => void
  onDuplicate?: () => void
  isRoot?: boolean
}

function FilterNodeEditor({
  node,
  onChange,
  onRemove,
  onDuplicate,
  isRoot = false,
}: FilterNodeEditorProps) {
  if (node.type === "condition") {
    return (
      <ConditionEditor
        condition={node}
        onChange={onChange}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
      />
    )
  }

  if (node.type === "not") {
    return (
      <NotBlockEditor
        block={node}
        onChange={onChange}
        onRemove={onRemove}
        onDuplicate={onDuplicate}
        isRoot={isRoot}
      />
    )
  }

  return (
    <LogicalBlockEditor
      block={node}
      onChange={onChange}
      onRemove={onRemove}
      onDuplicate={onDuplicate}
      isRoot={isRoot}
    />
  )
}

// ---------------------------------------------------------------------------
// draggable filter item (for reordering inside logical blocks)
// ---------------------------------------------------------------------------

function DraggableFilterItem({
  id,
  showHandle,
  children,
}: {
  id: string
  showHandle: boolean
  children: React.ReactNode
}) {
  const controls = useDragControls()

  return (
    <Reorder.Item
      value={id}
      dragControls={controls}
      dragListener={false}
      initial={false}
      transition={{ layout: { duration: 0 } }}
      className="list-none"
    >
      <div className="flex items-start gap-1">
        {showHandle && (
          <motion.button
            type="button"
            className="text-muted-foreground mt-2 shrink-0 cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={(e) => {
              controls.start(e)
            }}
          >
            <icon.GripVertical className="size-3" />
          </motion.button>
        )}

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Reorder.Item>
  )
}

// ---------------------------------------------------------------------------
// logical block (AND / OR)
// ---------------------------------------------------------------------------

function LogicalBlockEditor({
  block,
  onChange,
  onRemove,
  onDuplicate,
  isRoot = false,
}: {
  block: ShelfFilterAnd | ShelfFilterOr
  onChange: (block: ShelfFilterNode) => void
  onRemove: () => void
  onDuplicate?: () => void
  isRoot?: boolean
}) {
  const t = useTranslation("ShelfFilterEditor")

  const idsRef = useRef<string[]>(block.children.map(() => crypto.randomUUID()))

  // keep ids in sync when children are added externally (e.g. presets)
  if (idsRef.current.length < block.children.length) {
    idsRef.current = [
      ...idsRef.current,
      ...block.children
        .slice(idsRef.current.length)
        .map(() => crypto.randomUUID()),
    ]
  } else if (idsRef.current.length > block.children.length) {
    idsRef.current = idsRef.current.slice(0, block.children.length)
  }

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
    idsRef.current = idsRef.current.filter((_, i) => i !== index)

    if (newChildren.length === 0) {
      onRemove()
      return
    }

    onChange({ ...block, children: newChildren })
  }

  const handleChildDuplicate = (index: number) => {
    const copy = structuredClone(block.children[index]!)
    const newChildren = [...block.children]
    newChildren.splice(index + 1, 0, copy)

    const newIds = [...idsRef.current]
    newIds.splice(index + 1, 0, crypto.randomUUID())
    idsRef.current = newIds

    onChange({ ...block, children: newChildren })
  }

  const handleAddNode = (node: ShelfFilterNode) => {
    idsRef.current = [...idsRef.current, crypto.randomUUID()]
    onChange({ ...block, children: [...block.children, node] })
  }

  const handleReorder = (newIds: string[]) => {
    const newChildren = newIds.map((id) => {
      const oldIndex = idsRef.current.indexOf(id)
      return block.children[oldIndex]!
    })

    idsRef.current = newIds
    onChange({ ...block, children: newChildren })
  }

  const items = [
    { value: "and", label: "AND" },
    { value: "or", label: "OR" },
  ]

  const showDragHandles = block.children.length > 1

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
          {block.type === "and" ? t.plain("allMatch") : t.plain("anyMatch")}
        </span>

        {!isRoot && (
          <div className="ml-auto flex items-center gap-0.5">
            {onDuplicate && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onDuplicate}
                title={t.plain("duplicate")}
              >
                <icon.Copy className="size-3" />
              </Button>
            )}

            <Button variant="ghost" size="icon-xs" onClick={onRemove}>
              <icon.Trash className="size-3" />
            </Button>
          </div>
        )}
      </div>

      <Reorder.Group
        axis="y"
        values={idsRef.current}
        onReorder={handleReorder}
        className={cn(
          "border-muted flex flex-col gap-1",
          !isRoot ? "ml-3 border-l pl-3" : "",
        )}
      >
        {block.children.map((child, index) => (
          <DraggableFilterItem
            key={idsRef.current[index]}
            id={idsRef.current[index]!}
            showHandle={showDragHandles}
          >
            <FilterNodeEditor
              node={child}
              onChange={(newChild) => {
                handleChildChange(index, newChild)
              }}
              onRemove={() => {
                handleChildRemove(index)
              }}
              onDuplicate={() => {
                handleChildDuplicate(index)
              }}
            />
          </DraggableFilterItem>
        ))}
      </Reorder.Group>

      <div className={cn(!isRoot ? "ml-3 pl-3" : "")}>
        <AddNodeDropdown onAdd={handleAddNode} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NOT block
// ---------------------------------------------------------------------------

function NotBlockEditor({
  block,
  onChange,
  onRemove,
  onDuplicate,
  isRoot = false,
}: {
  block: ShelfFilterNot
  onChange: (block: ShelfFilterNode) => void
  onRemove: () => void
  onDuplicate?: () => void
  isRoot?: boolean
}) {
  const t = useTranslation("ShelfFilterEditor")

  const handleChildChange = (child: ShelfFilterNode) => {
    onChange({ ...block, child })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">{t.plain("not")}</span>
        <span className="text-muted-foreground text-xs">
          {t.plain("mustNotMatch")}
        </span>

        {!isRoot && (
          <div className="ml-auto flex items-center gap-0.5">
            {onDuplicate && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onDuplicate}
                title={t.plain("duplicate")}
              >
                <icon.Copy className="size-3" />
              </Button>
            )}

            <Button variant="ghost" size="icon-xs" onClick={onRemove}>
              <icon.Trash className="size-3" />
            </Button>
          </div>
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

// the field picker groups + ordering (FIELD_GROUPS) now live in @/shelves,
// authored to cover every ShelfFilterField so no field silently drops out of the
// picker (guarded by assertFieldGroupsCoverRegistry).

// ---------------------------------------------------------------------------
// condition editor
// ---------------------------------------------------------------------------

function ConditionEditor({
  condition,
  onChange,
  onRemove,
  onDuplicate,
}: {
  condition: ShelfFilterCondition
  onChange: (condition: ShelfFilterNode) => void
  onRemove: () => void
  onDuplicate?: () => void
}) {
  const t = useTranslation("ShelfFilterEditor")
  const c = useCommon()
  const { ratingDimensions } = useUserPreferences()

  const dimensions = ratingDimensions.length
    ? ratingDimensions
    : DEFAULT_RATING_DIMENSIONS

  const operators = getOperatorsForField(condition.field)
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
      type: "condition",
      field,
      operator: newOperator,
      value: undefined,
      ...(field === "ratingDimension"
        ? { dimension: condition.dimension ?? dimensions[0]?.id }
        : {}),
    })
  }

  const handleDimensionChange = (dimension: string) => {
    onChange({ ...condition, dimension })
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

  const operatorItems = operators.map((op) => ({
    value: op,
    label: t.plain(`operators.${op}` as "operators.is"),
  }))

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 py-1",
          !hasValidValue && needsValue && "opacity-60",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="bg-input/20 dark:bg-input/30 border-input rounded-md font-normal"
              >
                <FieldIcon field={condition.field} className="size-3" />
                {c(`fields.label.${condition.field}`)}
                <icon.ChevronDown className="size-3" />
              </Button>
            }
          />

          <DropdownMenuContent className="w-fit">
            {FIELD_GROUPS.map((group, index) => (
              <DropdownMenuGroup key={group.key}>
                <DropdownMenuLabel>
                  {t.plain(`fieldGroups.${group.key}` as "fieldGroups.text")}
                </DropdownMenuLabel>
                {group.fields.map((field) => (
                  <DropdownMenuItem
                    className="rounded-full"
                    key={field}
                    onClick={() => {
                      handleFieldChange(field)
                    }}
                  >
                    <FieldIcon field={field} className="size-3" />
                    {c(`fields.label.${field}`)}
                  </DropdownMenuItem>
                ))}
                {index < FIELD_GROUPS.length - 1 && <DropdownMenuSeparator />}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {condition.field === "ratingDimension" && (
          <Select
            value={condition.dimension ?? ""}
            onValueChange={(v) => {
              if (v) handleDimensionChange(v)
            }}
            items={dimensions.map((d) => ({ value: d.id, label: d.label }))}
          >
            <SelectTrigger className="h-7 w-[120px] text-xs">
              <SelectValue placeholder={t.plain("axisDimension")} />
            </SelectTrigger>
            <SelectContent>
              {dimensions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
              isArray={needsArrayValue}
              isRange={needsRangeValue}
              value={condition.value}
              onChange={handleValueChange}
            />
          </div>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          {onDuplicate && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDuplicate}
              title={t.plain("duplicate")}
            >
              <icon.Copy className="size-3" />
            </Button>
          )}

          <Button variant="ghost" size="icon-sm" onClick={onRemove}>
            <icon.Trash className="size-3" />
          </Button>
        </div>
      </div>

      {needsValue && !hasValidValue && (
        <span className="text-muted-foreground pl-0.5 text-[10px]">
          {t.plain("pickValue")}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// condition value input
//
// dispatches on the field's registry control (getFieldDef(field).control) and
// reads its scale, so it renders the same primitives the quick-chip editor uses
// and never hand-classifies a field or invents its own scale.
// ---------------------------------------------------------------------------

type ConditionValueInputProps = {
  field: ShelfFilterField
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

function ConditionValueInput({
  field,
  isArray,
  isRange,
  value,
  onChange,
}: ConditionValueInputProps) {
  const t = useTranslation("ShelfFilterEditor")
  const c = useCommon()
  const def = getFieldDef(field)

  const { data: tags = [] } = useListTagsQuery()
  const { data: collections = [] } = useListCollectionsQuery()
  const { data: series = [] } = useListSeriesQuery()
  const { data: statuses = [] } = useListStatusesQuery()
  const { data: creators = [] } = useListCreatorsQuery()

  // -- duration: hours + minutes instead of raw seconds ---------------------

  if (def.control === "duration-range") {
    if (isRange) {
      const rangeValue = Array.isArray(value) ? value : [0, 36000]

      return (
        <div className="flex items-center gap-2">
          <DurationInput
            value={typeof rangeValue[0] === "number" ? rangeValue[0] : 0}
            onChange={(v) => {
              onChange([v, rangeValue[1] ?? 36000])
            }}
          />

          <span className="text-muted-foreground text-xs">{t.plain("to")}</span>

          <DurationInput
            value={typeof rangeValue[1] === "number" ? rangeValue[1] : 36000}
            onChange={(v) => {
              onChange([rangeValue[0] ?? 0, v])
            }}
          />
        </div>
      )
    }

    return (
      <DurationInput
        value={typeof value === "number" ? value : undefined}
        onChange={onChange}
      />
    )
  }

  // -- file size: a numeric field scaled in bytes -> unit selector ----------

  if (def.control === "number-range" && def.scale?.unit === "bytes") {
    if (isRange) {
      const rangeValue = Array.isArray(value) ? value : [0, 1073741824]

      return (
        <div className="flex items-center gap-2">
          <FileSizeInput
            value={typeof rangeValue[0] === "number" ? rangeValue[0] : 0}
            onChange={(v) => {
              onChange([v, rangeValue[1] ?? 1073741824])
            }}
          />

          <span className="text-muted-foreground text-xs">{t.plain("to")}</span>

          <FileSizeInput
            value={
              typeof rangeValue[1] === "number" ? rangeValue[1] : 1073741824
            }
            onChange={(v) => {
              onChange([rangeValue[0] ?? 0, v])
            }}
          />
        </div>
      )
    }

    return (
      <FileSizeInput
        value={typeof value === "number" ? value : undefined}
        onChange={onChange}
      />
    )
  }

  // -- facet relations + status (options come from def.source) --------------

  if (def.control === "facet") {
    const selected = Array.isArray(value) ? (value as string[]) : []

    if (def.source === "tags") {
      return (
        <MultiCombobox
          options={tags.map((tag) => ({ value: tag.uuid, label: tag.name }))}
          value={selected}
          onChange={onChange}
          placeholder={t.plain("selectTags")}
          emptyText={t.plain("noItemsFound")}
        />
      )
    }

    if (def.source === "collections") {
      return (
        <MultiCombobox
          options={collections.map((col) => ({
            value: col.uuid,
            label: col.name,
          }))}
          value={selected}
          onChange={onChange}
          placeholder={t.plain("selectCollections")}
          emptyText={t.plain("noItemsFound")}
        />
      )
    }

    if (def.source === "series") {
      return (
        <MultiCombobox
          options={series.map((s) => ({ value: s.uuid, label: s.name }))}
          value={selected}
          onChange={onChange}
          placeholder={t.plain("selectSeries")}
          emptyText={t.plain("noItemsFound")}
        />
      )
    }

    if (def.source === "creators") {
      return (
        <MultiCombobox
          options={creators.map((cr) => ({ value: cr.uuid, label: cr.name }))}
          value={selected}
          onChange={onChange}
          placeholder={t.plain("selectCreators")}
          emptyText={t.plain("noItemsFound")}
        />
      )
    }

    // statuses: a membership operator -> multi-select, is / isNot -> a single
    // picker.
    if (isArray) {
      return (
        <MultiCombobox
          options={statuses.map((s) => ({
            value: s.uuid,
            label: statusDisplayLabel(s),
          }))}
          value={selected}
          onChange={onChange}
          placeholder={t.plain("selectStatuses")}
          emptyText={t.plain("noItemsFound")}
        />
      )
    }

    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
        items={statuses.map((s) => ({
          value: s.uuid,
          label: statusDisplayLabel(s),
        }))}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder={t.plain("selectStatus")} />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.uuid} value={s.uuid}>
              {statusDisplayLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // -- enum (mediaType, alignmentGrade): options + labels from the registry --

  if (def.control === "enum") {
    const options = def.options.map((v) => ({
      value: v,
      label: c.plain(
        `fields.options.${field}.${v}` as "fields.options.mediaType.ebook",
      ),
    }))

    if (isArray) {
      return (
        <MultiCombobox
          options={options}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          placeholder={t.plain("searchMediaTypes")}
          emptyText={t.plain("noItemsFound")}
        />
      )
    }

    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
        items={options}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder={t.plain("selectMediaType")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // -- generic numeric fields: bounds come from the registry scale ----------

  if (def.control === "number-range") {
    const min = def.scale?.min ?? 0
    const defaultMax = def.scale?.max ?? 100

    if (isRange) {
      const rangeValue = Array.isArray(value) ? value : [min, defaultMax]

      const rangeStart = typeof rangeValue[0] === "number" ? rangeValue[0] : min
      const rangeEnd =
        typeof rangeValue[1] === "number" ? rangeValue[1] : defaultMax

      return (
        <div className="flex items-center gap-2">
          <NumericInput
            className="h-7 w-20 text-xs"
            value={rangeStart}
            onChange={(n) => {
              onChange([n, rangeEnd])
            }}
          />

          <span className="text-muted-foreground text-xs">{t.plain("to")}</span>

          <NumericInput
            className="h-7 w-20 text-xs"
            value={rangeEnd}
            onChange={(n) => {
              onChange([rangeStart, n])
            }}
          />
        </div>
      )
    }

    return (
      <NumericInput
        className="h-7 w-20 text-xs"
        value={typeof value === "number" ? value : ""}
        onChange={onChange}
        placeholder={t.plain("numericPlaceholders.default")}
      />
    )
  }

  // -- date fields ----------------------------------------------------------

  if (def.control === "date-range") {
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

          <span className="text-muted-foreground text-xs">{t.plain("to")}</span>

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

  // -- text fields (title, review, search, ...): a membership operator takes
  // a comma-separated list, everything else a single value ------------------

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
        placeholder={t.plain("commaSeparatedValues")}
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
      placeholder={t.plain("enterValue")}
    />
  )
}
