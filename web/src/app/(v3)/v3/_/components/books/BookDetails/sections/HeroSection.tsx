"use client"

import { IconBook, IconHeadphones, IconPlayerPlay } from "@tabler/icons-react"
import { useTranslations } from "next-intl"

import {
  AuthorEditor,
  NarratorEditor,
} from "@v3/_/components/books/AuthorEditor"
import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { CoverEditor } from "@v3/_/components/books/BookDetails/CoverEditor"
import { ProgressDisplayBar } from "@v3/_/components/books/ProgressDisplayBar"
import { RatingInput } from "@v3/_/components/books/RatingInput"
import { ReadingStatusButton } from "@v3/_/components/books/ReadingStatusButton"
import { SeriesEditor } from "@v3/_/components/books/SeriesEditor"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import { V3Link } from "@v3/_/components/v3-link"

import { cn } from "@/cn"
import { useSetBookRatingMutation } from "@/store/api"

import { useCoverColors } from "./useCoverColors"

export function HeroSection({ compact }: { compact: boolean }) {
  const { book, form, isEditing } = useBookForm()
  const tLabels = useTranslations("Labels")
  const t = useTranslations("BookDetailsPage")

  const [setBookRating] = useSetBookRatingMutation()

  const authors = book.authors
  const narrators = book.narrators

  const handleRatingChange = async (rating: number | null) => {
    await setBookRating({ bookUuid: book.uuid, rating })
  }

  const {
    primary: { background, accent, _contrast, contrastBw },
  } = useCoverColors(book, { opacity: 0.2 })

  // if (compact) {
  return (
    <div
      className={cn(
        "relative flex items-center px-6 pt-7 pb-5",
        compact
          ? "flex-col gap-5 text-center"
          : "flex-col gap-8 md:h-84 md:flex-row",
      )}
      style={{ background }}
    >
      <CoverEditor compact={compact} />

      <div
        className={cn(
          compact
            ? "contents"
            : "flex h-full grow flex-col items-center gap-5 md:items-start md:justify-between md:gap-1.5",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-1.5",
            compact ? "items-center" : "items-center md:items-start",
          )}
        >
          {isEditing ? (
            <div className="flex w-full flex-col gap-2">
              <Input
                id="title"
                {...form.register("title")}
                className={cn(
                  "text-xl font-semibold",
                  compact ? "text-center" : "text-left",
                )}
                placeholder={tLabels("title")}
                aria-label={tLabels("title")}
              />
              <Input
                id="subtitle"
                {...form.register("subtitle")}
                className={cn(
                  "text-center",
                  compact ? "text-center" : "text-left",
                )}
                placeholder={tLabels("subtitle")}
                aria-label={tLabels("subtitle")}
              />
            </div>
          ) : (
            <>
              <h1 className="font-heading text-xl leading-tight font-normal tracking-tight text-balance">
                {book.title}
              </h1>
              {book.subtitle && (
                <p className="text-muted-foreground font-heading text-sm italic">
                  {book.subtitle}
                </p>
              )}
            </>
          )}

          {isEditing ? (
            <AuthorEditor />
          ) : (
            authors.length > 0 && (
              <p className="text-muted-foreground mt-0.5 flex flex-wrap justify-center gap-x-1 text-xs">
                <span>{t("writtenBy")}</span>
                {authors.map((author, idx) => (
                  <V3Link
                    key={author.uuid}
                    href={`/authors?item=${author.uuid}`}
                    className="hover:text-primary text-foreground font-serif font-medium hover:underline"
                  >
                    {author.name.trim()}
                    {idx < authors.length - 1 && <span>,</span>}
                  </V3Link>
                ))}
              </p>
            )
          )}

          {isEditing ? (
            <NarratorEditor />
          ) : (
            narrators.length > 0 && (
              <p className="text-muted-foreground flex flex-wrap justify-center gap-x-1 text-xs">
                <span className="italic">{t("narratedBy")}</span>
                {narrators.map((narrator, idx) => (
                  <V3Link
                    key={narrator.uuid}
                    href={`/narrators?item=${narrator.uuid}`}
                    className="hover:text-primary text-foreground hover:underline"
                  >
                    {narrator.name.trim()}
                    {idx < narrators.length - 1 && <span>,</span>}
                  </V3Link>
                ))}
              </p>
            )
          )}

          <div className="mt-1">
            <RatingInput
              value={book.rating?.rating ?? null}
              onChange={handleRatingChange}
            />
          </div>

          <div className="mt-1">
            <SeriesEditor
              bookUuid={book.uuid}
              series={book.series.map((s) => ({
                uuid: s.uuid,
                name: s.name,
                position: s.position,
                featured: s.featured,
              }))}
              onUpdate={() => {}}
              editMode={isEditing}
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <ReadingStatusButton book={book} size="sm" />

          {book.readaloud?.status === "ALIGNED" && (
            <Button
              variant="default"
              size="sm"
              nativeButton={false}
              style={{
                background: _contrast >= 128 ? "black" : accent,
                borderColor: _contrast >= 128 ? "black" : accent,
                color: _contrast >= 128 ? "white" : contrastBw,
              }}
              render={
                <V3Link href={`/books/${book.uuid}/read?mode=readaloud`}>
                  <IconPlayerPlay className="mr-1 h-4 w-4" />
                  Read
                </V3Link>
              }
            />
          )}

          {book.readaloud?.status !== "ALIGNED" && book.ebook && (
            <Button
              variant="default"
              size="sm"
              nativeButton={false}
              style={{
                background: _contrast >= 128 ? "black" : accent,
                borderColor: _contrast >= 128 ? "black" : accent,
                color: _contrast >= 128 ? "white" : contrastBw,
              }}
              render={
                <V3Link href={`/books/${book.uuid}/read?mode=epub`}>
                  <IconBook className="mr-1 h-4 w-4" />
                  Read
                </V3Link>
              }
            />
          )}

          {book.readaloud?.status !== "ALIGNED" && book.audiobook && (
            <Button
              variant="default"
              size="sm"
              nativeButton={false}
              style={{
                background: _contrast >= 128 ? "black" : accent,
                borderColor: _contrast >= 128 ? "black" : accent,
                color: _contrast >= 128 ? "white" : contrastBw,
              }}
              render={
                <V3Link href={`/books/${book.uuid}/read?mode=audiobook`}>
                  <IconHeadphones className="mr-1 h-4 w-4" />
                  Listen
                </V3Link>
              }
            />
          )}
        </div>

        {book.position?.locator && (
          <ProgressDisplayBar
            progress={book.position.locator.locations?.totalProgression ?? 0}
            book={book}
          />
        )}
      </div>
    </div>
  )

  // return (
  //   <div className="flex flex-col gap-8 md:flex-row">
  //     <div className="relative w-full" style={{ background }}>
  //       <div className="flex shrink-0 flex-col items-center gap-3 py-6">
  //         <CoverEditor compact={compact} />
  //       </div>
  //       {book.position?.locator && (
  //         <ProgressDisplayBar
  //           progress={book.position.locator.locations?.totalProgression ?? 0}
  //           book={book}
  //         />
  //       )}

  //       <div className="flex flex-1 flex-col p-6 py-0">
  //         <div className="flex items-start justify-between gap-4">
  //           {isEditing ? (
  //             <div className="flex flex-1 flex-col gap-3">
  //               <Input
  //                 id="title"
  //                 {...form.register("title")}
  //                 className="mt-1 text-2xl font-semibold"
  //                 placeholder={tLabels("title")}
  //                 aria-label={tLabels("title")}
  //               />

  //               <Input
  //                 id="subtitle"
  //                 {...form.register("subtitle")}
  //                 className="mt-1"
  //                 placeholder={tLabels("subtitle")}
  //                 aria-label={tLabels("subtitle")}
  //               />
  //             </div>
  //           ) : (
  //             <div className="flex-1">
  //               <h1 className="font-heading text-2xl font-normal tracking-tight">
  //                 {book.title}
  //               </h1>

  //               {book.subtitle && (
  //                 <p className="text-muted-foreground font-heading mt-1 text-lg italic">
  //                   {book.subtitle}
  //                 </p>
  //               )}
  //             </div>
  //           )}
  //         </div>

  //         {isEditing ? (
  //           <AuthorEditor />
  //         ) : (
  //           authors.length > 0 && (
  //             <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-1 text-sm">
  //               <span>{t("writtenBy")}</span>
  //               {authors.map((author, idx) => (
  //                 <Fragment key={author.uuid}>
  //                   <V3Link
  //                     href={`/books?author=${author.uuid}`}
  //                     className="hover:text-primary text-foreground line-clamp-1 inline font-medium break-all hyphens-auto hover:underline"
  //                   >
  //                     {author.name}
  //                   </V3Link>
  //                   <span>{idx < authors.length - 1 && ", "}</span>
  //                 </Fragment>
  //               ))}
  //             </p>
  //           )
  //         )}

  //         {isEditing ? (
  //           <NarratorEditor />
  //         ) : (
  //           narrators.length > 0 && (
  //             <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
  //               <span className="italic">{t("narratedBy")}</span>
  //               {narrators.map((narrator, idx) => (
  //                 <span key={narrator.uuid}>
  //                   <span className="text-foreground">{narrator.name}</span>
  //                   {idx < narrators.length - 1 && ", "}
  //                 </span>
  //               ))}
  //             </div>
  //           )
  //         )}

  //         <div className="mt-3">
  //           <RatingInput value={book.rating} onChange={handleRatingChange} />
  //         </div>

  //         <div className="mt-4">
  //           <SeriesEditor
  //             bookUuid={book.uuid}
  //             series={book.series.map((s) => ({
  //               uuid: s.uuid,
  //               name: s.name,
  //               position: s.position,
  //               featured: s.featured,
  //             }))}
  //             onUpdate={() => {}}
  //             editMode={isEditing}
  //           />
  //         </div>

  //         <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
  //           <ReadingStatusButton book={book} size="lg" />

  //           {book.readaloud?.status === "ALIGNED" && (
  //             <Button
  //               variant="default"
  //               size="lg"
  //               nativeButton={false}
  //               render={
  //                 <V3Link href={`/books/${book.uuid}/read?mode=readaloud`}>
  //                   <IconPlayerPlay className="mr-1 h-4 w-4" />
  //                   Read
  //                 </V3Link>
  //               }
  //             />
  //           )}

  //           {book.readaloud?.status !== "ALIGNED" && book.ebook && (
  //             <Button
  //               variant="default"
  //               size="lg"
  //               nativeButton={false}
  //               render={
  //                 <V3Link href={`/books/${book.uuid}/read?mode=epub`}>
  //                   <IconBook className="mr-1 h-4 w-4" />
  //                   Read
  //                 </V3Link>
  //               }
  //             />
  //           )}

  //           {book.readaloud?.status !== "ALIGNED" && book.audiobook && (
  //             <Button
  //               variant="default"
  //               size="lg"
  //               nativeButton={false}
  //               render={
  //                 <V3Link href={`/books/${book.uuid}/read?mode=audiobook`}>
  //                   <IconHeadphones className="mr-1 h-4 w-4" />
  //                   Listen
  //                 </V3Link>
  //               }
  //             />
  //           )}

  //           {book.publicationDate && !isEditing && (
  //             <span className="text-muted-foreground ml-auto text-sm">
  //               {new Date(book.publicationDate).getFullYear()}
  //             </span>
  //           )}
  //         </div>
  //       </div>
  //     </div>
  //   </div>
  // )
}
