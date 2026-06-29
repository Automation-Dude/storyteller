"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconArrowLeft,
  IconBook,
  IconPalette,
  IconSearch,
  IconSettings2,
  IconSettings,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { type Locale } from "next-intl"
import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { type z } from "zod"

import { changeLocaleAction } from "@v3/_/actions/changeLocaleAction"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import {
  PageContent,
  PageHeader,
  PageLayout,
  PageMain,
  PageSidebar,
} from "@v3/_/components/ui/page-layout"
import { ScrollArea } from "@v3/_/components/ui/scroll-area"
import { Spinner } from "@v3/_/components/ui/spinner"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"

import { type User } from "@/apiModels"
import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"
import { useTranslation } from "@/app/(v3)/v3/_/hooks/use-translation"
import {
  type UserPreferences,
  UserPreferencesSchema,
} from "@/database/userPreferencesTypes"
import { usePermission } from "@/hooks/usePermission"
import { useUpdateUserSettingsMutation } from "@/store/api"

import { AppearanceTab } from "./appearance-tab"
import { BooksTab } from "./books-tab"
import { GeneralTab } from "./general-tab"
import { ProfileTab } from "./profile-tab"
import { type IsMatch, SearchContext } from "./shared"
import { type PreferenceTab, type SectionKeywords, type Tab } from "./tabs"

const SIDEBAR_WIDTH = 200

const formTabs: Tab[] = ["general", "appearance", "books"]
const userTabs: Tab[] = ["profile"]

type SidebarTabDef = {
  value: Tab
  label: string
  icon: React.ComponentType<{ className?: string }>
}

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
  const canUpdateSettings = usePermission("settingsUpdate")
  const isMobile = useIsMobile()

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

  const onInvalid = () => {
    toast.error(t("failedToSave"))
  }

  const allTabs = useMemo<SidebarTabDef[]>(
    () => [
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
    ],
    [t],
  )

  const [activeTabRaw, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("profile"),
  )
  const activeTab = (activeTabRaw ?? "profile") as Tab

  const setActiveTabEvent = useCallback(
    (tab: Tab) => {
      void setActiveTab(tab)
    },
    [setActiveTab],
  )

  const [searchQuery, setSearchQuery] = useState("")

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

  const filteredTabs = matchingTabs
    ? allTabs.filter(
        (tab) =>
          userTabs.includes(tab.value) ||
          matchingTabs.has(tab.value as PreferenceTab),
      )
    : allTabs

  const activeTabDef = allTabs.find((t) => t.value === activeTab)
  const showSaveButton = activeTab !== "profile"

  const tabContent = (
    <>
      {activeTab === "profile" && (
        <ProfileTab
          user={user}
          linkedAccounts={linkedAccounts}
          providers={providers}
          disablePasswordLogin={disablePasswordLogin}
        />
      )}
      {activeTab === "general" && <GeneralTab form={form} />}
      {activeTab === "appearance" && <AppearanceTab form={form} />}
      {activeTab === "books" && <BooksTab form={form} />}
    </>
  )

  const headerActions = (
    <div className="flex items-center gap-3">
      {showSaveButton && (
        <Button
          type="submit"
          form="preferences-form"
          disabled={isSaving}
          size="sm"
        >
          {isSaving && <Spinner />}
          {isSaving ? t("saving") : t("save")}
        </Button>
      )}
    </div>
  )

  const sidebarContent = (
    <PreferencesSidebar
      tabs={filteredTabs}
      activeTab={activeTab}
      onTabChange={setActiveTabEvent}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      canUpdateSettings={canUpdateSettings ?? false}
    />
  )

  const contentArea = (
    <SearchContext.Provider value={{ query: searchQuery, isMatch }}>
      {formTabs.includes(activeTab) ? (
        <form
          id="preferences-form"
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <PageContent className="p-4">{tabContent}</PageContent>
        </form>
      ) : (
        <PageContent className="p-4">{tabContent}</PageContent>
      )}
    </SearchContext.Provider>
  )

  if (isMobile) {
    if (activeTab) {
      return (
        <div className="flex h-screen flex-col overflow-hidden">
          <PageHeader>
            <SiteHeader
              breadcrumbs={[
                { label: t("title") },
                ...(activeTabDef ? [{ label: activeTabDef.label }] : []),
              ]}
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void setActiveTab(null)}
                  >
                    <IconArrowLeft className="mr-1 h-4 w-4" />
                    {t("back")}
                  </Button>

                  {showSaveButton && (
                    <Button
                      type="submit"
                      form="preferences-form"
                      disabled={isSaving}
                      size="sm"
                    >
                      {isSaving && <Spinner />}
                      {isSaving ? t("saving") : t("save")}
                    </Button>
                  )}
                </div>
              }
            />
          </PageHeader>

          {contentArea}
        </div>
      )
    }

    return (
      <div className="flex h-screen flex-col">
        <PageHeader>
          <SiteHeader breadcrumbs={[{ label: t("title") }]} />
        </PageHeader>

        <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
      </div>
    )
  }

  return (
    <PageLayout>
      <PageSidebar width={SIDEBAR_WIDTH}>{sidebarContent}</PageSidebar>

      <PageMain>
        <PageHeader>
          <SiteHeader
            breadcrumbs={[
              {
                render: (
                  <h1 className="font-heading text-foreground truncate text-lg font-medium">
                    {activeTabDef?.label ?? t("title")}
                  </h1>
                ),
              },
            ]}
            actions={headerActions}
          />
        </PageHeader>

        {contentArea}
      </PageMain>
    </PageLayout>
  )
}

