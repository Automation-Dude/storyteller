import { type ButtonProps } from "@base-ui/react"
import { IconPlus } from "@tabler/icons-react"
import { useTranslations } from "next-intl"

import { Button } from "./ui/button"

export function AddBookButton(props: ButtonProps) {
  const t = useTranslations("BooksPage")
  return (
    <Button variant="outline" size="sm" {...props}>
      <IconPlus className="size-4" />
      {t("addBook")}
    </Button>
  )
}
