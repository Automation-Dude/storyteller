"use client"

import { decode } from "blurhash"
import { type TransitionEventHandler, memo, useEffect, useRef } from "react"

import { cn } from "@/cn"

type BlurhashCanvasProps = {
  blurhash: string | null | undefined
  width?: number
  height?: number
  className?: string
  onTransitionEnd?: TransitionEventHandler<HTMLElement>
}

export const BlurhashCanvas = memo(function BlurhashCanvas({
  blurhash,
  width = 32,
  height = 32,
  className,
  onTransitionEnd,
}: BlurhashCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !blurhash) return

    try {
      const pixels = decode(blurhash, width, height)
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const imageData = ctx.createImageData(width, height)
      imageData.data.set(pixels)
      ctx.putImageData(imageData, 0, 0)
    } catch {
      console.error("Invalid blurhash string", blurhash)
      // invalid blurhash string
    }
  }, [blurhash, width, height])

  if (!blurhash) {
    return (
      <div
        className={cn(
          "from-primary/30 to-primary/10 absolute inset-0 h-full w-full bg-linear-to-br backdrop-blur-sm",
          className,
        )}
        onTransitionEnd={onTransitionEnd}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn("absolute inset-0 h-full w-full", className)}
      onTransitionEnd={onTransitionEnd}
    />
  )
})
