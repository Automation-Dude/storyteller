// spine text fitting, backed by @chenglou/pretext.
//
// this is the *only* file in the app that imports pretext. to measure the
// bundle impact of removing it: delete this file, remove the fitSpine import +
// the small effect block in Book3D.tsx, and `yarn remove @chenglou/pretext`.
// the spine falls back to a single title line on its own, so nothing breaks.
import { measureLineStats, prepareWithSegments } from "@chenglou/pretext"

export type SpineFit = {
  titleLines: number // 1 or 2
  showAuthor: boolean // whether the author line fits stacked under the title
}

export const DEFAULT_SPINE_FIT: SpineFit = { titleLines: 1, showAuthor: false }

type FitArgs = {
  title: string
  author: string
  length: number // run available along the spine (px)
  thickness: number // cross dimension available for stacked lines (px)
  titleFont: string // canvas font string, e.g. "14px Georgia, serif"
  authorFont: string
  titleSize: number
  authorSize: number
}

// decide how many lines the title needs and whether the author still fits
// below it, given the physical spine dimensions. pretext measures via canvas
// (no DOM reflow), so this must only run in the browser.
export function fitSpine(args: FitArgs): SpineFit {
  if (typeof document === "undefined") return DEFAULT_SPINE_FIT

  try {
    const budget = args.thickness - 6 // px of cross room, minus a little padding
    const titleLineHeight = args.titleSize * 1.12
    const authorLineHeight = args.authorSize * 1.3

    const titleStats = measureLineStats(
      prepareWithSegments(args.title, args.titleFont),
      args.length,
    )
    let titleLines = Math.min(titleStats.lineCount, 2)
    while (titleLines > 1 && titleLines * titleLineHeight > budget) titleLines--

    let showAuthor = false
    if (args.author) {
      const authorStats = measureLineStats(
        prepareWithSegments(args.author, args.authorFont),
        args.length,
      )
      showAuthor =
        authorStats.lineCount === 1 &&
        titleLines * titleLineHeight + authorLineHeight <= budget
    }

    return { titleLines, showAuthor }
  } catch {
    return DEFAULT_SPINE_FIT
  }
}
