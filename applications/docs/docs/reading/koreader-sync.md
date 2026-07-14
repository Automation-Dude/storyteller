---
sidebar_position: 98
---

# KOReader sync (Kobo, Kindle, PocketBook)

Storyteller can sync your reading position with [KOReader](https://koreader.rocks/),
the open source reader that runs on Kobo, jailbroken Kindle, PocketBook, Boox
and others. Read a few chapters on your Kobo, and the Storyteller apps pick up
where you left off. Listen in the app, and the e-reader follows.

This is Storyteller's own sync server, speaking the same protocol as KOReader's
built-in progress sync plugin. There is nothing extra to install and no third
party service involved.

:::info What this does and does not do

E-ink devices cannot play the synced narration in a readaloud. What syncs is
your **position**, so you can move between an e-reader and the Storyteller apps
without losing your place.

:::

## The easy way: Set up my e-reader

If your device is a Kobo, the simplest path is the **Set up my e-reader** page
in Storyteller. On a computer, using Chrome or Edge:

1. Sign in to Storyteller and open **Set up my e-reader** from the menu.
2. Plug your Kobo into the computer with its cable and choose **Connect** on the
   device if asked.
3. Click **Set up my e-reader** and pick your Kobo when prompted.
4. Wait for it to finish, then unplug. Your Kobo restarts, and KOReader is
   installed with your library already loaded and position sync already logged
   in. You never type a server address or password on the device.

This installs KOReader and writes its configuration for you, using a per-device
credential rather than your Storyteller password, so a lost device can be
revoked on its own. It needs the **OPDS feed** and **KOReader sync** enabled in
settings (below). The rest of this page covers setting a device up by hand, or
for readers other than a Kobo.

## Enabling it

1. Open your Storyteller settings and find **KOReader sync settings**.
2. Turn on **Enable KOReader sync**.
3. Leave **Allow device registration** on while you set your devices up. It
   lets a device create its own sync account, as long as the username matches
   an existing Storyteller user. Turn it off once your devices are registered.
4. The settings page shows your sync server URL. It looks like
   `https://your-storyteller-server/kosync`.

## Setting up a device

On the device, in KOReader:

1. Open any book. KOReader only shows the sync menu with a book open.
2. Go to **Tools**, then **Progress sync**.
3. Choose **Custom sync server** and enter the URL from your settings page.
4. Choose **Register** and use your **Storyteller username** and password.

KOReader hashes your password on the device before sending it, so your
Storyteller password is never transmitted to the sync endpoints.

After that, **Push progress** and **Pull progress** work from the same menu,
and KOReader syncs automatically as you read.

## Getting your books onto the device

Use the [OPDS feed](opds.md). KOReader can browse and download your whole
library straight from Storyteller.

Books downloaded from Storyteller are **matched automatically**: the server
records a fingerprint of the exact file it sent you, which is the same
fingerprint KOReader computes on the device.

A book you copied to the device some other way (from a different source, or one
converted along the way) still syncs between your KOReader devices, but
Storyteller cannot tell which book in your library it is, so it will not move
the position in the Storyteller apps. Download it from Storyteller once and the
matching sorts itself out.

:::tip Prefer the plain ebook for e-ink

Readaloud files carry the audio, which makes them large. In your OPDS settings,
set **Preferred ebook** to "Ebook, or readaloud if unavailable" so low powered
devices download the small file.

:::

## Device notes

- **Kobo**: works out of the box. KOReader's automatic sync needs "Action when
  Wi-Fi is off" set to "turn on"; otherwise use Push and Pull from the menu.
- **Kindle**: needs a jailbroken device running KOReader. The stock Kindle
  software cannot sync with Storyteller.
- **PocketBook, Boox, reMarkable**: anything running KOReader works the same
  way.

## Troubleshooting

**"Unauthorized" when registering or syncing.** Registration needs an existing
Storyteller user with that exact username, and **Allow device registration**
must be on. Check both in your settings.

**Position syncs between devices but the apps do not move.** The book on the
device is not a file Storyteller served. Download it again from the OPDS feed.

**Nothing syncs at all.** KOReader's sync menu only appears with a book open,
and the custom sync server URL must include the scheme (`https://`).
