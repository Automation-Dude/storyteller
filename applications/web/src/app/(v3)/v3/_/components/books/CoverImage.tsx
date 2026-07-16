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
        "relative",
        type === "audiobook" ? "aspect-square" : "aspect-2/3",
        className,
        "rounded-xs",
      )}
      style={backgroundStyle}
    >
      {/* {type === "ebook" && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right,
                rgba(0,0,0,0.02) 0%,
                rgba(0,0,0,0.05) 0.75%,
                rgba(255,255,255,0.5) 1.0%,
                rgba(255,255,255,0.6) 1.3%,
                rgba(255,255,255,0.5) 1.4%,
                rgba(255,255,255,0.3) 1.5%,
                rgba(255,255,255,0.3) 2.4%,
                rgba(0,0,0,0.05) 2.7%,
                rgba(0,0,0,0.05) 3.5%,
                rgba(255,255,255,0.3) 4%,
                rgba(255,255,255,0.3) 4.5%,
                rgba(244,244,244,0.1) 5.4%,
                rgba(244,244,244,0.1) 99%,
                rgba(144,144,144,0.2) 100%)`,
          }}
        />
      )}
      {type === "audiobook" && (
        <div
          className="absolute inset-0"
          style={{
            width: `calc(100% + 17px)`,
            insetInlineStart: "-8px",
            insetBlockStart: "-0px",
            backgroundImage: `repeating-linear-gradient(
      to right,
      rgba(0, 0, 0, 1),
      rgba(20, 20, 20, 1) 4%,
      rgba(0, 0, 0, 1)  8%
    ),
    linear-gradient(
      to right,
      rgb(15, 15, 15) 1px,
      rgb(31, 31, 31) 2px,
      rgb(41, 41, 41) 3px,
      transparent 11%
    ),
    linear-gradient(
      to right,
      rgb(15, 15, 15),
      rgb(13, 13, 13) 2%,
      rgb(0, 0, 0) 10.4%,
      rgba(255, 255, 255, 0.5) 11%,
      rgba(255, 255, 255, 0.2) 12%,
      rgba(236, 254, 253, 0.03) 100%
    )`,
            backgroundSize: "10% 100%, 100% 100%, 100% 100%",
            backgroundRepeat: "no-repeat, no-repeat, no-repeat",

            boxShadow: `inset 1px 2px 2px 1px rgba(230, 255, 255, 0.13),
      inset 0 0 0 1px rgba(255, 255, 255, 0.2), -4px 2px 20px 0px rgba(0, 0, 0, 0.1),
      -8px 8px 20px 0 rgba(0, 0, 0, 0.2)`,
          }}
        ></div>
      )} */}
      <img
        ref={imgRef}
        src={src}
        // so covers loading arent blocking eg next batch of infinite query
        fetchPriority="low"
        alt={alt}
        aria-hidden={ariaHidden}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-75",
          loaded ? "opacity-100" : "opacity-0",
          // type === "audiobook" ? "ml-2" : "",
          imgClassName,
        )}
      />
    </div>
  )
}
