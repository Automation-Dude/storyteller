"use client"

import {
  Icon,
  IconAlertTriangle,
  IconAlignLeft,
  IconBook2,
  IconBook,
  IconBookmark,
  IconBooks,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarPlus,
  IconCertificate,
  IconChartBar,
  IconChartRadar,
  IconCheck,
  IconClock,
  IconDatabase,
  IconDotsVertical,
  IconDownload,
  IconEye,
  IconFileImport,
  IconFileText,
  IconFileUpload,
  IconFilter,
  IconFolders,
  IconGripVertical,
  IconHeading,
  IconHeadphones,
  IconHistory,
  IconLanguage,
  IconListNumbers,
  IconLoader2,
  IconMinus,
  IconPencil,
  IconPlus,
  IconProgress,
  type IconProps,
  IconSearch,
  IconSettings2,
  IconSettings,
  IconStar,
  IconTag,
  IconTagFilled,
  IconTagMinus,
  IconTagPlus,
  IconTextCaption,
  IconUser,
  IconUsers,
  IconVolume3,
  IconX,
  IconTrash,
} from "@tabler/icons-react"
import { type ComponentType } from "react"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type ShelfFilterField } from "@/shelves"

type FieldIconKey = ShelfFilterField | "authors" | "seriesPosition"
type Opts = {
  /* coordinates of the + icon, or a special icon which represents "add X" */
  plus?: { top?: number; left?: number } | ComponentType<IconProps>
  /* coordinates of the - icon, or a special icon which represents "remove X" */
  minus?: { top?: number; left?: number } | ComponentType<IconProps>
  /* a special filled icon */
  filled?: ComponentType<IconProps>
}

type MaybePlus<T extends Opts["plus"]> = undefined extends T
  ? {}
  : { add: ComponentType<IconProps> }
type MaybeMinus<T extends Opts["minus"]> = undefined extends T
  ? {}
  : { remove: ComponentType<IconProps> }
type MaybeFilled<T extends Opts["filled"]> = undefined extends T
  ? {}
  : { filled: ComponentType<IconProps> }

type ReturnIcon<T extends Opts | undefined> = T extends Opts
  ? { base: ComponentType<IconProps> } & MaybePlus<T["plus"]> &
      MaybeMinus<T["minus"]> &
      MaybeFilled<T["filled"]>
  : { base: ComponentType<IconProps> }

export const enhanced = <T extends Opts>(
  Icon: ComponentType<IconProps>,
  opts?: T,
): ReturnIcon<T> => {
  const base = {
    base: (props: IconProps) => <Icon {...props} />,
  }

  if (opts?.plus) {
    Object.assign(base, {
      add: (props: IconProps) => {
        if ("top" in opts.plus || "left" in opts.plus) {
          return (
            <span style={{ position: "relative" }}>
              <Icon {...props} />
              <IconPlus
                {...props}
                style={{
                  position: "absolute",
                  top: 1 + opts.plus.top ?? 0,
                  left: 1 + opts.plus.left ?? 0,
                }}
              />
            </span>
          )
        }

        return <opts.plus {...props} />
      },
    })
  }

  if (opts?.minus) {
    Object.assign(base, {
      remove: (props: IconProps) => {
        if ("top" in opts.minus || "left" in opts.minus) {
          return (
            <span style={{ position: "relative" }}>
              <Icon {...props} />
              <IconMinus
                {...props}
                style={{
                  position: "absolute",
                  top: 1 + opts.minus.top ?? 0,
                  left: 1 + opts.minus.left ?? 0,
                }}
              />
            </span>
          )
        }

        return <opts.minus {...props} />
      },
    })
  }

  if (opts?.filled) {
    Object.assign(base, {
      filled: (props: IconProps) => {
        return <opts.filled {...props} />
      },
    })
  }

  return base as ReturnIcon<T>
}

