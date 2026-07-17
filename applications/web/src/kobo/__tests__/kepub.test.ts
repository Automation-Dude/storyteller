import assert from "node:assert"
import { describe, it } from "node:test"

import { type ParsedXml } from "@storyteller-platform/epub"

import { injectKoboSpans, splitIntoSegments } from "@/kobo/kepub"

/** Every character of text in a tree, in order. This is the book itself. */
function textOf(nodes: ParsedXml): string {
  let out = ""
  for (const node of nodes) {
    if ("#text" in node) {
      out += (node as { "#text": string })["#text"]
      continue
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === ":@") continue
      if (Array.isArray(value)) out += textOf(value)
    }
  }
  return out
}

function p(text: string): ParsedXml {
  return [{ p: [{ "#text": text }] } as never]
}

void describe("splitIntoSegments", () => {
  void it("splits on sentence ends", () => {
    assert.deepStrictEqual(splitIntoSegments("One. Two! Three?"), [
      "One. ",
      "Two! ",
      "Three?",
    ])
  })

  void it("rejoins to exactly the input, always", () => {
    // The device places her by span; if joining the spans is not the original
    // text, we have altered her book to get her a page number.
    for (const text of [
      "One. Two! Three?",
      "No punctuation here",
      "Mr. Dinniman wrote it.",
      'She said "stop." Then left.',
      "  leading and trailing  ",
      "Ellipsis... then more.",
      "",
    ]) {
      assert.strictEqual(splitIntoSegments(text).join(""), text, `for: ${text}`)
    }
  })

  void it("keeps whitespace-only text as one piece", () => {
    assert.deepStrictEqual(splitIntoSegments("   "), ["   "])
  })
})

void describe("injectKoboSpans", () => {
  void it("wraps sentences in koboSpans the device can place her by", () => {
    const out = injectKoboSpans(p("One. Two."))
    const spans = (out[0] as unknown as Record<string, ParsedXml>)["p"]!

    assert.strictEqual(spans.length, 2)
    for (const [i, span] of spans.entries()) {
      const attrs = (span as unknown as { ":@": Record<string, string> })[":@"]
      assert.strictEqual(attrs["@_class"], "koboSpan")
      assert.strictEqual(attrs["@_id"], `kobo.1.${i + 1}`)
    }
  })

  void it("does not change one character of the text", () => {
    // The whole safety property. If this can fail, the feature is not worth
    // having: a lost page beats a damaged book.
    const cases: ParsedXml[] = [
      p("One. Two! Three?"),
      p("Mr. Dinniman wrote it. She read it."),
      [
        {
          div: [
            { p: [{ "#text": "First. Second." }] },
            { "#text": "\n  " },
            { p: [{ "#text": "Third." }] },
          ],
        } as never,
      ],
    ]
    for (const input of cases) {
      assert.strictEqual(
        textOf(injectKoboSpans(input)),
        textOf(input),
        "text must survive untouched",
      )
    }
  })

  void it("numbers paragraphs separately, so positions do not collide", () => {
    const out = injectKoboSpans([
      {
        div: [{ p: [{ "#text": "A." }] }, { p: [{ "#text": "B." }] }],
      } as never,
    ])
    const div = (out[0] as unknown as Record<string, ParsedXml>)["div"]!
    const ids = div.flatMap((node) => {
      const children = (node as unknown as Record<string, ParsedXml>)["p"]
      return (children ?? []).map(
        (span) =>
          (span as unknown as { ":@": Record<string, string> })[":@"]["@_id"],
      )
    })
    assert.deepStrictEqual(ids, ["kobo.1.1", "kobo.2.1"])
  })

  void it("leaves script, style and pre alone", () => {
    // Wrapping text in a script or a code block changes what it means.
    for (const tag of ["script", "style", "pre"]) {
      const input = [{ [tag]: [{ "#text": "one. two." }] } as never]
      const out = injectKoboSpans(input)
      const children = (out[0] as unknown as Record<string, ParsedXml>)[tag]!
      assert.strictEqual(children.length, 1, `${tag} must not be wrapped`)
      assert.ok("#text" in children[0]!)
    }
  })

  void it("keeps markup inside a paragraph", () => {
    // Italics and links must survive being spanned around.
    const input: ParsedXml = [
      {
        p: [
          { "#text": "She said " },
          { em: [{ "#text": "no." }] },
          { "#text": " Then left." },
        ],
      } as never,
    ]
    const out = injectKoboSpans(input)
    assert.strictEqual(textOf(out), "She said no. Then left.")
    const children = (out[0] as unknown as Record<string, ParsedXml>)["p"]!
    assert.ok(
      children.some((node) => "em" in node),
      "the em element must still be there",
    )
  })

  void it("is idempotent, so converting twice is not a corruption", () => {
    const once = injectKoboSpans(p("One. Two."))
    const twice = injectKoboSpans(once)
    assert.strictEqual(textOf(twice), textOf(once))
  })
})
