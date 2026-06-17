import assert from "node:assert"
import { describe, it } from "node:test"

import Database from "better-sqlite3"

import { createKyselyDb } from "@/database/factory"
import {
  buildFilterExpression,
  extractEntityReferences,
  removeDeletedEntityReferences,
} from "@/database/shelfFilter"
import {
  FIELD_LABELS,
  type ShelfFilterField,
  type ShelfFilterNode,
  createAndBlock,
  createEmptyCondition,
  createNotBlock,
  createOrBlock,
  getFieldType,
  getOperatorsForField,
  isLogicalBlock,
  operatorRequiresArrayValue,
  operatorRequiresRangeValue,
  operatorRequiresValue,
  shelfFilterConditionSchema,
  shelfFilterFieldSchema,
  shelfFilterNodeSchema,
  shelfFilterOperatorSchema,
  shelfFilterValueSchema,
} from "@/shelves"
import { type UUID } from "@/uuid"

// ---------------------------------------------------------------------------
// zod schema validation
// ---------------------------------------------------------------------------

void describe("shelfFilterFieldSchema", () => {
  void it("accepts all known fields", () => {
    const knownFields = Object.keys(FIELD_LABELS) as ShelfFilterField[]

    for (const field of knownFields) {
      const result = shelfFilterFieldSchema.safeParse(field)
      assert.ok(result.success, `field "${field}" should be valid`)
    }
  })

  void it("rejects unknown fields", () => {
    const result = shelfFilterFieldSchema.safeParse("nonexistent")
    assert.ok(!result.success)
  })

  void it("includes the new fields", () => {
    for (const field of ["userRating", "duration", "pageCount", "fileSize"]) {
      const result = shelfFilterFieldSchema.safeParse(field)
      assert.ok(result.success, `field "${field}" should be valid`)
    }
  })
})

void describe("shelfFilterOperatorSchema", () => {
  void it("accepts isEmpty and isNotEmpty", () => {
    assert.ok(shelfFilterOperatorSchema.safeParse("isEmpty").success)
    assert.ok(shelfFilterOperatorSchema.safeParse("isNotEmpty").success)
  })

  void it("rejects unknown operators", () => {
    assert.ok(!shelfFilterOperatorSchema.safeParse("matches").success)
  })
})

void describe("shelfFilterValueSchema", () => {
  void it("accepts a string", () => {
    assert.ok(shelfFilterValueSchema.safeParse("hello").success)
  })

  void it("accepts a number", () => {
    assert.ok(shelfFilterValueSchema.safeParse(42).success)
  })

  void it("accepts null", () => {
    assert.ok(shelfFilterValueSchema.safeParse(null).success)
  })

  void it("accepts an array of strings", () => {
    assert.ok(shelfFilterValueSchema.safeParse(["a", "b"]).success)
  })

  void it("accepts a mixed array", () => {
    assert.ok(shelfFilterValueSchema.safeParse(["a", 1]).success)
  })

  void it("accepts a tuple of two numbers", () => {
    assert.ok(shelfFilterValueSchema.safeParse([0, 5]).success)
  })
})

void describe("shelfFilterConditionSchema", () => {
  void it("accepts a valid condition", () => {
    const result = shelfFilterConditionSchema.safeParse({
      type: "condition",
      field: "title",
      operator: "contains",
      value: "test",
    })

    assert.ok(result.success)
  })

  void it("accepts a condition without value", () => {
    const result = shelfFilterConditionSchema.safeParse({
      type: "condition",
      field: "title",
      operator: "isEmpty",
    })

    assert.ok(result.success)
  })

  void it("rejects an invalid field", () => {
    const result = shelfFilterConditionSchema.safeParse({
      type: "condition",
      field: "invalidField",
      operator: "is",
      value: "x",
    })

    assert.ok(!result.success)
  })
})

