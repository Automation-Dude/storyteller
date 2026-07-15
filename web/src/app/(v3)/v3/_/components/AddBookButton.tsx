"use client"

import { type ButtonProps } from "@base-ui/react"
import { useHotkey } from "@tanstack/react-hotkeys"
import { parseAsString, useQueryState } from "nuqs"
import { useState } from "react"

import { useTranslation } from "@v3/_/hooks/use-translation"

import * as icon from "@/icons"


import { ImportBookDialog } from "./books/ImportBookDialog"
import { UploadBookDialog } from "./books/UploadBookDialog"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuItem,
  FilterableMenuTrigger,
} from "./ui/filterable-menu"
import { IAdd } from "./ui/icon"
import { TooltipButton } from "./ui/tooltip-button"


export function AddBookButton(props: ButtonProps) {
  const t = useTranslation("BooksPage")

  const [open, setOpen] = useState(false)
  useHotkey("Shift+A", () => {
    setOpen((prev) => !prev)
  })

  const [, setSelectedBookUuid] = useQueryState("book", parseAsString)

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
              <IAdd.base className="size-4" />
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
