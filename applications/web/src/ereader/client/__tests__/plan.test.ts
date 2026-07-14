import assert from "node:assert"
import { describe, it } from "node:test"

import { koreaderEntryToDevicePath, patchEReaderConf } from "@/ereader/client/plan"

void describe("koreaderEntryToDevicePath", () => {
  void it("puts the koreader tree and launcher icon under .adds", () => {
    assert.strictEqual(
      koreaderEntryToDevicePath("koreader/reader.lua"),
      ".adds/koreader/reader.lua",
    )
    assert.strictEqual(
      koreaderEntryToDevicePath("koreader.png"),
      ".adds/koreader.png",
    )
    assert.strictEqual(
      koreaderEntryToDevicePath("koreader/settings/opds.lua"),
      ".adds/koreader/settings/opds.lua",
    )
  })

  void it("tolerates a leading slash on the entry", () => {
    assert.strictEqual(
      koreaderEntryToDevicePath("/koreader/reader.lua"),
      ".adds/koreader/reader.lua",
    )
  })
})

void describe("patchEReaderConf", () => {
  void it("creates the section and exclusion on an empty conf", () => {
    const result = patchEReaderConf(null)
    assert.match(result, /^\[FeatureSettings\]$/m)
    assert.match(result, /^ExcludeSyncFolders=\\\.\(\?:adds\|kobo\)$/m)
  })

  void it("adds the exclusion into an existing FeatureSettings section", () => {
    const conf = "[FeatureSettings]\nSomeOther=1\n\n[OtherSection]\nx=y\n"
    const result = patchEReaderConf(conf)
    assert.match(result, /^ExcludeSyncFolders=/m)
    // The pre-existing key and other section survive.
    assert.match(result, /^SomeOther=1$/m)
    assert.match(result, /^\[OtherSection\]$/m)
    assert.match(result, /^x=y$/m)
  })

  void it("never overwrites a user's existing ExcludeSyncFolders", () => {
    // The user may have their own exclusion list; adding ours must not clobber it.
    const conf = "[FeatureSettings]\nExcludeSyncFolders=\\.(?:private)\n"
    const result = patchEReaderConf(conf)
    assert.strictEqual(result, conf)
    assert.strictEqual(result.match(/ExcludeSyncFolders=/g)?.length, 1)
  })

  void it("appends a section when the conf has other sections but no FeatureSettings", () => {
    const conf = "[PowerOptions]\nsuspend=10\n"
    const result = patchEReaderConf(conf)
    assert.match(result, /^\[PowerOptions\]$/m)
    assert.match(result, /^suspend=10$/m)
    assert.match(result, /^\[FeatureSettings\]$/m)
    assert.match(result, /^ExcludeSyncFolders=/m)
  })
})