void describe("shelfFilterNodeSchema", () => {
  void it("accepts a simple condition", () => {
    const result = shelfFilterNodeSchema.safeParse({
      type: "condition",
      field: "rating",
      operator: "greaterOrEqual",
      value: 3,
    })

    assert.ok(result.success)
  })

  void it("accepts an AND block with children", () => {
    const result = shelfFilterNodeSchema.safeParse({
      type: "and",
      children: [
        { type: "condition", field: "title", operator: "contains", value: "a" },
        { type: "condition", field: "rating", operator: "is", value: 5 },
      ],
    })

    assert.ok(result.success)
  })

  void it("accepts an OR block", () => {
    const result = shelfFilterNodeSchema.safeParse({
      type: "or",
      children: [
        { type: "condition", field: "language", operator: "is", value: "en" },
      ],
    })

    assert.ok(result.success)
  })

  void it("accepts a NOT block", () => {
    const result = shelfFilterNodeSchema.safeParse({
      type: "not",
      child: {
        type: "condition",
        field: "tags",
        operator: "includes",
        value: ["uuid-1"],
      },
    })

    assert.ok(result.success)
  })

  void it("accepts deeply nested trees", () => {
    const result = shelfFilterNodeSchema.safeParse({
      type: "and",
      children: [
        {
          type: "or",
          children: [
            {
              type: "not",
              child: {
                type: "condition",
                field: "userRating",
                operator: "greaterThan",
                value: 3,
              },
            },
            {
              type: "condition",
              field: "duration",
              operator: "between",
              value: [0, 7200],
            },
          ],
        },
        {
          type: "condition",
          field: "fileSize",
          operator: "lessThan",
          value: 50000000,
        },
      ],
    })

    assert.ok(result.success)
  })

  void it("rejects an invalid discriminator type", () => {
    const result = shelfFilterNodeSchema.safeParse({
      type: "xor",
      children: [],
    })

    assert.ok(!result.success)
  })
})

// ---------------------------------------------------------------------------
// field type classification
// ---------------------------------------------------------------------------

void describe("getFieldType", () => {
  void it("classifies string fields", () => {
    assert.strictEqual(getFieldType("title"), "string")
    assert.strictEqual(getFieldType("subtitle"), "string")
    assert.strictEqual(getFieldType("description"), "string")
    assert.strictEqual(getFieldType("language"), "string")
  })

  void it("classifies number fields", () => {
    assert.strictEqual(getFieldType("rating"), "number")
    assert.strictEqual(getFieldType("userRating"), "number")
    assert.strictEqual(getFieldType("duration"), "number")
    assert.strictEqual(getFieldType("pageCount"), "number")
    assert.strictEqual(getFieldType("fileSize"), "number")
  })

  void it("classifies date fields", () => {
    assert.strictEqual(getFieldType("publicationDate"), "date")
  })

  void it("classifies uuid fields", () => {
    assert.strictEqual(getFieldType("status"), "uuid")
  })

  void it("classifies array fields", () => {
    assert.strictEqual(getFieldType("tags"), "array")
    assert.strictEqual(getFieldType("collections"), "array")
    assert.strictEqual(getFieldType("series"), "array")
    assert.strictEqual(getFieldType("creators"), "array")
  })

  void it("classifies enum fields", () => {
    assert.strictEqual(getFieldType("mediaType"), "enum")
  })
})

void describe("getOperatorsForField", () => {
  void it("returns string operators for title", () => {
    const ops = getOperatorsForField("title")
    assert.ok(ops.includes("contains"))
    assert.ok(ops.includes("startsWith"))
    assert.ok(!ops.includes("greaterThan"))
  })

  void it("returns number operators for userRating", () => {
    const ops = getOperatorsForField("userRating")
    assert.ok(ops.includes("greaterThan"))
    assert.ok(ops.includes("between"))
    assert.ok(!ops.includes("contains"))
  })

  void it("returns number operators for duration", () => {
    const ops = getOperatorsForField("duration")
    assert.ok(ops.includes("greaterOrEqual"))
    assert.ok(ops.includes("lessOrEqual"))
  })

  void it("returns array operators for tags", () => {
    const ops = getOperatorsForField("tags")
    assert.ok(ops.includes("includes"))
    assert.ok(ops.includes("includesAll"))
    assert.ok(ops.includes("excludes"))
    assert.ok(!ops.includes("is"))
  })
})

