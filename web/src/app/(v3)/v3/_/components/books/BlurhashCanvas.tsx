"use client"

import { decode } from "blurhash"
import { memo, useEffect, useRef } from "react"

import { cn } from "@/cn"

type BlurhashCanvasProps = {
  blurhash: string | null | undefined
  width?: number
  height?: number
  className?: string
}

export const BlurhashCanvas = memo(function BlurhashCanvas({
  blurhash,
  width = 32,
  height = 32,
  className,
}: BlurhashCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  console.log("blurhash", blurhash)
  useEffect(() => {
    console.log("useEffect", blurhash)
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
      // invalid blurhash string
    }
  }, [blurhash, width, height])

  if (!blurhash)
    return (
      <div
        className={cn(
          "from-primary/30 to-primary/10 absolute inset-0 h-full w-full bg-linear-to-br backdrop-blur-sm",
          className,
        )}
      />
    )

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn("absolute inset-0 h-full w-full", className)}
    />
  )
})
