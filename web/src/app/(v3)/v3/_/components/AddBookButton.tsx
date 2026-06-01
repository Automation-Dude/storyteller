import { type ButtonProps } from "@base-ui/react"
import { IconFileImport, IconFileUpload, IconPlus } from "@tabler/icons-react"
import { useTranslations } from "next-intl"

import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export function AddBookButton(props: ButtonProps) {
  const t = useTranslations("BooksPage")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" {...props}>
            <IconPlus className="size-4" />
            {t("addBook")}
          </Button>
        }
      />
      <DropdownMenuContent>
        <DropdownMenuItem>
          <IconFileUpload className="size-4" />
          {t("uploadBook")}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconFileImport className="size-4" />
          {t("importBook")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
