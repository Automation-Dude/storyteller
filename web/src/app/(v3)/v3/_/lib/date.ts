import { useFormatter } from "next-intl"

export function useFormatDate() {
  const { dateTime } = useFormatter()

  return (date: string | null | Date): string => {
    if (!date) return ""
    return dateTime(new Date(date), {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }
}
