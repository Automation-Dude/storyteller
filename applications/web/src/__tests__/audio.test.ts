import assert from "node:assert"
import { extname, join } from "node:path"
import { describe, it } from "node:test"

import {
  COVER_IMAGE_FILE_EXTENSIONS,
  getTrackDuration,
  isAudioFile,
} from "@/audio"
import { optimizedContentType } from "@/images"

void describe("getTrackInfo", () => {
  void it("can get track duration from an mp3 file", async () => {
    const duration = await getTrackDuration(
      join("src", "__fixtures__", "mp3", "mobydick_001_002_melville.mp3"),
    )
    assert.strictEqual(Math.floor(duration), 1436)
  })

  void it("can get track info from an mp4 file", async () => {
    const duration = await getTrackDuration(
      join(
        "src",
        "__fixtures__",
        "mpeg4",
        "MobyDickOrTheWhalePart1_librivox.m4b",
      ),
    )
    assert.strictEqual(Math.floor(duration), 18742)
  })
})

void describe("isAudioFile", () => {
  void it("recognizes mp3, mp4, and opus formats", () => {
    assert.ok(isAudioFile(".mp3"))
    assert.ok(isAudioFile(".m4a"))
    assert.ok(isAudioFile(".m4b"))
    assert.ok(isAudioFile(".mp4"))
    assert.ok(isAudioFile(".aac"))
    assert.ok(isAudioFile(".ogg"))
    assert.ok(isAudioFile(".oga"))
    assert.ok(isAudioFile(".opus"))
  })

  void it("recognizes file formats we don't use", () => {
    assert.ok(isAudioFile(".flac"))
    assert.ok(isAudioFile(".wav"))
  })

  void it("does not recognize other formats", () => {
    assert.ok(!isAudioFile(".json"))
    assert.ok(!isAudioFile(".epub"))
    assert.ok(!isAudioFile(".html"))
    assert.ok(!isAudioFile(".zip"))
    assert.ok(!isAudioFile(".txt"))
  })

  void it("works with full file names", () => {
    assert.ok(isAudioFile("somefile.m4b"))
    assert.ok(isAudioFile("audiobook/chapter 1.mp3"))
    assert.ok(isAudioFile("audio.book/chapter.1.flac"))
    assert.ok(!isAudioFile("cover.png"))
    assert.ok(!isAudioFile("A Book.epub"))
    assert.ok(!isAudioFile("README.txt"))
  })
})

void describe("cover images", () => {
  void it("recognizes a GIF as a cover, so a GIF-only book is not blank", () => {
    // A book whose extracted cover is a GIF used to read as having no cover at
    // all, because this list left GIF out.
    assert.ok(COVER_IMAGE_FILE_EXTENSIONS.includes(".gif"))
    assert.ok(COVER_IMAGE_FILE_EXTENSIONS.includes(extname("cover.gif")))
  })

  void it("still recognizes the ordinary formats", () => {
    for (const ext of [".jpeg", ".jpg", ".png", ".svg"]) {
      assert.ok(COVER_IMAGE_FILE_EXTENSIONS.includes(ext), ext)
    }
  })
})

void describe("optimizedContentType", () => {
  void it("turns a GIF into a PNG, which every reader can show", () => {
    assert.strictEqual(optimizedContentType("image/gif"), "image/png")
  })

  void it("leaves every other type alone", () => {
    for (const type of [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/svg+xml",
    ]) {
      assert.strictEqual(optimizedContentType(type), type)
    }
  })
})