// separate so we dont need to pass around jsx on the server
export const IAdd = enhanced(IconPlus)
export const IAlignedAt = enhanced(IconCalendarCheck)
export const IAlignmentGrade = enhanced(IconCertificate)
export const IAlignmentMissingSentences = enhanced(IconAlertTriangle)
export const IAlignmentScore = enhanced(IconChartBar)
export const IAudiobook = enhanced(IconHeadphones)
export const IAuthor = enhanced(IconUser)
export const IAuthors = enhanced(IconUsers)
export const IBook = enhanced(IconBook2)
export const IBookmark = enhanced(IconBookmark)
export const ICheck = enhanced(IconCheck)
export const IClose = enhanced(IconX)
export const ICollections = enhanced(IconFolders)
export const ICreatedAt = enhanced(IconCalendarPlus)
export const IDelete = enhanced(IconTrash)
export const IDescription = enhanced(IconAlignLeft)
export const IDownload = enhanced(IconDownload)
export const IDrag = enhanced(IconGripVertical)
export const IDuration = enhanced(IconClock)
export const IEBook = enhanced(IconBook2)
export const IEdit = enhanced(IconPencil)
export const IEllipsis = enhanced(IconDotsVertical)
export const IFileSize = enhanced(IconDatabase)
export const IFilter = enhanced(IconFilter)
export const IIpmort = enhanced(IconFileImport)
export const ILanguage = enhanced(IconLanguage)
export const ILastRead = enhanced(IconEye)
export const IListNumbers = enhanced(IconListNumbers)
export const IListen = enhanced(IconHeadphones)
export const ILoading = enhanced(IconLoader2)
export const IMediaType = enhanced(IconBook)
export const IPageCount = enhanced(IconFileText)
export const IPreferences = enhanced(IconSettings2)
export const IPublicationDate = enhanced(IconCalendar)
export const IRatingDimension = enhanced(IconChartRadar)
export const IReadaloud = { base: IconReadaloud }
export const IRemove = enhanced(IconMinus)
export const IReview = enhanced(IconPencil)
export const ISearch = enhanced(IconSearch)
export const ISeries = enhanced(IconBooks)
export const ISettings = enhanced(IconSettings)
export const IStatus = enhanced(IconProgress)
export const ISubtitle = enhanced(IconVolume3)
export const ITag = enhanced(IconTag, {
  plus: IconTagPlus,
  minus: IconTagMinus,
  filled: IconTagFilled,
})
export const ITextCaption = enhanced(IconTextCaption)
export const ITitle = enhanced(IconHeading)
export const IUpdatedAt = enhanced(IconHistory)
export const IUpload = enhanced(IconFileUpload)
export const IUserRating = enhanced(IconStar)
export const IVolume = enhanced(IconVolume3)

const FIELD_ICONS: Record<
  FieldIconKey,
  ComponentType<{ className?: string }>
> = {
  title: ITitle.base,
  subtitle: ISubtitle.base,
  description: IDescription.base,
  language: ILanguage.base,
  review: IReview.base,
  search: ISearch.base,
  alignmentGrade: IAlignmentGrade.base,
  status: IStatus.base,
  tags: ITag.base,
  collections: ICollections.base,
  series: ISeries.base,
  creators: IAuthors.base,
  authors: IAuthor.base,
  mediaType: IMediaType.base,
  userRating: IUserRating.base,
  ratingDimension: IRatingDimension.base,
  pageCount: IPageCount.base,
  duration: IDuration.base,
  fileSize: IFileSize.base,
  readingPosition: IBookmark.base,
  alignmentScore: IAlignmentScore.base,
  alignmentMissingSentences: IAlignmentMissingSentences.base,
  alignmentMutedChapters: IVolume.base,
  publicationDate: IPublicationDate.base,
  createdAt: ICreatedAt.base,
  updatedAt: IUpdatedAt.base,
  alignedAt: IAlignedAt.base,
  lastRead: ILastRead.base,
  seriesPosition: IListNumbers.base,
}

export function FieldIcon({
  field,
  className,
}: {
  field: FieldIconKey
  className?: string
}) {
  const Icon = FIELD_ICONS[field] ?? IconFilter
  return <Icon className={className} />
}
