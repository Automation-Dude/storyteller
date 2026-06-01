"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { type JsColor } from "@storyteller-platform/okmain"

import { cn } from "@/cn"

import { FallbackCover } from "./BookCover"
import { getBlurhashDataUri } from "./blurhash-data-uri"

type CoverImageProps = {
  src: string
  alt: string
  blurhash: string | null | undefined
  type: "audiobook" | "ebook"
  fallbackColors?: JsColor[] | null
  className?: string
  imgClassName?: string
  ariaHidden?: boolean
  onLoadingChange?: (loading: boolean) => void
}

export function CoverImage({
  src,
  alt,
  blurhash,
  type,
  fallbackColors,
  className,
  imgClassName,
  ariaHidden,
  onLoadingChange,
}: CoverImageProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const onLoadingChangeRef = useRef(onLoadingChange)
  onLoadingChangeRef.current = onLoadingChange

  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const backgroundStyle = useMemo(() => {
    const uri = getBlurhashDataUri(blurhash)
    if (!uri) return undefined

    return {
      backgroundImage: `url(${uri})`,
      backgroundSize: "cover",
    } as const
  }, [blurhash])

  const handleLoad = useCallback(() => {
    setLoaded(true)
  }, [])

  const handleError = useCallback(() => {
    setError(true)
  }, [])

  useEffect(() => {
    setLoaded(false)
    setError(false)
  }, [src])

  useEffect(() => {
    const img = imgRef.current
    if (!img || !img.complete) return

    if (img.naturalWidth === 0) {
      setError(true)
    } else {
      setLoaded(true)
    }
  }, [src])

  useEffect(() => {
    onLoadingChangeRef.current?.(!loaded && !error)
  }, [loaded, error])

  if (error) {
    return (
      <FallbackCover
        title={alt}
        type={type}
        colors={fallbackColors}
        className={className}
      />
    )
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        type === "audiobook" ? "aspect-square" : "aspect-2/3",
        className,
      )}
      style={backgroundStyle}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        aria-hidden={ariaHidden}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-75",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
      />
    </div>
  )
}