// ---------------------------------------------------------------------------
// operator helpers
// ---------------------------------------------------------------------------

void describe("operatorRequiresValue", () => {
  void it("returns false for isEmpty and isNotEmpty", () => {
    assert.strictEqual(operatorRequiresValue("isEmpty"), false)
    assert.strictEqual(operatorRequiresValue("isNotEmpty"), false)
  })

  void it("returns true for all other operators", () => {
    assert.strictEqual(operatorRequiresValue("is"), true)
    assert.strictEqual(operatorRequiresValue("contains"), true)
    assert.strictEqual(operatorRequiresValue("greaterThan"), true)
  })
})

void describe("operatorRequiresArrayValue", () => {
  void it("returns true for multi-value operators", () => {
    assert.strictEqual(operatorRequiresArrayValue("isAnyOf"), true)
    assert.strictEqual(operatorRequiresArrayValue("isNoneOf"), true)
    assert.strictEqual(operatorRequiresArrayValue("includes"), true)
    assert.strictEqual(operatorRequiresArrayValue("includesAll"), true)
    assert.strictEqual(operatorRequiresArrayValue("excludes"), true)
  })

  void it("returns false for single-value operators", () => {
    assert.strictEqual(operatorRequiresArrayValue("is"), false)
    assert.strictEqual(operatorRequiresArrayValue("contains"), false)
  })
})

void describe("operatorRequiresRangeValue", () => {
  void it("returns true only for between", () => {
    assert.strictEqual(operatorRequiresRangeValue("between"), true)
    assert.strictEqual(operatorRequiresRangeValue("is"), false)
    assert.strictEqual(operatorRequiresRangeValue("greaterThan"), false)
  })
})

// ---------------------------------------------------------------------------
// node construction helpers
// ---------------------------------------------------------------------------

void describe("createEmptyCondition", () => {
  void it("creates a default title/contains condition", () => {
    const cond = createEmptyCondition()
    assert.strictEqual(cond.type, "condition")
    assert.strictEqual(cond.field, "title")
    assert.strictEqual(cond.operator, "contains")
    assert.strictEqual(cond.value, "")
  })
})

void describe("createAndBlock", () => {
  void it("creates an AND block with a default child", () => {
    const block = createAndBlock()
    assert.strictEqual(block.type, "and")
    assert.strictEqual(block.children.length, 1)
    assert.strictEqual(block.children[0]!.type, "condition")
  })

  void it("accepts custom children", () => {
    const children: ShelfFilterNode[] = [
      { type: "condition", field: "title", operator: "is", value: "A" },
      { type: "condition", field: "rating", operator: "is", value: 5 },
    ]

    const block = createAndBlock(children)
    assert.strictEqual(block.children.length, 2)
  })
})

void describe("createOrBlock", () => {
  void it("creates an OR block with a default child", () => {
    const block = createOrBlock()
    assert.strictEqual(block.type, "or")
    assert.strictEqual(block.children.length, 1)
  })
})

void describe("createNotBlock", () => {
  void it("creates a NOT block with a default child", () => {
    const block = createNotBlock()
    assert.strictEqual(block.type, "not")
    assert.strictEqual(block.child.type, "condition")
  })
})

void describe("isLogicalBlock", () => {
  void it("returns true for and, or, not", () => {
    assert.ok(isLogicalBlock(createAndBlock()))
    assert.ok(isLogicalBlock(createOrBlock()))
    assert.ok(isLogicalBlock(createNotBlock()))
  })

  void it("returns false for conditions", () => {
    assert.ok(!isLogicalBlock(createEmptyCondition()))
  })
})

// ---------------------------------------------------------------------------
// entity reference extraction
// ---------------------------------------------------------------------------

