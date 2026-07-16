import assert from "node:assert"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"

import { Epub } from "@storyteller-platform/epub"

import { convertToKepub } from "@/kobo/kepub"

const FIXTURE = join(
  import.meta.dirname,
  "../../../../../libraries/epub/__fixtures__/moby-dick.epub",
)

/** The text of every spine document, read straight from a file on disk. */
async function spineText(path: string): Promise<Map<string, string>> {
  using epub = await Epub.from(path)
  const text = new Map<string, string>()
  for (const item of await epub.getSpineItems()) {
    if (item.mediaType !== "application/xhtml+xml") continue
    text.set(item.href, await epub.readXhtmlItemContents(item.id, "text"))
  }
  return text
}

void describe("convertToKepub on a real book", () => {
  let dir: string
  let dest: string
  let converted: boolean

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "kepub-test-"))
    dest = join(dir, "moby-dick.kepub.epub")
    converted = await convertToKepub(FIXTURE, dest)
  })

  after(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  void it("converts Moby Dick", () => {
    assert.strictEqual(converted, true)
  })

  void it("does not change one character of the book", async () => {
    // Checked here from the files themselves, not by asking the converter
    // whether it thinks it did well.
    const before = await spineText(FIXTURE)
    const after = await spineText(dest)

    assert.deepStrictEqual(
      [...after.keys()],
      [...before.keys()],
      "every chapter must still be there",
    )
    for (const [href, text] of before) {
      assert.strictEqual(after.get(href), text, `text changed in ${href}`)
    }
  })

  void it("gives the device spans to place her by", async () => {
    using epub = await Epub.from(dest)
    const items = (await epub.getSpineItems()).filter(
      (item) => item.mediaType === "application/xhtml+xml",
    )
    const chapter = await epub.readItemContents(items.at(-1)!.id, "utf-8")

    assert.match(chapter, /class="koboSpan"/, "spans must be in the markup")
    assert.match(chapter, /id="kobo\.\d+\.\d+"/, "ids must be kobo.N.M")
  })

  void it("is still a readable EPUB, and still a zip", async () => {
    // If the container is broken the device may reject it, or worse, take it.
    const bytes = await readFile(dest)
    assert.deepStrictEqual(
      [...bytes.subarray(0, 4)],
      [0x50, 0x4b, 0x03, 0x04],
      "must be a zip",
    )

    using epub = await Epub.from(dest)
    await Epub.assertEpub3(epub)
    assert.ok((await epub.getSpineItems()).length > 0)
  })
})
