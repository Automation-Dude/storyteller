"use client"

import { parseAsBoolean, useQueryState } from "nuqs"

// shared `report` query flag: when true, an open book detail panel shows the
// alignment report in place of the normal sections (hero stays). lives in the
// url so it survives reloads and can be deep-linked. every entry point sets it
// explicitly (true for report, false for details) so a stale value never leaks
// into the next book opened.
export function useReportPanel() {
  return useQueryState("report", parseAsBoolean.withDefault(false))
}
