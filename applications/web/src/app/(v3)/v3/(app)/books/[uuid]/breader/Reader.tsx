/* eslint-disable no-console */
"use client"

import { BookWithRelations } from "@/database/books"
import { createCacheBustingFetch } from "@/utils/cacheBustingFetch"
import { AudioNavigator } from "@readium/new-navigator"
import { Manifest } from "@readium/new-shared"
import { HttpFetcher } from "@readium/new-shared"
import { Publication } from "@readium/new-shared"
import { useEffect, useMemo, useState } from "react"

export function Reader({ book }: { book: BookWithRelations }) {
  const publication = usePublication(book)
  const navigator = useMemo(() => {
    if (!publication) return null
    console.log("publication", publication)
    return new AudioNavigator(
      publication,
      {
        play: () => {
          console.log("play")
        },
        pause: () => {
          console.log("pause")
        },
        trackLoaded: (e) => {
          console.log("trackLoaded", e)
        },
        trackEnded: (e) => {
          console.log("trackEnded", e)
        },
        seeking: (e) => {
          console.log("seeking", e)
        },
        remotePlaybackStateChanged: (e) => {
          console.log("remotePlaybackStateChanged", e)
        },
        seekable: (e) => {
          console.log("seekable", e)
        },
        error: (e) => {
          console.log("error", e)
        },
        metadataLoaded: (e) => {
          console.log("metadataLoaded", e)
        },
        peripheral: (e) => {
          console.log("peripheral", e)
        },
        stalled: (e) => {
          console.log("stalled", e)
        },
        contentProtection: (e) => {
          console.log("contentProtection", e)
        },
        contextMenu: (e) => {
          console.log("contextMenu", e)
        },
        positionChanged: () => {
          console.log("positionChanged")
        },
        timelineItemChanged: () => {
          console.log("timelineItemChanged")
        },
      },
      undefined,
      {
        defaults: {},
        preferences: {},
      },
    )
  }, [book])

  return (
    <div className="relative mx-auto h-full [&>iframe]:relative [&>iframe]:h-full [&>iframe]:w-full"></div>
  )
}

const usePublication = (book: BookWithRelations) => {
  const [manifest, setManifest] = useState<Manifest>(null)

  useEffect(() => {
    const fetchManifest = async () => {
      const manifesti = await fetch(
        `/api/v2/books/${book.uuid}/listen/manifest.json`,
      )
      const manifest = await manifesti.json()
      console.log("manifest", manifest)
      delete manifest.links
      setManifest(Manifest.deserialize(manifest))
    }
    void fetchManifest()
  }, [book.uuid])

  const baseUrl = `${window.location.origin}/api/v2/books/${book.uuid}/listen`
  const publication = manifest
    ? new Publication({
        manifest,
        fetcher: new HttpFetcher(createCacheBustingFetch({ book }), baseUrl),
      })
    : null

  return publication
}
