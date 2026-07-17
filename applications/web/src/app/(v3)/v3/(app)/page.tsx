import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { HomePage } from "./HomePage"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomePage")
  return {
    title: t("title"),
  }
}

export default function Index() {
  return <HomePage />
}
