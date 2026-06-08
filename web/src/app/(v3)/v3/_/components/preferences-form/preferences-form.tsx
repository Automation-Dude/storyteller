"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconBook,
  IconPalette,
  IconSearch,
  IconSettings2,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { type Locale } from "next-intl"
import { parseAsString, useQueryState } from "nuqs"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { type z } from "zod"

import { changeLocaleAction } from "@v3/_/actions/changeLocaleAction"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import { Spinner } from "@v3/_/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@v3/_/components/ui/tabs"

import { type User } from "@/apiModels"
import { useTranslation } from "@/app/(v3)/v3/_/hooks/use-translation"
import {
  type UserPreferences,
  UserPreferencesSchema,
} from "@/database/userPreferencesTypes"
import { useUpdateUserSettingsMutation } from "@/store/api"

import { AppearanceTab } from "./appearance-tab"
import { BooksTab } from "./books-tab"
import { GeneralTab } from "./general-tab"
import { ProfileTab } from "./profile-tab"
import { type IsMatch, SearchContext } from "./shared"
import { type PreferenceTab, type SectionKeywords } from "./tabs"

export function PreferencesForm({
  user,
  preferences,
  sectionKeywords,
  linkedAccounts,
  providers,
  disablePasswordLogin,
}: {
  user: User
  preferences: UserPreferences
  sectionKeywords: SectionKeywords
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

  // surface validation errors instead of silently swallowing the submit
  const onInvalid = () => {
    toast.error(t("failedToSave"))
  }

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("profile"),
  )

  const [searchQuery, setSearchQuery] = useState("")

  const tabs = useMemo(
    () =>
      [
        { value: "profile", label: t("tabs.profile.title"), icon: IconUser },
        {
          value: "general",
          label: t("tabs.general.title"),
          icon: IconSettings2,
        },
        {
          value: "appearance",
          label: t("tabs.appearance.title"),
          icon: IconPalette,
        },
        { value: "books", label: t("tabs.books.title"), icon: IconBook },
      ] as const,
    [t],
  )

  // a section matches when one of its keywords contains the query
  const matchingSections = useMemo(() => {
    if (!searchQuery) return null

    const query = searchQuery.toLowerCase()
    const matching = new Set<string>()

    for (const [tab, sections] of Object.entries(sectionKeywords)) {
      for (const [section, keywords] of Object.entries(sections)) {
        if (keywords.some((kw) => kw.toLowerCase().includes(query))) {
          matching.add(`${tab}.${section}`)
        }
      }
    }
    return matching
  }, [searchQuery, sectionKeywords])

  const matchingTabs = useMemo(() => {
    if (!matchingSections) return null
    return new Set<PreferenceTab>(
      Array.from(matchingSections).map(
        (key) => key.split(".")[0] as PreferenceTab,
      ),
    )
  }, [matchingSections])

  const isMatch: IsMatch = (tab, section) =>
    !matchingSections || matchingSections.has(`${tab}.${section}`)

  // when searching, jump to the first tab that has a match
  const prefActiveTab = useRef<string>(activeTab)
  prefActiveTab.current = activeTab
  useEffect(() => {
    if (!matchingTabs) return
    const firstMatch = Array.from(matchingTabs)[0]
    if (
      firstMatch &&
      !matchingTabs.has(prefActiveTab.current as PreferenceTab)
    ) {
      void setActiveTab(firstMatch)
    }
  }, [matchingTabs, setActiveTab])

  const visibleTabs = matchingTabs
    ? tabs.filter((tab) =>
        tab.value === "profile" ? false : matchingTabs.has(tab.value),
      )
    : tabs

  const showSaveButton = activeTab !== "profile"

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
        <div className="shrink-0 px-4 pt-2">
          <div className="relative mb-2">
            <IconSearch className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder={t("searchPreferences")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
              }}
              className="pr-9 pl-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                }}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <SearchContext.Provider value={{ query: searchQuery, isMatch }}>
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              void setActiveTab(value as string)
            }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4"
          >
            <TabsList className="shrink-0">
              {visibleTabs.map((tab) => (
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
              {!searchQuery && (
                <ProfileTab
                  user={user}
                  linkedAccounts={linkedAccounts}
                  providers={providers}
                  disablePasswordLogin={disablePasswordLogin}
                />
              )}

              <form
                id="preferences-form"
                onSubmit={form.handleSubmit(onSubmit, onInvalid)}
              >
                <GeneralTab form={form} />
                <AppearanceTab form={form} />
                <BooksTab form={form} />
              </form>
            </div>
          </Tabs>
        </SearchContext.Provider>
      </div>
    </div>
  )
}
