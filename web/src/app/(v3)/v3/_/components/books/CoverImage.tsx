"use client"

import { useEffect, useRef, useState } from "react"

import { type JsColor } from "@storyteller-platform/okmain"

import { cn } from "@/cn"

import { BlurhashCanvas } from "./BlurhashCanvas"
import { FallbackCover } from "./BookCover"

type CoverImageProps = {
  src: string
  alt: string
  blurhash: string | null | undefined
  type: "audiobook" | "ebook"
  fallbackColors?: JsColor[] | null
  className?: string
  imgClassName?: string
  ariaHidden?: boolean
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
}: CoverImageProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [showBlurhash, setShowBlurhash] = useState(true)

  // Cached images may already be complete by the time we mount,
  // so onLoad never fires. Sync state from the DOM in that case.
  useEffect(() => {
    const img = imgRef.current
    if (!img || !img.complete) return
    if (img.naturalWidth === 0) setError(true)
    else setLoaded(true)
  }, [src])

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
    <div className={cn("relative overflow-hidden", className)}>
      {showBlurhash && (
        <BlurhashCanvas
          blurhash={blurhash}
          className={cn(
            "relative h-full w-full transition-opacity duration-200",
            loaded && "opacity-0",
          )}
          onTransitionEnd={(e) => {
            if (e.propertyName === "opacity" && loaded) {
              setShowBlurhash(false)
            }
          }}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        aria-hidden={ariaHidden}
        loading="lazy"
        onLoad={() => {
          setLoaded(true)
        }}
        onError={() => {
          setError(true)
        }}
        className={cn(
          "relative z-10 h-full w-full object-cover transition-opacity duration-200",
          !loaded && "opacity-0",
          loaded && "opacity-100",
          imgClassName,
        )}
      />
    </div>
  )
}
