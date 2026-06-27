import {
  type DateTimeFormatOptions,
  type NumberFormatOptions,
  type RelativeTimeFormatOptions,
  useFormatter,
} from "next-intl"

export const DEFAULT_DATE_OPTIONS: DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
}

export function useFormatDate() {
  const { dateTime } = useFormatter()

  return (
    date: string | null | Date,
    options?: DateTimeFormatOptions,
  ): string => {
    if (!date) return ""
    return dateTime(new Date(date), {
      ...DEFAULT_DATE_OPTIONS,
      ...options,
    })
  }
}

export function useFormatRelativeTime() {
  const { relativeTime } = useFormatter()

  return (
    date: string | null | Date,
    options?: RelativeTimeFormatOptions,
  ): string => {
    if (!date) return ""
    return relativeTime(new Date(date), {
      style: "short",
      ...options,
    })
  }
}

export function useFormatNumber() {
  const { number } = useFormatter()

  return (value: number, options?: NumberFormatOptions): string => {
    if (!value) return ""
    return number(value, {
      ...options,
    })
  }
}

export function useFormatList() {
  const { list } = useFormatter()

  return (value: string[], options?: Intl.ListFormatOptions): string => {
    return list(value, {
      ...options,
    })
  }
}
