import assert from "node:assert"
import { describe, it } from "node:test"

import { generateKosyncLua, generateOpdsLua } from "@/ereader/config"

// Balanced-brace check: a cheap proxy for "this is a well-formed table
// literal", enough to catch a stray escape terminating the file early.
function bracesBalanced(source: string): boolean {
  let depth = 0
  let inString = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === "\\") {
      i++ // skip the escaped character
      continue
    }
    if (ch === '"') inString = !inString
    else if (!inString && ch === "{") depth++
    else if (!inString && ch === "}") depth--
    if (depth < 0) return false
  }
  return depth === 0 && !inString
}

void describe("OPDS config generation", () => {
  void it("emits a single returned table with the catalog and credentials", () => {
    const lua = generateOpdsLua([
      {
        title: "My Library",
        url: "https://books.example.com/opds",
        username: "alice",
        password: "device-secret",
      },
    ])

    assert.ok(lua.includes("return {"))
    assert.ok(bracesBalanced(lua))
    // Exactly the values KOReader will read, as Lua literals.
    assert.ok(lua.includes('["title"] = "My Library"'))
    assert.ok(lua.includes('["url"] = "https://books.example.com/opds"'))
    assert.ok(lua.includes('["username"] = "alice"'))
    assert.ok(lua.includes('["password"] = "device-secret"'))
    // One catalog in, one server block out.
    assert.strictEqual(lua.match(/\["url"\] =/g)?.length, 1)
  })

  void it("emits one server block per catalog", () => {
    const lua = generateOpdsLua([
      { title: "A", url: "https://a/opds", username: "u", password: "p" },
      { title: "B", url: "https://b/opds", username: "u", password: "p" },
    ])
    assert.ok(bracesBalanced(lua))
    assert.strictEqual(lua.match(/\["url"\] =/g)?.length, 2)
  })

  void it("escapes characters that would break the Lua file", () => {
    // A title with a quote and a backslash must not terminate the string early.
    const lua = generateOpdsLua([
      {
        title: 'Jordan\'s "Books" \\ Stuff',
        url: "https://x/opds",
        username: "u",
        password: "p",
      },
    ])
    assert.ok(bracesBalanced(lua))
    // Backslash doubled, embedded quote backslash-escaped, single quote left as-is.
    assert.ok(lua.includes('["title"] = "Jordan\'s \\"Books\\" \\\\ Stuff"'))
  })
})

void describe("kosync config generation", () => {
  void it("seeds the login and turns on auto sync", () => {
    const lua = generateKosyncLua({
      customServer: "https://books.example.com/kosync",
      username: "alice",
      userkey: "5f4dcc3b5aa765d61d8327deb882cf99",
    })

    assert.ok(lua.includes("return {"))
    assert.ok(bracesBalanced(lua))
    assert.ok(
      lua.includes('["custom_server"] = "https://books.example.com/kosync"'),
    )
    assert.ok(lua.includes('["username"] = "alice"'))
    assert.ok(
      lua.includes('["userkey"] = "5f4dcc3b5aa765d61d8327deb882cf99"'),
    )
    assert.ok(lua.includes('["auto_sync"] = true'))
    // Binary match, so the same book lines up across devices and with the server.
    assert.ok(lua.includes('["checksum_method"] = 0'))
  })

  void it("never contains a plaintext password field", () => {
    const lua = generateKosyncLua({
      customServer: "https://x/kosync",
      username: "alice",
      userkey: "abc123",
    })
    // kosync only ever stores the userkey; a plaintext password must not leak in.
    assert.ok(!/password/.test(lua))
  })
})
