"use client"

import { parseAsBoolean, useQueryState } from "nuqs"

export function useReportPanel() {
  return useQueryState(
    "report",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  )
}
