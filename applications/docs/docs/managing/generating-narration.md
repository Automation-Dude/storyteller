---
sidebar_position: 3
---

# Generating narration

---

Storyteller aligns an ebook to an audiobook to produce a readaloud. Normally
that means you have to supply both. Narration generation lets Storyteller make
the audiobook itself, using a local text-to-speech voice, so you can produce a
readaloud from a book that only has an ebook.

The generated audiobook is kept as the book's audiobook, exactly like one you
uploaded, and the readaloud is aligned from it. Everything runs on your own
server. There are no API keys, no credits, and no paid third-party services.

:::info This is off by default

Narration generation changes nothing until you turn it on. With it off, a book
that has only an ebook stays unprocessable, the same as before.

:::

---

## Requirements

1. An **EPUB book** with no audiobook. If a book already has an audiobook,
   Storyteller aligns to that audiobook and does not generate narration.
2. **Narration turned on** in Settings (see below). The first time it runs, the
   voice model downloads once (a few hundred megabytes) into the same cache your
   whisper models live in, so it survives container recreation.

---

## Turning it on

Open **Settings** and find the **Narration (text-to-speech)** section.

- **Narration engine**: choose **Kokoro** for the best quality. Leave it on
  **Off** to keep the default behaviour. (Kokoro is a small, high-quality model
  that runs fully on the CPU.)
- **Voice**: pick from the built-in voice library. The prefix tells you the
  accent and gender: `af` and `am` are US female and male, `bf` and `bm` are UK
  female and male.
- **Speed**: the narration speed. `1` is natural; lower is slower.
- **Audiobook format**: `m4b` produces a single chaptered audiobook file (the
  usual audiobook format). `mp3` and `m4a` write one file per chapter instead.

Save the settings. That is all the setup there is. No SSH, no server
configuration, no rebuild.

---

## Generating a readaloud from an ebook

Once narration is on, a book that has only an ebook becomes processable. Open
its details page and click **Create readaloud**, or select it in the library and
use the bulk **Begin processing** action, exactly as you would for a book that
already has an audiobook.

Storyteller then runs the normal pipeline with one extra step at the front:

1. **Generating narration**: the ebook is read in reading order and each chapter
   is synthesized to speech, then muxed into a chaptered audiobook and saved as
   the book's audiobook.
2. **Splitting, transcribing, and aligning**: the generated audiobook flows
   through the same steps as a human-narrated one, producing the readaloud.

The result is a normal readaloud: word-synced highlighting, variable-speed
playback, chapter navigation, and position sync across devices.

---

## How long it takes

Narration generation is a CPU task, so its speed depends on your hardware. On a
modern CPU it runs faster than real time; on older server CPUs it is a few times
slower, so a full novel is a matter of hours and a single chapter is minutes.
Because the generated audiobook is then transcribed and aligned like any other,
the total time is the generation time plus the usual alignment time.

You can limit how much of the machine it uses with the same `--memory` and
`--cpus` Docker flags described in
[Speeding up the alignment process](managing/aligning.md#speeding-up-the-alignment-process).

---