void describe("extractEntityReferences", () => {
  void it("extracts tag references from a condition", () => {
    const refs = extractEntityReferences({
      type: "condition",
      field: "tags",
      operator: "includes",
      value: ["tag-1", "tag-2"],
    })

    assert.strictEqual(refs.length, 2)
    assert.strictEqual(refs[0]!.entityType, "tag")
    assert.strictEqual(refs[0]!.entityUuid, "tag-1")
    assert.strictEqual(refs[1]!.entityType, "tag")
    assert.strictEqual(refs[1]!.entityUuid, "tag-2")
  })

  void it("extracts references from nested trees", () => {
    const refs = extractEntityReferences({
      type: "and",
      children: [
        {
          type: "condition",
          field: "collections",
          operator: "includes",
          value: ["col-1"],
        },
        {
          type: "not",
          child: {
            type: "condition",
            field: "creators",
            operator: "excludes",
            value: ["creator-1"],
          },
        },
      ],
    })

    assert.strictEqual(refs.length, 2)
    assert.deepStrictEqual(refs[0], {
      entityType: "collection",
      entityUuid: "col-1",
    })
    assert.deepStrictEqual(refs[1], {
      entityType: "creator",
      entityUuid: "creator-1",
    })
  })

  void it("returns empty for non-entity fields", () => {
    const refs = extractEntityReferences({
      type: "condition",
      field: "title",
      operator: "contains",
      value: "something",
    })

    assert.strictEqual(refs.length, 0)
  })

  void it("handles status uuid field", () => {
    const refs = extractEntityReferences({
      type: "condition",
      field: "status",
      operator: "is",
      value: "status-uuid-1",
    })

    assert.strictEqual(refs.length, 1)
    assert.strictEqual(refs[0]!.entityType, "status")
    assert.strictEqual(refs[0]!.entityUuid, "status-uuid-1")
  })

  void it("ignores numeric fields", () => {
    const refs = extractEntityReferences({
      type: "condition",
      field: "userRating",
      operator: "greaterThan",
      value: 3,
    })

    assert.strictEqual(refs.length, 0)
  })
})

void describe("removeDeletedEntityReferences", () => {
  void it("removes a tag from a condition", () => {
    const result = removeDeletedEntityReferences(
      {
        type: "condition",
        field: "tags",
        operator: "includes",
        value: ["tag-1", "tag-2"],
      },
      "tag",
      "tag-1",
    )

    assert.ok(result)
    assert.strictEqual(result.type, "condition")
    assert.deepStrictEqual((result as { value: string[] }).value, ["tag-2"])
  })

  void it("returns null when all values removed from a condition", () => {
    const result = removeDeletedEntityReferences(
      {
        type: "condition",
        field: "tags",
        operator: "includes",
        value: ["tag-1"],
      },
      "tag",
      "tag-1",
    )

    assert.strictEqual(result, null)
  })

  void it("removes a child from an AND block", () => {
    const result = removeDeletedEntityReferences(
      {
        type: "and",
        children: [
          {
            type: "condition",
            field: "tags",
            operator: "includes",
            value: ["tag-1"],
          },
          {
            type: "condition",
            field: "title",
            operator: "contains",
            value: "hello",
          },
        ],
      },
      "tag",
      "tag-1",
    )

    assert.ok(result)
    assert.strictEqual(result.type, "and")

    const andBlock = result as { children: ShelfFilterNode[] }
    assert.strictEqual(andBlock.children.length, 1)
    assert.strictEqual(andBlock.children[0]!.type, "condition")
  })

  void it("leaves unrelated fields untouched", () => {
    const original: ShelfFilterNode = {
      type: "condition",
      field: "collections",
      operator: "includes",
      value: ["col-1"],
    }

    const result = removeDeletedEntityReferences(original, "tag", "tag-1")

    assert.ok(result)
    assert.deepStrictEqual(result, original)
  })
})

// ---------------------------------------------------------------------------
// FIELD_LABELS completeness
// ---------------------------------------------------------------------------

