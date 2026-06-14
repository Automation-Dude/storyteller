"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@v3/_/lib/utils"

function Slider({
  className,
  ...props
}: SliderPrimitive.Root.Props & { className?: string }) {
  return (
    <SliderPrimitive.Root data-slot="slider" {...props}>
      <SliderPrimitive.Control
        className={cn(
          "flex w-full touch-none items-center py-2 select-none",
          className,
        )}
      >
        <SliderPrimitive.Track className="bg-muted relative h-1.5 w-full grow rounded-full">
          <SliderPrimitive.Indicator className="bg-primary absolute h-full rounded-full" />
          <SliderPrimitive.Thumb className="border-primary bg-background ring-ring/30 block size-4 rounded-full border-2 shadow-sm transition-shadow outline-none focus-visible:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-50" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

function VerticalSlider({
  className,
  ...props
}: SliderPrimitive.Root.Props & { className?: string }) {
  return (
    <SliderPrimitive.Root data-slot="slider" orientation="vertical" {...props}>
      <SliderPrimitive.Control
        className={cn(
          "flex w-full touch-none items-center py-2 select-none",
          className,
        )}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-muted relative h-full w-1.5 grow rounded-full"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-indicator"
            className="bg-primary absolute h-full rounded-full"
          />
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            className="border-primary bg-background ring-ring/30 block size-4 rounded-full border-2 shadow-sm transition-shadow outline-none focus-visible:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-50"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider, VerticalSlider }
