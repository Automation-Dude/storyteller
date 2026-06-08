"use client"

import { type ButtonProps } from "@base-ui/react"
import { IconFileImport, IconFileUpload, IconPlus } from "@tabler/icons-react"
import { parseAsString, useQueryState } from "nuqs"
import { useState } from "react"

import { useTranslation } from "@v3/_/hooks/use-translation"

import { ImportBookDialog } from "./books/ImportBookDialog"
import { UploadBookDialog } from "./books/UploadBookDialog"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export function AddBookButton(props: ButtonProps) {
  const t = useTranslation("BooksPage")

  const [, setSelectedBookUuid] = useQueryState("book", parseAsString)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  function handleBookCreated(bookUuid: string) {
    void setSelectedBookUuid(bookUuid)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="default" size="sm" {...props}>
              <IconPlus className="size-4" />
              {t("addBook")}
            </Button>
          }
        />
        <DropdownMenuContent className="w-fit">
          <DropdownMenuItem
            onClick={() => {
              setUploadOpen(true)
            }}
          >
            <IconFileUpload className="size-4" />
            {t("uploadBook")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setImportOpen(true)
            }}
          >
            <IconFileImport className="size-4" />
            {t("importBook")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UploadBookDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onBookCreated={handleBookCreated}
      />

      <ImportBookDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}
