# Storyteller Desktop

A Tauri shell that bundles a Node runtime plus the Next.js standalone server and
serves the regular Storyteller web app from `http://127.0.0.1:<port>` in a
native window. The runtime layout mirrors the Docker runner stage and
`nix/package.nix`.

## How it works

- `scripts/fetch-binaries.ts` downloads the four sidecar binaries for a target
  triple into `src-tauri/binaries/`: `node` (nodejs.org, checksum-verified),
  `readium` (readium/cli GitHub release, checksum-verified), `ffmpeg` and
  `ffprobe` (static builds: martin-riedl.de on macOS, BtbN on Linux/Windows).
- `scripts/assemble-runtime.ts` builds the web workspace and stages the
  standalone tree (plus workers, migrations, native addons, sqlite uuid
  extension, align prebuild for the target platform) into
  `src-tauri/resources/runtime.tar.gz`. Must run on the platform it targets —
  the tree contains host-compiled native addons.
- The Rust shell extracts the tarball into the per-user app data dir on first
  launch (version-keyed by tarball hash), generates a secret key, picks free
  ports, spawns `node server.js` with the same env the Docker image uses, polls
  `/api/health`, and then navigates the window to the local server. On quit it
  SIGTERMs the server so readium and sqlite shut down cleanly.
- whisper.cpp is not bundled: ghost-story downloads the right variant (CoreML on
  Apple Silicon) on first transcription, same as always.

Server logs land in the app data dir as `server.log`
(`~/Library/Application Support/dev.storyteller-platform.desktop/` on macOS).
Library data lives in `data/` next to it.

## Building

```sh
yarn workspace @storyteller-platform/desktop build
```

That runs fetch-binaries + assemble-runtime (including the full web build) and
then `tauri build`. Artifacts land in `src-tauri/target/release/bundle/`.

After changing only the shell, skip the web rebuild:

```sh
yarn workspace @storyteller-platform/desktop assemble-runtime --skip-build
yarn workspace @storyteller-platform/desktop build:app-only
```

Requires: Rust toolchain, plus the regular web build prerequisites.

## Dev mode

`yarn workspace @storyteller-platform/desktop dev` opens the window against the
next dev server on `localhost:8001` — start `yarn dev:web` first. The boot flow
(extract/spawn) is skipped in debug builds; set `STORYTELLER_DESKTOP_BOOT=1` to
exercise it.

Useful env overrides for the shell:

- `STORYTELLER_DESKTOP_SERVER_URL` — attach to an already-running server instead
  of spawning one.
- `STORYTELLER_DESKTOP_RUNTIME_DIR` — use a pre-extracted runtime tree.
- `STORYTELLER_DESKTOP_PORT` — pin the server port.

## Configuration

The server port defaults to 8756 (falling back to a random free port). To pin
it, either set `STORYTELLER_DESKTOP_PORT` or create `desktop.json` in the app
data dir:

```json
{ "port": 12345 }
```

A pinned port that is already taken is a startup error, not a silent fallback.

## Navigation

The webview has no browser chrome; the History menu provides Back
(`Cmd/Ctrl+[`), Forward (`Cmd/Ctrl+]`), Reload (`Cmd/Ctrl+R`), and Go to Library
(`Cmd/Ctrl+Shift+H`) so you can always get out of a dead end.

## Windows notes

- `sqlite/uuid.c` must be compiled to `uuid.c.dll` before assembly
  (`cl /LD sqlite/uuid.c`); `build-sqlite-ext.sh` only covers macOS/Linux.
- Shutdown uses `taskkill /T /F` (no POSIX signals); whisper/okmain specifics
  are handled on a separate branch.

## Not yet done

- CI jobs per platform, codesigning/notarization (entitlements are already in
  `src-tauri/Entitlements.plist`), auto-updates, `.epub` file associations.
