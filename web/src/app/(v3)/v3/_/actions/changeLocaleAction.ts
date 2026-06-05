"use server"

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { type Locale } from "next-intl"

import { nextAuth } from "@/auth/auth"
import { setUserSetting } from "@/database/userSettings"
import { LOCALE_COOKIE_NAME } from "@/i18n/constants"

export async function changeLocaleAction(locale: Locale) {
  const store = await cookies()
  store.set(LOCALE_COOKIE_NAME, locale)

  const auth = await nextAuth.auth()
  if (auth) {
    await setUserSetting(auth.user.id, "locale", locale)
  }

  const reqHeaders = await headers()
  const isRewritten = reqHeaders.get("x-v3-rewritten") === "1"

  revalidatePath(isRewritten ? "/" : "/v3", "layout")
}
