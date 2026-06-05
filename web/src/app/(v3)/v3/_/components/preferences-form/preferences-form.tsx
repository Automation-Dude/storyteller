"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { IconSettings2, IconUser } from "@tabler/icons-react"
import { type Locale } from "next-intl"
import { parseAsString, useQueryState } from "nuqs"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { type z } from "zod"

import { changeLocaleAction } from "@v3/_/actions/changeLocaleAction"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"
import { Spinner } from "@v3/_/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@v3/_/components/ui/tabs"

import { type User } from "@/apiModels"
import { useTranslation } from "@/app/(v3)/v3/_/hooks/use-translation"
import {
  type UserPreferences,
  UserPreferencesSchema,
} from "@/database/userPreferencesTypes"
import { useUpdateUserSettingsMutation } from "@/store/api"

import { PreferencesTab } from "./preferences-tab"
import { ProfileTab } from "./profile-tab"

type PreferencesFormTab = "profile" | "preferences"

export function PreferencesForm({
  user,
  preferences,
  linkedAccounts,
  providers,
  disablePasswordLogin,
}: {
  user: User
  preferences: UserPreferences
  linkedAccounts: Array<{ provider: string; providerAccountId: string }>
  providers: Array<{ id: string; name: string }>
  disablePasswordLogin: boolean
}) {
  const t = useTranslation("PreferencesPage")

  const form = useForm({
    resolver: zodResolver(UserPreferencesSchema),
    defaultValues: preferences,
  })

  const [updateSettings, { isLoading: isSaving }] =
    useUpdateUserSettingsMutation()

  const onSubmit = async (data: z.output<typeof UserPreferencesSchema>) => {
    try {
      await updateSettings(data).unwrap()

      if (data.locale) {
        await changeLocaleAction(data.locale as Locale)
      }

      toast.success(t("savedSuccessfully"))
    } catch {
      toast.error(t("failedToSave"))
    }
  }

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("profile"),
  )

  const tabs = useMemo(
    () => [
      { value: "profile", label: t("tabs.profile"), icon: IconUser },
      {
        value: "preferences",
        label: t("tabs.preferences"),
        icon: IconSettings2,
      },
    ],
    [t],
  )

  const showSaveButton = activeTab === "preferences"

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SiteHeader
        className="mt-4"
        breadcrumbs={[
          {
            render: (
              <h1 className="font-heading text-foreground truncate text-3xl font-normal">
                {t("title")}
              </h1>
            ),
          },
        ]}
        actions={
          showSaveButton ? (
            <Button
              type="submit"
              form="preferences-form"
              disabled={isSaving}
              size="sm"
            >
              {isSaving && <Spinner />}
              {isSaving ? t("saving") : t("save")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            void setActiveTab(value as PreferencesFormTab)
          }}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4"
        >
          <TabsList className="shrink-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-1.5"
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto p-px pb-4">
            <ProfileTab
              user={user}
              linkedAccounts={linkedAccounts}
              providers={providers}
              disablePasswordLogin={disablePasswordLogin}
            />

            <form id="preferences-form" onSubmit={form.handleSubmit(onSubmit)}>
              <PreferencesTab form={form} />
            </form>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
