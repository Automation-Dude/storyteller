import { type ButtonProps } from "@base-ui/react"
import { IconFileImport, IconFileUpload, IconPlus } from "@tabler/icons-react"

import { useTranslation } from "@v3/_/hooks/use-translation"

import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export function AddBookButton(props: ButtonProps) {
  const t = useTranslation("BooksPage")
  return (
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
