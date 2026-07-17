import assert from "node:assert"
import { describe, it } from "node:test"

import {
  KFMON_INSTALLER_PATH,
  MINIMUM_FIRMWARE,
  isDeviceInstalledConfig,
  isFirmwareSupported,
  kfmonEntriesInWriteOrder,
  koreaderEntryToDevicePath,
  patchEReaderConf,
} from "@/ereader/client/plan"

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

void describe("kfmonEntriesInWriteOrder", () => {
  // The package as shipped lists the installer first; writing it in that order
  // would let an interrupted setup reboot into a KFMon with no icon to launch.
  const packaged = [
    KFMON_INSTALLER_PATH,
    ".adds/kfmon/config/koreader.ini",
    "koreader.png",
    "icons/plato.png",
  ]

  void it("writes the installer last, after the icon and watch config", () => {
    const ordered = kfmonEntriesInWriteOrder(packaged)
    assert.strictEqual(ordered.at(-1), KFMON_INSTALLER_PATH)
    assert.ok(
      ordered.indexOf("koreader.png") < ordered.indexOf(KFMON_INSTALLER_PATH),
    )
    assert.ok(
      ordered.indexOf(".adds/kfmon/config/koreader.ini") <
        ordered.indexOf(KFMON_INSTALLER_PATH),
    )
  })

  void it("keeps every entry exactly once", () => {
    const ordered = kfmonEntriesInWriteOrder(packaged)
    assert.strictEqual(ordered.length, packaged.length)
    assert.deepStrictEqual([...ordered].sort(), [...packaged].sort())
  })

  void it("preserves the relative order of the other entries", () => {
    const ordered = kfmonEntriesInWriteOrder(packaged)
    assert.deepStrictEqual(
      ordered.filter((path) => path !== KFMON_INSTALLER_PATH),
      [".adds/kfmon/config/koreader.ini", "koreader.png", "icons/plato.png"],
    )
  })

  void it("is a no-op for a package that carries no installer", () => {
    const withoutInstaller = ["koreader.png", ".adds/kfmon/config/kfmon.ini"]
    assert.deepStrictEqual(
      kfmonEntriesInWriteOrder(withoutInstaller),
      withoutInstaller,
    )
  })
})

void describe("isFirmwareSupported", () => {
  void it("accepts the firmware on real hardware", () => {
    // A Kobo Clara Colour, read from its own .kobo/version.
    assert.strictEqual(isFirmwareSupported("4.45.23697"), true)
  })

  void it("accepts exactly the minimum, and rejects just below it", () => {
    assert.strictEqual(isFirmwareSupported(MINIMUM_FIRMWARE), true)
    assert.strictEqual(isFirmwareSupported("2.9.1"), true)
    assert.strictEqual(isFirmwareSupported("2.8.9"), false)
    assert.strictEqual(isFirmwareSupported("1.9.9"), false)
  })

  void it("compares numerically, not as text", () => {
    // "2.10.0" sorts before "2.9.0" as a string but is newer.
    assert.strictEqual(isFirmwareSupported("2.10.0"), true)
    // 45 > 9 only if the minor is read as a number.
    assert.strictEqual(isFirmwareSupported("2.45.0"), true)
  })

  void it("refuses rather than guesses when the version is unreadable", () => {
    // Failing closed matters: this gate is what keeps setup off firmware
    // whose startup script we should not be replacing.
    assert.strictEqual(isFirmwareSupported("unknown"), false)
    assert.strictEqual(isFirmwareSupported(""), false)
    assert.strictEqual(isFirmwareSupported("4.x.1"), false)
  })
})

void describe("isDeviceInstalledConfig", () => {
  void it("claims KFMon's config dir, which the browser must not write", () => {
    assert.strictEqual(
      isDeviceInstalledConfig(".adds/kfmon/config/koreader.ini"),
      true,
    )
    assert.strictEqual(
      isDeviceInstalledConfig(".adds/kfmon/config/kfmon.ini"),
      true,
    )
  })

  void it("leaves the files the browser does write alone", () => {
    assert.strictEqual(
      isDeviceInstalledConfig(".adds/kfmon/bin/kfmon-printlog.sh"),
      false,
    )
    assert.strictEqual(isDeviceInstalledConfig("koreader.png"), false)
    assert.strictEqual(isDeviceInstalledConfig(KFMON_INSTALLER_PATH), false)
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
