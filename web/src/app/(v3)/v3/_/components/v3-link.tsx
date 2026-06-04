"use client"

import Link from "next/link"

import { useVersionBasePath } from "@v3/_/components/version-context"

export const V3Link = (props: Parameters<typeof Link>[0]) => {
  const basePath = useVersionBasePath()

  if (typeof props.href === "string") {
    const prefixedHref = props.href.startsWith("/")
      ? `${basePath}${props.href}`
      : props.href

    return <Link {...props} href={prefixedHref} />
  }

  return <Link {...props} />
}
