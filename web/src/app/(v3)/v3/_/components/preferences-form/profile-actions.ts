"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { nextAuth } from "@/auth/auth"
import { hashPassword, createConfig } from "@/auth/auth"
import { updateUser } from "@/database/users"

export async function updateProfileAction(data: {
  username: string
  email: string
  name: string
  password?: string
}) {
  const auth = await nextAuth.auth()
  if (!auth) {
    redirect("/login")
  }

  const hashedPassword = data.password
    ? await hashPassword(data.password)
    : undefined

  await updateUser(auth.user.id, {
    username: data.username,
    email: data.email,
    name: data.name,
    ...(hashedPassword && { hashedPassword }),
  })

  revalidatePath("/v3/preferences")
}

export async function unlinkAccountAction(data: {
  provider: string
  providerAccountId: string
}) {
  const auth = await nextAuth.auth()
  if (!auth) {
    redirect("/login")
  }

  const config = await createConfig(undefined)
  await config.adapter?.unlinkAccount?.({
    provider: data.provider,
    providerAccountId: data.providerAccountId,
  })

  revalidatePath("/v3/preferences")
}