void describe("FIELD_LABELS", () => {
  void it("has a label for every field in the schema", () => {
    const fields = shelfFilterFieldSchema.options

    for (const field of fields) {
      assert.ok(
        field in FIELD_LABELS,
        `FIELD_LABELS missing entry for "${field}"`,
      )
    }
  })

  void it("has no extra labels beyond the schema", () => {
    const fields = new Set(shelfFilterFieldSchema.options)

    for (const key of Object.keys(FIELD_LABELS)) {
      assert.ok(
        fields.has(key as ShelfFilterField),
        `FIELD_LABELS has extra entry "${key}" not in schema`,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// strict condition schema (field -> operator -> value coupling)
// ---------------------------------------------------------------------------

void describe("strict condition schema", () => {
  void it("rejects an operator the field type does not support", () => {
    const result = shelfFilterConditionSchema.safeParse({
      type: "condition",
      field: "pageCount",
      operator: "endsWith",
      value: "x",
    })
    assert.ok(!result.success)
  })

  void it("rejects a between range with the wrong arity", () => {
    const result = shelfFilterConditionSchema.safeParse({
      type: "condition",
      field: "duration",
      operator: "between",
      value: [1],
    })
    assert.ok(!result.success)
  })

  void it("rejects an invalid media type value", () => {
    const result = shelfFilterConditionSchema.safeParse({
      type: "condition",
      field: "mediaType",
      operator: "is",
      value: "paper",
    })
    assert.ok(!result.success)
  })

  void it("rejects a numeric field with a string value", () => {
    const result = shelfFilterConditionSchema.safeParse({
      type: "condition",
      field: "pageCount",
      operator: "is",
      value: "ten",
    })
    assert.ok(!result.success)
  })

  void it("accepts review presence and content", () => {
    assert.ok(
      shelfFilterConditionSchema.safeParse({
        type: "condition",
        field: "review",
        operator: "isNotEmpty",
      }).success,
    )
    assert.ok(
      shelfFilterConditionSchema.safeParse({
        type: "condition",
        field: "review",
        operator: "contains",
        value: "great",
      }).success,
    )
  })

  void it("accepts a rating dimension condition carrying a dimension", () => {
    assert.ok(
      shelfFilterConditionSchema.safeParse({
        type: "condition",
        field: "ratingDimension",
        dimension: "plot",
        operator: "greaterOrEqual",
        value: 4,
      }).success,
    )
  })

  void it("rejects a rating dimension condition without a dimension", () => {
    assert.ok(
      !shelfFilterConditionSchema.safeParse({
        type: "condition",
        field: "ratingDimension",
        operator: "greaterOrEqual",
        value: 4,
      }).success,
    )
  })

  void it("accepts a generic search condition", () => {
    assert.ok(
      shelfFilterConditionSchema.safeParse({
        type: "condition",
        field: "search",
        operator: "contains",
        value: "tolkien",
      }).success,
    )
  })

  void it("tolerates a legacy unary condition that still carries an empty value", () => {
    assert.ok(
      shelfFilterConditionSchema.safeParse({
        type: "condition",
        field: "title",
        operator: "isEmpty",
        value: "",
      }).success,
    )
  })
})

// ---------------------------------------------------------------------------
// sql compilation of the new fields
// ---------------------------------------------------------------------------

void describe("buildFilterExpression sql", () => {
  const userId = "11111111-1111-1111-1111-111111111111" as UUID
  // a compile-only kysely instance: .compile() builds sql without executing, so
  // an in-memory db with no schema is enough.
  const testDb = createKyselyDb(new Database(":memory:"))

  const compile = (node: ShelfFilterNode): string =>
    testDb
      .selectFrom("book")
      .selectAll()
      .where((eb) => buildFilterExpression(eb, node, userId))
      .compile().sql

  void it("queries the review column for a review filter", () => {
    const sql = compile({
      type: "and",
      children: [
        { type: "condition", field: "review", operator: "contains", value: "x" },
      ],
    })
    assert.match(sql, /user_book_rating/)
    assert.match(sql, /review/)
  })

  void it("uses json_extract for a rating dimension filter", () => {
    const sql = compile({
      type: "and",
      children: [
        {
          type: "condition",
          field: "ratingDimension",
          dimension: "plot",
          operator: "greaterOrEqual",
          value: 4,
        },
      ],
    })
    assert.match(sql, /json_extract/)
  })

  void it("searches title, author and series for a search filter", () => {
    const sql = compile({
      type: "and",
      children: [
        { type: "condition", field: "search", operator: "contains", value: "x" },
      ],
    })
    assert.match(sql, /creator/)
    assert.match(sql, /series/)
  })
})
