"use client"

import { type ButtonProps } from "@base-ui/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useState } from "react"

import { useTranslation } from "@v3/_/hooks/use-translation"

import { useBookInSidePanel } from "@/app/(v3)/v3/_/hooks/use-open-book"
import * as icon from "@/icons"

import { ImportBookDialog } from "./books/ImportBookDialog"
import { UploadBookDialog } from "./books/UploadBookDialog"
import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuItem,
  FilterableMenuTrigger,
} from "./ui/filterable-menu"
import { TooltipButton } from "./ui/tooltip-button"

export function AddBookButton(props: ButtonProps) {
  const t = useTranslation("BooksPage")

  const [open, setOpen] = useState(false)
  useHotkey("Shift+A", () => {
    setOpen((prev) => !prev)
  })

  const { setSelectedBookUuid } = useBookInSidePanel()

  const [uploadOpen, setUploadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  function handleBookCreated(bookUuid: string) {
    void setSelectedBookUuid(bookUuid)
  }

  return (
    <>
      <FilterableMenu open={open} onOpenChange={setOpen}>
        <FilterableMenuTrigger
          render={
            <TooltipButton
              variant="ghost"
              size="sm"
              {...props}
              tooltip={t("addBook")}
              aria-label={t("addBook")}
              shortcut={["Shift+A"]}
            >
              <icon.Add className="size-4" />
            </TooltipButton>
          }
        />
        <FilterableMenuContent searchable={false}>
          <FilterableMenuItem
            icon={<icon.FileUpload className="size-4" />}
            textValue={t.plain("uploadBook")}
            onSelect={() => {
              setUploadOpen(true)
            }}
          >
            {t("uploadBook")}
          </FilterableMenuItem>
          <FilterableMenuItem
            icon={<icon.FileImport className="size-4" />}
            textValue={t.plain("importBook")}
            onSelect={() => {
              setImportOpen(true)
            }}
          >
            {t("importBook")}
          </FilterableMenuItem>
        </FilterableMenuContent>
      </FilterableMenu>

      <UploadBookDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onBookCreated={handleBookCreated}
      />

      <ImportBookDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}
