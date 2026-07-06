"use client"

// backward-compat shim: delegates to @/icons while existing consumers migrate.
// once all imports of IAdd, ITag, etc. are replaced with `import * as icon`,
// this file can be deleted.

import * as icon from "@/icons"
import { FieldIcon, type FieldIconKey } from "@/icons"
import { type StyledIconProps } from "@/icons/styled"

type LegacyIcon = { base: (props: StyledIconProps) => React.JSX.Element }

function legacy(
  Icon: (props: StyledIconProps) => React.JSX.Element,
): LegacyIcon {
  return { base: Icon }
}

export const IAdd = legacy(icon.Plus)
export const IAlignedAt = legacy(icon.CalendarCheck)
export const IAlignmentGrade = legacy(icon.Certificate)
export const IAlignmentMissingSentences = legacy(icon.AlertTriangle)
export const IAlignmentScore = legacy(icon.ChartBar)
export const IAudiobook = legacy(icon.Headphones)
export const IAuthor = legacy(icon.User)
export const IAuthors = legacy(icon.Users)
export const IBook = legacy(icon.Book)
export const IBookmark = legacy(icon.Bookmark)
export const ICheck = legacy(icon.Check)
export const IClose = legacy(icon.Close)
export const ICollections = legacy(icon.Folders)
export const ICreatedAt = legacy(icon.CalendarPlus)
export const IDelete = legacy(icon.Trash)
export const IDescription = legacy(icon.AlignLeft)
export const IDownload = legacy(icon.Download)
export const IDrag = legacy(icon.GripVertical)
export const IDuration = legacy(icon.Clock)
export const IEBook = legacy(icon.Book)
export const IEdit = legacy(icon.Pencil)
export const IEllipsis = legacy(icon.DotsVertical)
export const IFileSize = legacy(icon.Database)
export const IFilter = legacy(icon.Filter)
export const IIpmort = legacy(icon.FileImport)
export const ILanguage = legacy(icon.Language)
export const ILastRead = legacy(icon.Eye)
export const IListNumbers = legacy(icon.ListNumbers)
export const IListen = legacy(icon.Headphones)
export const ILoading = legacy(icon.Loader)
export const IMediaType = legacy(icon.BookAlt)
export const IPageCount = legacy(icon.FileText)
export const IPreferences = legacy(icon.Settings2)
export const IPublicationDate = legacy(icon.Calendar)
export const IRatingDimension = legacy(icon.ChartRadar)
export const IReadaloud = legacy(icon.Readaloud)
export const IRemove = legacy(icon.Minus)
export const IReview = legacy(icon.Pencil)
export const ISearch = legacy(icon.Search)
export const ISeries = legacy(icon.Books)
export const ISettings = legacy(icon.Settings)
export const IStatus = legacy(icon.Progress)
export const ISubtitle = legacy(icon.Volume3)
export const ITag = {
  base: icon.Tag,
  add: icon.TagAdd,
  remove: icon.TagRemove,
  filled: icon.TagFilled,
}
export const ITextCaption = legacy(icon.TextCaption)
export const ITitle = legacy(icon.Heading)
export const IUpdatedAt = legacy(icon.History)
export const IUpload = legacy(icon.FileUpload)
export const IUserRating = legacy(icon.Star)
export const IVolume = legacy(icon.Volume3)

export { FieldIcon, type FieldIconKey }
