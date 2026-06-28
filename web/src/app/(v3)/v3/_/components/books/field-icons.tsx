"use client"

import {
  IconAlertTriangle,
  IconAlignLeft,
  IconBook,
  IconBookmark,
  IconBooks,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarPlus,
  IconCertificate,
  IconChartBar,
  IconChartRadar,
  IconClock,
  IconDatabase,
  IconEye,
  IconFileText,
  IconFilter,
  IconFolders,
  IconHeading,
  IconHistory,
  IconLanguage,
  IconListNumbers,
  IconPencil,
  IconProgress,
  IconSearch,
  IconStar,
  IconTag,
  IconTextCaption,
  IconUser,
  IconUsers,
  IconVolume3,
} from "@tabler/icons-react"
import { type ComponentType } from "react"

// one icon per filter/sort/display field, kept out of FIELD_REGISTRY so the
// registry stays a plain server-safe data object. keyed loosely by field name
// (ShelfFilterField plus the display-only "authors" / sort-only "seriesPosition")
// so every menu - quick filter, sort, show-on-card - shows the same glyph.
const FIELD_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  title: IconHeading,
  subtitle: IconTextCaption,
  description: IconAlignLeft,
  language: IconLanguage,
  review: IconPencil,
  search: IconSearch,
  alignmentGrade: IconCertificate,
  status: IconProgress,
  tags: IconTag,
  collections: IconFolders,
  series: IconBooks,
  creators: IconUsers,
  authors: IconUser,
  mediaType: IconBook,
  userRating: IconStar,
  ratingDimension: IconChartRadar,
  pageCount: IconFileText,
  duration: IconClock,
  fileSize: IconDatabase,
  readingPosition: IconBookmark,
  alignmentScore: IconChartBar,
  alignmentMissingSentences: IconAlertTriangle,
  alignmentMutedChapters: IconVolume3,
  publicationDate: IconCalendar,
  createdAt: IconCalendarPlus,
  updatedAt: IconHistory,
  alignedAt: IconCalendarCheck,
  lastRead: IconEye,
  seriesPosition: IconListNumbers,
}

export function FieldIcon({
  field,
  className,
}: {
  field: string
  className?: string
}) {
  const Icon = FIELD_ICONS[field] ?? IconFilter
  return <Icon className={className} />
}