function PreferencesSidebar({
  tabs,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  canUpdateSettings,
}: {
  tabs: SidebarTabDef[]
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  canUpdateSettings: boolean
}) {
  const t = useTranslation("PreferencesPage")

  const userSidebarTabs = tabs.filter((tab) => userTabs.includes(tab.value))
  const prefSidebarTabs = tabs.filter((tab) => formTabs.includes(tab.value))

  return (
    <ScrollArea className="flex h-full flex-col">
      <div className="flex flex-col gap-4 px-2 pt-3 pb-3">
        {userSidebarTabs.length > 0 && (
          <SidebarGroup
            label={t("sidebar.user")}
            tabs={userSidebarTabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        )}

        {prefSidebarTabs.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1.5 px-2 text-xs font-medium tracking-wider uppercase">
              {t("sidebar.preferences")}
            </p>

            <div className="mb-2 px-1">
              <div className="relative">
                <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder={t("searchPreferences")}
                  value={searchQuery}
                  onChange={(e) => {
                    onSearchChange(e.target.value)
                  }}
                  className="h-7 pr-7 pl-8 text-xs"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange("")
                    }}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <SidebarTabList
              tabs={prefSidebarTabs}
              activeTab={activeTab}
              onTabChange={onTabChange}
            />
          </div>
        )}
      </div>

      {canUpdateSettings && (
        <div className="border-border mt-auto border-t px-3 py-3">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            className="text-muted-foreground hover:text-foreground w-full justify-start gap-2"
            render={
              <V3Link href="/settings?tab=library">
                <IconSettings className="h-4 w-4" />
                {t("settingsPage")}
              </V3Link>
            }
          />
        </div>
      )}
    </ScrollArea>
  )
}

function SidebarGroup({
  label,
  tabs,
  activeTab,
  onTabChange,
}: {
  label: string
  tabs: SidebarTabDef[]
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wider uppercase">
        {label}
      </p>

      <SidebarTabList
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    </div>
  )
}

function SidebarTabList({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: SidebarTabDef[]
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => {
            onTabChange(tab.value)
          }}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
            activeTab === tab.value
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
          )}
        >
          <tab.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
