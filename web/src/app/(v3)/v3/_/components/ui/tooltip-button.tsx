"use client"

import { type Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { type VariantProps } from "class-variance-authority"

import { Button, type buttonVariants } from "./button"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

type TooltipButtonProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof buttonVariants> & {
    tooltip: React.ReactNode
    tooltipSide?: TooltipPrimitive.Positioner.Props["side"]
    tooltipAlign?: TooltipPrimitive.Positioner.Props["align"]
    delay?: number
    /* required bc you will forget it */
    "aria-label": string
    tooltipClassName?: string
  }

export function TooltipButton({
  tooltip,
  tooltipSide,
  tooltipAlign,
  tooltipClassName,
  delay,
  ...buttonProps
}: TooltipButtonProps) {
  return (
    <Tooltip delay={delay}>
      <TooltipTrigger render={<Button size="icon-sm" {...buttonProps} />} />
      <TooltipContent
        side={tooltipSide}
        align={tooltipAlign}
        className={tooltipClassName}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
