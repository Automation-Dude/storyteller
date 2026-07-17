"use client"

import { IconExternalLink, IconSearch } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { type AuditBook, type AuditIssue } from "@/database/auditLibrary"
import { type OpenLibraryCandidate } from "@/metadata/openLibrary"
import {
  useApplyRepairsMutation,
  useLazySearchMetadataQuery,
  useSuggestRepairsMutation,
} from "@/store/api"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import { Input } from "@v3/_/components/ui/input"
import { Label } from "@v3/_/components/ui/label"
import { Spinner } from "@v3/_/components/ui/spinner"
import { Textarea } from "@v3/_/components/ui/textarea"

const COVER_ISSUES: AuditIssue[] = ["NO-COVER", "BLANK-COVER", "TINY-COVER"]

type Fields = {
  title: string
  authors: string
  language: string
  description: string
  coverUrl: string
}

function fillFromCandidate(candidate: OpenLibraryCandidate): Partial<Fields> {
  return {
    title: candidate.title,
    authors: candidate.authors.join(", "),
    language: candidate.languages[0] ?? "",
    coverUrl: candidate.coverUrl ?? "",
  }
}

export function RepairDialog({
  book,
  open,
  onOpenChange,
}: {
  book: AuditBook
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("LibraryAuditPage")

  const [suggest, suggestion] = useSuggestRepairsMutation()
  const [applyRepairs, apply] = useApplyRepairsMutation()
  const [searchMetadata, searchResult] = useLazySearchMetadataQuery()

  const [fields, setFields] = useState<Fields>({
    title: "",
    authors: "",
    language: "",
    description: "",
    coverUrl: "",
  })
  const [manualQuery, setManualQuery] = useState("")
  const filledFor = useRef<string | null>(null)

  const needsCover = book.issues.some((i) => COVER_ISSUES.includes(i))

  // Ask Open Library once per time the dialog opens for this book, and prefill
  // the fields the book actually has a problem with from the best match.
  useEffect(() => {
    if (!open) {
      filledFor.current = null
      return
    }
    if (filledFor.current === book.uuid) return
    filledFor.current = book.uuid
    setFields({
      title: "",
      authors: "",
      language: "",
      description: "",
      coverUrl: "",
    })
    void suggest({ bookUuids: [book.uuid] })
      .unwrap()
      .then((result) => {
        const best = result.proposals[0]?.best
        if (!best) return
        const filled = fillFromCandidate(best)
        setFields((prev) => ({
          ...prev,
          ...(book.issues.includes("BAD-TITLE") && { title: filled.title }),
          ...(book.issues.includes("NO-AUTHOR") && { authors: filled.authors }),
          ...(book.issues.includes("NO-LANG") && { language: filled.language }),
          ...(needsCover && { coverUrl: filled.coverUrl }),
        }))
      })
      .catch(() => undefined)
  }, [open, book.uuid, book.issues, needsCover, suggest])

  const best = suggestion.data?.proposals[0]?.best ?? null
  const candidates = searchResult.data?.candidates ?? []

  function useCandidate(candidate: OpenLibraryCandidate) {
    setFields((prev) => ({ ...prev, ...fillFromCandidate(candidate) }))
  }

  async function onApply() {
    const choice: Record<string, string | string[]> = {}
    if (fields.title.trim()) choice["title"] = fields.title.trim()
    if (fields.authors.trim())
      choice["authors"] = fields.authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    if (fields.language.trim()) choice["language"] = fields.language.trim()
    if (fields.description.trim())
      choice["description"] = fields.description.trim()
    if (fields.coverUrl.trim()) choice["coverUrl"] = fields.coverUrl.trim()

    if (Object.keys(choice).length === 0) {
      toast.info(t("repair.nothingToApply"))
      return
    }

    const result = await applyRepairs({
      repairs: [{ bookUuid: book.uuid, ...choice }],
    }).unwrap()
    if (result.failed > 0) {
      toast.error(result.results[0]?.message ?? t("repair.failed"))
    } else {
      toast.success(t("repair.applied"))
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("repair.title")}</DialogTitle>
          <DialogDescription>{book.title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {book.issues.map((issue) => (
            <Badge key={issue} variant="outline">
              {t(`issues.${issue}`)}
            </Badge>
          ))}
        </div>

        {suggestion.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Spinner /> {t("repair.searching")}
          </div>
        ) : (
          <>
            {best ? (
              <p className="text-muted-foreground text-sm">
                {t("repair.bestMatch")}:{" "}
                <span className="text-foreground font-medium">
                  {best.title}
                </span>
                {best.authors[0] ? ` / ${best.authors[0]}` : ""} (
                {Math.round(best.score * 100)}%)
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("repair.noMatch")}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <CoverPreview
                bookUuid={book.uuid}
                proposedUrl={fields.coverUrl}
                t={t}
              />
              <div className="flex flex-col gap-3">
                <FieldRow label={t("colTitle")}>
                  <Input
                    value={fields.title}
                    onChange={(e) => {
                      setFields((f) => ({ ...f, title: e.target.value }))
                    }}
                    placeholder={book.title}
                  />
                </FieldRow>
                <FieldRow label={t("colAuthor")}>
                  <Input
                    value={fields.authors}
                    onChange={(e) => {
                      setFields((f) => ({ ...f, authors: e.target.value }))
                    }}
                    placeholder={t("repair.authorsPlaceholder")}
                  />
                </FieldRow>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label={t("repair.language")}>
                    <Input
                      value={fields.language}
                      onChange={(e) => {
                        setFields((f) => ({ ...f, language: e.target.value }))
                      }}
                      placeholder="en"
                    />
                  </FieldRow>
                  <FieldRow label={t("repair.coverUrl")}>
                    <Input
                      value={fields.coverUrl}
                      onChange={(e) => {
                        setFields((f) => ({ ...f, coverUrl: e.target.value }))
                      }}
                      placeholder="https://..."
                    />
                  </FieldRow>
                </div>
                <FieldRow label={t("repair.description")}>
                  <Textarea
                    rows={3}
                    value={fields.description}
                    onChange={(e) => {
                      setFields((f) => ({ ...f, description: e.target.value }))
                    }}
                  />
                </FieldRow>
              </div>
            </div>

            <ManualSearch
              query={manualQuery}
              setQuery={setManualQuery}
              onSearch={() =>
                void searchMetadata({ q: manualQuery || book.title })
              }
              searching={searchResult.isFetching}
              candidates={candidates}
              onUse={useCandidate}
              t={t}
            />
          </>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("repair.cancel")}
          </Button>
          <Button onClick={() => void onApply()} disabled={apply.isLoading}>
            {apply.isLoading ? <Spinner /> : null}
            {t("repair.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function CoverPreview({
  bookUuid,
  proposedUrl,
  t,
}: {
  bookUuid: string
  proposedUrl: string
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="flex gap-3">
      <figure className="flex flex-col items-center gap-1">
        {/* A book cover, sometimes an external Open Library URL; next/image
            would need every host allow-listed, so a plain img is used. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/v2/books/${bookUuid}/cover?w=110&h=165`}
          alt=""
          className="bg-muted h-[165px] w-[110px] rounded object-cover"
        />
        <figcaption className="text-muted-foreground text-xs">
          {t("repair.current")}
        </figcaption>
      </figure>
      {proposedUrl ? (
        <figure className="flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proposedUrl}
            alt=""
            className="bg-muted h-[165px] w-[110px] rounded object-cover ring-2 ring-green-500/50"
          />
          <figcaption className="text-muted-foreground text-xs">
            {t("repair.proposed")}
          </figcaption>
        </figure>
      ) : null}
    </div>
  )
}

function ManualSearch({
  query,
  setQuery,
  onSearch,
  searching,
  candidates,
  onUse,
  t,
}: {
  query: string
  setQuery: (q: string) => void
  onSearch: () => void
  searching: boolean
  candidates: OpenLibraryCandidate[]
  onUse: (candidate: OpenLibraryCandidate) => void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-3">
      <Label className="text-xs">{t("repair.manualSearch")}</Label>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch()
          }}
          placeholder={t("repair.manualSearchPlaceholder")}
        />
        <Button variant="outline" onClick={onSearch} disabled={searching}>
          {searching ? <Spinner /> : <IconSearch />}
        </Button>
      </div>
      {candidates.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {candidates.map((candidate) => (
            <li
              key={candidate.workKey}
              className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">
                {candidate.title}
                <span className="text-muted-foreground">
                  {candidate.authors[0] ? ` / ${candidate.authors[0]}` : ""}
                  {candidate.firstPublishYear
                    ? ` (${candidate.firstPublishYear})`
                    : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <a
                  href={`https://openlibrary.org${candidate.workKey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("repair.openExternally")}
                >
                  <IconExternalLink size={16} />
                </a>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    onUse(candidate)
                  }}
                >
                  {t("repair.use")}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
