/* eslint-disable @typescript-eslint/no-invalid-void-type */
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"

import {
  type Invite,
  type InviteRequest,
  type Settings,
  type Shelves,
  type User,
} from "@/apiModels"
import { type UpgradeResult } from "@/app/api/v2/books/[bookId]/upgrade-epub/route"
import {
  type BookRelationsUpdate,
  type BookUpdate,
  type BookWithRelations,
  type CreatorRelation,
  type SeriesRelation,
  type UserBookRatingRelation,
} from "@/database/books"
import { type ChangelogEntry } from "@/database/changelog"
import { type CollectionWithRelations } from "@/database/collections"
import { type Creator } from "@/database/creators"
import { type HomeStats } from "@/database/homeStats"
import { type ImportRuleWithCollections } from "@/database/importRules"
import { type LibraryCounts } from "@/database/libraryCounts"
import { type Position } from "@/database/positions"
import {
  type RatingDimensionScores,
  computeRatingAverage,
} from "@/database/ratingDimensions"
import {
  type NewSeries,
  type NewSeriesRelation,
  type Series,
} from "@/database/series"
import {
  type ImportMode,
  type MetadataFieldOverrides,
} from "@/database/settingsTypes"
import {
  type HomeSectionKind,
  type HomeSectionWithDetails,
  type ShelfOrderBy,
  type ShelfWithBooks,
} from "@/database/shelves"
import {
  type SidebarGroupInput,
  type SidebarGroupWithItems,
  type SidebarItemKind,
  type SidebarItemWithGroupDetails,
} from "@/database/sidebar"
import { type Status } from "@/database/statuses"
import { type Tag } from "@/database/tags"
import { type UserBookRating } from "@/database/userRatings"
import { type UserSettingValue } from "@/database/userSettings"
import { type UserPermissionSet } from "@/database/users"
import { type SeriesWithBooks } from "@/hooks/useFilterSortedSeries"
import { type ShelfFilter } from "@/shelves"
import { type UUID } from "@/uuid"

import { subscribeToBookEventStream } from "./bookEventsStream"

// client-side shape of a home section (plain string uuids over the wire)
type HomeSectionBody = {
  shelfUuid?: string | null
  kind: HomeSectionKind
  enabled?: boolean
  config?: unknown
}

// client-side shape of a sidebar item (plain string uuids over the wire)
type SidebarItemBody = {
  kind: SidebarItemKind
  builtinKey?: string | null
  collectionUuid?: string | null
  shelfUuid?: string | null
  hidden?: boolean
}

type SidebarGroupBody = SidebarGroupInput

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/v2" }),
  tagTypes: [
    "Invites",
    "Users",
    "Statuses",
    "Creators",
    "Series",
    "Collections",
    "Tags",
    "CurrentUser",
    "Authors",
    "Narrators",
    "Translators",
    "MaxUploadChunkSize",
    "UserReadingPreferences",
    "UserReadingState",
    "GpuBuildWarning",
    "Books",
    "ImportRules",
    "UserRatings",
    "HomeShelves",
    "HomeStats",
    "UserShelves",
    "UserSettings",
    "Sidebar",
  ],
  endpoints: (build) => ({
    createInvite: build.mutation<Invite, InviteRequest>({
      query: (inviteRequest) => ({
        url: "/invites",
        method: "POST",
        body: inviteRequest,
      }),
      invalidatesTags: () => ["Invites"],
    }),
    resendInvite: build.mutation<void, { inviteKey: string }>({
      query: ({ inviteKey }) => ({
        url: `/invites/${inviteKey}/send`,
        method: "POST",
      }),
    }),
    deleteInvite: build.mutation<void, { inviteKey: string }>({
      query: ({ inviteKey }) => ({
        url: `/invites/${inviteKey}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { inviteKey }) => [
        { type: "Invites", id: inviteKey },
      ],
    }),
    listInvites: build.query<Invite[], void>({
      query: () => "/invites",
      providesTags: (invites) =>
        invites?.map((invite) => ({
          type: "Invites",
          id: invite.inviteKey,
        })) ?? ["Invites"],
    }),
    listUsers: build.query<User[], void>({
      query: () => "/users",
      providesTags: (users) =>
        users?.map((user) => ({ type: "Users", id: user.id })) ?? ["Users"],
    }),
    deleteUser: build.mutation<void, { uuid: UUID }>({
      query: ({ uuid }) => ({
        url: `/users/${uuid}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { uuid }) => [
        { type: "Users", id: uuid },
      ],
    }),
    updateUser: build.mutation<
      void,
      { uuid: UUID; permissions: UserPermissionSet }
    >({
      query: ({ uuid, permissions }) => ({
        url: `/users/${uuid}`,
        method: "PUT",
        body: { permissions },
      }),
      invalidatesTags: (_result, _error, { uuid }) => [
        { type: "Users", id: uuid },
      ],
    }),
    getCurrentUser: build.query<User, void>({
      query: () => "/user",
      providesTags: () => ["CurrentUser"],
    }),
    getMaxUploadChunkSize: build.query<
      { maxUploadChunkSize: number | null; overriden: boolean },
      void
    >({
      query: () => "/settings/maxUploadChunkSize",
      providesTags: () => ["MaxUploadChunkSize"],
    }),
    updateSettings: build.mutation({
      query: (settings: Settings) => ({
        url: "/settings",
        method: "PUT",
        body: settings,
      }),
      invalidatesTags: ["MaxUploadChunkSize"],
    }),
    getGpuBuildWarning: build.query<
      | {
          showWarning: true
          variant: string | undefined
          whisperBuild: string | null
        }
      | { showWarning: false; variant?: never; whisperBuild?: never },
      void
    >({
      query: () => ({
        url: "/books/_/process",
        method: "POST",
        params: { gpuWarning: "check" },
      }),
      providesTags: ["GpuBuildWarning"],
    }),
    getBook: build.query<BookWithRelations, { uuid: UUID }>({
      query: ({ uuid }) => `/books/${uuid}`,

      // need to decide on what approach to take here
      providesTags: (result) =>
        result
          ? ([
              { type: "Books" as const, id: result.uuid },
              ...result.authors.map((author) => ({
                type: "Authors" as const,
                id: author.uuid,
              })),
              ...result.creators.map((creator) => ({
                type: "Creators" as const,
                id: creator.uuid,
              })),
              ...result.series.map((series) => ({
                type: "Series" as const,
                id: series.uuid,
              })),
              ...result.collections.map((collection) => ({
                type: "Collections" as const,
                id: collection.uuid,
              })),
              ...result.tags.map((tag) => ({
                type: "Tags" as const,
                id: tag.uuid,
              })),
              ...(result.status
                ? [{ type: "Statuses" as const, id: result.status.uuid }]
                : []),
            ] as const)
          : [],
      onCacheEntryAdded: async (
        { uuid },
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) => {
        try {
          await cacheDataLoaded
        } catch {
          /* empty */
        }

        const unsubscribe = subscribeToBookEventStream((event) => {
          if (event.bookUuid !== uuid) return
          if (event.type !== "bookUpdated") return

          updateCachedData((draft) => {
            Object.assign(draft, event.payload)
          })
        })

        await cacheEntryRemoved
        unsubscribe()
      },
    }),
    deleteBook: build.mutation<
      void,
      {
        uuid: UUID
        preventReImport?: boolean
      }
    >({
      query: ({ uuid, preventReImport }) => ({
        url: `/books/${uuid}`,
        method: "DELETE",
        params: {
          preventReImport,
        },
      }),
    }),
    deleteBookAssets: build.mutation<void, { uuid: UUID; originals?: boolean }>(
      {
        query: ({ uuid, originals }) => ({
          url: `/books/${uuid}/cache`,
          method: "DELETE",
          params: {
            originals,
          },
        }),
      },
    ),
    clearBooksCache: build.mutation<void, { bookUuids?: UUID[] }>({
      query: ({ bookUuids }) => ({
        url: `/books/cache`,
        method: "DELETE",
        body: { bookUuids },
      }),
    }),
    deleteBooks: build.mutation<
      void,
      {
        books: UUID[]
        preventReImport?: boolean
      }
    >({
      query: ({ books, preventReImport }) => ({
        url: `/books`,
        method: "DELETE",
        body: {
          books,
          preventReImport,
        },
      }),
    }),
    replaceBookAsset: build.mutation<
      BookWithRelations,
      {
        uuid: UUID
        format: "ebook" | "audiobook" | "readaloud"
        path: string
        importMode?: ImportMode
        metadataFieldOverrides?: MetadataFieldOverrides
      }
    >({
      query: ({ uuid, ...body }) => ({
        url: `/books/${uuid}/replace-asset`,
        method: "POST",
        body,
      }),
    }),
    removeBookAsset: build.mutation<
      BookWithRelations,
      {
        uuid: UUID
        format: "ebook" | "audiobook" | "readaloud"
      }
    >({
      query: ({ uuid, format }) => ({
        url: `/books/${uuid}/replace-asset`,
        method: "DELETE",
        params: { format },
      }),
    }),
    getImportRules: build.query<ImportRuleWithCollections[], void>({
      query: () => `/import-rules`,
      providesTags: ["ImportRules"],
    }),
    getUserImportRules: build.query<ImportRuleWithCollections[], void>({
      query: () => `/import-rules?source=user`,
      providesTags: ["ImportRules"],
    }),
    createImportRule: build.mutation<
      ImportRuleWithCollections,
      {
        kind: "watch" | "ignore"
        path: string
        importMode?: string | null
        collectionUuids?: UUID[]
      }
    >({
      query: (body) => ({
        url: `/import-rules`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["ImportRules"],
    }),
    updateImportRule: build.mutation<
      ImportRuleWithCollections,
      {
        uuid: UUID
        path?: string
        importMode?: string | null
        collectionUuids?: UUID[]
      }
    >({
      query: ({ uuid, ...body }) => ({
        url: `/import-rules/${uuid}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["ImportRules"],
    }),
    deleteImportRule: build.mutation<void, { uuid: UUID }>({
      query: ({ uuid }) => ({
        url: `/import-rules/${uuid}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ImportRules"],
    }),
    deleteImportRules: build.mutation<void, { uuids: UUID[] }>({
      query: ({ uuids }) => ({
        url: `/import-rules`,
        method: "DELETE",
        body: { uuids },
      }),
      invalidatesTags: ["ImportRules"],
    }),
    getPosition: build.query<Position, { uuid: UUID }>({
      query: ({ uuid }) => `/books/${uuid}/positions`,
    }),
    updatePosition: build.mutation<void, { uuid: UUID; position: Position }>({
      query: ({ uuid, position }) => ({
        url: `/books/${uuid}/positions`,
        method: "POST",
        body: position,
      }),
    }),
    getShelves: build.query<Shelves, void>({
      query: () => "/shelves",
    }),
    listBooks: build.query<BookWithRelations[], void>({
      query: () => "/books",
      onCacheEntryAdded: async (
        _,
        // This is safe to use unbound
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved },
      ) => {
        try {
          await cacheDataLoaded
        } catch {
          // no-op in case `cacheEntryRemoved` resolves before `cacheDataLoaded`,
          // in which case `cacheDataLoaded` will throw
        }

        const unsubscribe = subscribeToBookEventStream((event) => {
          updateCachedData((draft) => {
            if (event.type === "bookCreated") {
              draft.push(event.payload)
              return
            }

            if (event.type === "bookDeleted") {
              const deletedIndex = draft.findIndex(
                (book) => book.uuid === event.bookUuid,
              )
              draft.splice(deletedIndex, 1)
              return
            }

            draft.forEach((draftBook) => {
              if (draftBook.uuid !== event.bookUuid) return

              switch (event.type) {
                case "bookUpdated": {
                  Object.assign(draftBook, event.payload)
                  return
                }
                default: {
                  return
                }
              }
            })
          })
        })

        await cacheEntryRemoved

        unsubscribe()
      },
    }),
    listInfiniteBooks: build.infiniteQuery<
      BookWithRelations[],
      ListBooksQueryArg,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,

        getNextPageParam: (
          lastPage,
          _allPages,
          lastPageParam,
          _allPageParams,
          queryArg,
        ) => {
          const limit = queryArg.limit ?? 50
          if (lastPage.length < limit) return undefined
          return lastPageParam + 1
        },
        getPreviousPageParam: (
          _firstPage,
          _allPages,
          firstPageParam,
          _allPageParams,
          _queryArg,
        ) => {
          return firstPageParam > 0 ? firstPageParam - 1 : undefined
        },
      },
      query: ({ pageParam, queryArg }) => {
        const limit = queryArg.limit ?? 50
        const params = new URLSearchParams()
        params.set("limit", String(limit))
        params.set("offset", String(pageParam * limit))
        if (queryArg.orderBy) params.set("orderBy", queryArg.orderBy)
        if (queryArg.orderDirection)
          params.set("orderDirection", queryArg.orderDirection)
        if (queryArg.search) params.set("search", queryArg.search)
        if (queryArg.collection) params.set("collection", queryArg.collection)
        if (queryArg.series) params.set("series", queryArg.series)
        if (queryArg.mediaFilter && queryArg.mediaFilter !== "all")
          params.set("mediaFilter", queryArg.mediaFilter)
        if (queryArg.statusFilter) params.set("status", queryArg.statusFilter)
        return `/books?${params.toString()}`
      },
      providesTags: ["Books"],
    }),
    processBook: build.mutation<
      void,
      {
        uuid: UUID
        restart?: "full" | "transcription" | "sync" | false
        dismissGpuWarning?: boolean
      }
    >({
      query: ({ uuid, restart, dismissGpuWarning }) => {
        const params: Record<string, string> = {}
        if (restart) params["restart"] = restart
        if (dismissGpuWarning) params["gpuWarning"] = "dismiss"
        return {
          url: `/books/${uuid}/process`,
          method: "POST",
          ...(Object.keys(params).length > 0 && { params }),
        }
      },
      invalidatesTags: (_result, _error, { dismissGpuWarning }) =>
        dismissGpuWarning ? ["GpuBuildWarning"] : [],
    }),
    cancelProcessing: build.mutation<void, { uuid: UUID }>({
      query: ({ uuid }) => ({
        url: `/books/${uuid}/process`,
        method: "DELETE",
      }),
    }),
    triggerBookScan: build.mutation<
      void,
      {
        uuid: UUID
        force?: boolean
        metadataFieldOverrides?: Record<string, string>
      }
    >({
      query: ({ uuid, force, metadataFieldOverrides }) => ({
        url: `/books/${uuid}/scan`,
        method: "POST",
        ...(force && { params: { force: "true" } }),
        ...(metadataFieldOverrides && {
          body: { metadataFieldOverrides },
        }),
      }),
    }),
    triggerScan: build.mutation<
      void,
      {
        force?: boolean
        metadataFieldOverrides?: Record<string, string>
      } | void
    >({
      query: (args) => ({
        url: "/books/scan",
        method: "POST",
        ...(args?.force && { params: { force: "true" } }),
        ...(args?.metadataFieldOverrides && {
          body: { metadataFieldOverrides: args.metadataFieldOverrides },
        }),
      }),
    }),
    scanBooks: build.mutation<void, { bookUuids: string[]; force?: boolean }>({
      query: (args) => ({
        url: "/books/scan",
        method: "POST",
        ...(args.force && { params: { force: "true" } }),
        body: { bookUuids: args.bookUuids },
      }),
    }),
    cancelScan: build.mutation<void, void>({
      query: () => ({
        url: "/books/scan",
        method: "DELETE",
      }),
    }),
    getScanState: build.query<
      { running: boolean; source: string | null; startedAt: number | null },
      void
    >({
      query: () => "/books/scan",
    }),
    upgradeBookEpub: build.mutation<
      Record<string, UpgradeResult>,
      { uuid: UUID; createBackup?: boolean; backupSuffix?: string }
    >({
      query: ({ uuid, createBackup, backupSuffix }) => ({
        url: `/books/${uuid}/upgrade-epub`,
        method: "POST",
        body: { createBackup, backupSuffix },
      }),
    }),
    mergeBooks: build.mutation<
      BookWithRelations,
      { update: BookUpdate; relations: BookRelationsUpdate; from: UUID[] }
    >({
      query: (body) => ({
        url: `/books/merge`,
        method: "POST",
        body,
      }),
    }),
    createBook: build.mutation<
      BookWithRelations,
      {
        collection: UUID | undefined
        paths: string[]
        importMode?: ImportMode
      }
    >({
      query: (body) => ({
        url: `/books`,
        method: "POST",
        body,
      }),
    }),
    updateBook: build.mutation<
      BookWithRelations,
      {
        update: {
          uuid: BookUpdate["uuid"]
          title?: BookUpdate["title"]
          subtitle?: BookUpdate["subtitle"]
          language?: BookUpdate["language"]
          status?: UUID | undefined
          publicationDate?: BookUpdate["publicationDate"]
          authors?: string[]
          creators?: CreatorRelation[]
          pageCount?: number | null
          duration?: number | null
          series?: SeriesRelation[]
          collections?: UUID[]
          tags?: string[]
          narrators?: string[]
          rating?: UserBookRatingRelation
          description?: string | null
        }
        textCover?: File | null
        audioCover?: File | null
      }
    >({
      query: ({ update, textCover, audioCover }) => {
        const updatedFields = Object.entries({
          ...update,
          textCover,
          audioCover,
        }).reduce<string[]>(
          (acc, [field, value]) =>
            value !== undefined ? [...acc, field] : acc,
          [],
        )
        const body = new FormData()

        for (const field of updatedFields) {
          body.append("fields", field)
        }

        if (updatedFields.includes("title")) {
          body.append("title", JSON.stringify(update.title))
        }
        if (updatedFields.includes("subtitle")) {
          body.append("subtitle", JSON.stringify(update.subtitle))
        }
        if (updatedFields.includes("language")) {
          body.append("language", JSON.stringify(update.language))
        }
        if (updatedFields.includes("publicationDate")) {
          body.append("publicationDate", JSON.stringify(update.publicationDate))
        }
        if (updatedFields.includes("status")) {
          body.append("status", JSON.stringify(update.status))
        }
        if (updatedFields.includes("description")) {
          body.append("description", JSON.stringify(update.description))
        }
        if (updatedFields.includes("pageCount")) {
          body.append("pageCount", JSON.stringify(update.pageCount))
        }
        if (updatedFields.includes("duration")) {
          body.append("duration", JSON.stringify(update.duration))
        }

        if (update.tags) {
          for (const tag of update.tags) {
            body.append("tags", JSON.stringify(tag))
          }
        }

        if (update.narrators) {
          for (const narrator of update.narrators) {
            body.append("narrators", JSON.stringify(narrator))
          }
        }

        if (update.authors) {
          for (const author of update.authors) {
            body.append("authors", JSON.stringify(author))
          }
        }

        if (update.creators) {
          for (const creator of update.creators) {
            body.append("creators", JSON.stringify(creator))
          }
        }

        if (update.series) {
          for (const series of update.series) {
            body.append("series", JSON.stringify(series))
          }
        }

        if (update.collections) {
          for (const collection of update.collections) {
            body.append("collections", collection)
          }
        }

        if (textCover != null) {
          body.append("textCover", textCover)
        }

        if (audioCover != null) {
          body.append("audioCover", audioCover)
        }

        return {
          url: `/books/${update.uuid}`,
          method: "PUT",
          body,
        }
      },
      // maybe just rely on the eventsource
      invalidatesTags: (book) => [
        "Creators",
        "Authors",
        "Series",
        "Tags",
        "Books",
        ...(book ? [{ type: "Books" as const, id: book.uuid }] : []),
        ...(book
          ? book.authors.map((author) => ({
              type: "Authors" as const,
              id: author.uuid,
            }))
          : []),
        ...(book
          ? book.creators.map((creator) => ({
              type: "Creators" as const,
              id: creator.uuid,
            }))
          : []),
        ...(book
          ? book.series.map((series) => ({
              type: "Series" as const,
              id: series.uuid,
            }))
          : []),
        ...(book
          ? book.collections.map((collection) => ({
              type: "Collections" as const,
              id: collection.uuid,
            }))
          : []),
        ...(book
          ? book.tags.map((tag) => ({ type: "Tags" as const, id: tag.uuid }))
          : []),
        ...(book
          ? book.status
            ? [{ type: "Statuses" as const, id: book.status.uuid }]
            : []
          : []),
        "UserRatings",
      ],

      onQueryStarted: async (
        { update },
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        { dispatch, getState, queryFulfilled },
      ) => {
        const patchResult = dispatch(
          api.util.updateQueryData(
            "getBook",
            { uuid: update.uuid as UUID },
            (draft) => {
              if (update.title !== undefined) draft.title = update.title
              if (update.subtitle !== undefined)
                draft.subtitle = update.subtitle
              if (update.language !== undefined)
                draft.language = update.language
              if (update.description !== undefined)
                draft.description = update.description
              if (update.publicationDate !== undefined)
                draft.publicationDate = update.publicationDate

              if (update.status !== undefined) {
                const statuses = api.endpoints.listStatuses.select()(getState())
                const status = statuses.data?.find(
                  (s) => s.uuid === update.status,
                )

                if (status) {
                  draft.status = {
                    uuid: status.uuid,
                    name: status.name,
                    createdAt: status.createdAt,
                    updatedAt: status.updatedAt,
                  }
                }
              }

              if (update.rating !== undefined) {
                Object.assign(draft, {
                  rating: {
                    rating: update.rating.rating ?? null,
                    review: update.rating.review ?? null,
                  },
                })
              }

              if (update.pageCount !== undefined && draft.ebook) {
                draft.ebook.pageCount = update.pageCount
              }

              if (update.duration !== undefined && draft.audiobook) {
                draft.audiobook.duration = update.duration
              }
            },
          ),
        )

        try {
          await queryFulfilled
        } catch {
          patchResult.undo()
        }
      },
    }),
    updateStatus: build.mutation<void, { bookUuid: UUID; statusUuid: UUID }>({
      query: ({ bookUuid, statusUuid }) => ({
        url: `/books/${bookUuid}/status`,
        method: "PUT",
        body: {
          status: statusUuid,
        },
      }),
      invalidatesTags: (_result, _error, { bookUuid, statusUuid }) => [
        "Books",
        "Statuses",
        { type: "Books", id: bookUuid },
        { type: "Statuses", id: statusUuid },
      ],

      onQueryStarted: async (
        { bookUuid, statusUuid },
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        { dispatch, getState, queryFulfilled },
      ) => {
        const statuses = api.endpoints.listStatuses.select()(getState())
        const status = statuses.data?.find((s) => s.uuid === statusUuid)

        if (!status) {
          await queryFulfilled
          return
        }

        const patchResult = dispatch(
          api.util.updateQueryData("getBook", { uuid: bookUuid }, (draft) => {
            draft.status = {
              uuid: status.uuid,
              name: status.name,
              createdAt: status.createdAt,
              updatedAt: status.updatedAt,
            }
          }),
        )

        try {
          await queryFulfilled
        } catch {
          patchResult.undo()
        }
      },
    }),
    getLibraryCounts: build.query<LibraryCounts, void>({
      query: () => `/library/counts`,
      // recompute whenever anything a count depends on changes. the query is
      // cheap and shared, so a broad invalidation set keeps the badges honest.
      providesTags: [
        "Books",
        "Series",
        "Authors",
        "Narrators",
        "Translators",
        "Tags",
        "Statuses",
        "Collections",
        "UserRatings",
        "UserShelves",
        "Sidebar",
      ],
    }),
    listStatuses: build.query<Status[], void>({
      query: () => `/statuses`,
      providesTags: (statuses) =>
        statuses?.map((status) => ({ type: "Statuses", id: status.uuid })) ?? [
          "Statuses",
        ],
    }),
    listCreators: build.query<Creator[], void>({
      query: () => "/creators",
      providesTags: (creators) =>
        creators?.map((creator) => ({
          type: "Creators",
          id: creator.uuid,
        })) ?? ["Creators"],
    }),
    listAuthors: build.query<Creator[], void>({
      query: () => "/creators?role=aut",
      providesTags: (creators) =>
        creators?.map((creator) => ({
          type: "Authors",
          id: creator.uuid,
        })) ?? ["Authors"],
    }),

    listNarrators: build.query<Creator[], void>({
      query: () => "/creators?role=nrt",
      providesTags: (creators) =>
        creators?.map((creator) => ({
          type: "Narrators",
          id: creator.uuid,
        })) ?? ["Narrators"],
    }),

    listTranslators: build.query<Creator[], void>({
      query: () => "/creators?role=trl",
      providesTags: (creators) =>
        creators?.map((creator) => ({
          type: "Translators",
          id: creator.uuid,
        })) ?? ["Translators"],
    }),
    listSeries: build.query<Series[], void>({
      query: () => "/series",
      providesTags: (series) =>
        series?.map((s) => ({ type: "Series", id: s.uuid })) ?? ["Series"],
    }),
    updateSeries: build.mutation<
      SeriesWithBooks,
      {
        uuid: UUID
        update: {
          name: string
          description: string
          relations: NewSeriesRelation[]
        }
      }
    >({
      query: ({ uuid, update }) => ({
        url: `/series/${uuid}`,
        method: "PUT",
        body: update,
      }),
      invalidatesTags: (_result, _error, { uuid }) => [
        "Series",
        { type: "Series", id: uuid },
      ],
    }),
    deleteSeries: build.mutation<void, { uuid: UUID }>({
      query: ({ uuid }) => ({
        url: `/series/${uuid}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { uuid }) => [
        "Series",
        { type: "Series", id: uuid },
      ],
    }),
    listCollections: build.query<CollectionWithRelations[], void>({
      query: () => "/collections",
      providesTags: (collections) =>
        collections?.map((collection) => ({
          type: "Collections",
          id: collection.uuid,
        })) ?? [{ type: "Collections" }],
    }),
    deleteCollection: build.mutation<void, { uuid: UUID }>({
      query: ({ uuid }) => ({
        url: `/collections/${uuid}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Collections", "Sidebar"],
    }),
    updateCollection: build.mutation<
      CollectionWithRelations,
      {
        uuid: UUID
        update: {
          name?: string
          description?: string | null
          public?: boolean
          users?: UUID[]
          books?: UUID[]
          icon?: string | null
          color?: string | null
        }
      }
    >({
      query: ({ uuid, update }) => ({
        url: `/collections/${uuid}`,
        method: "PUT",
        body: update,
      }),
      invalidatesTags: (_result, _error, { uuid }) => [
        "Collections",
        { type: "Collections", id: uuid },
      ],
    }),
    addBooksToCollections: build.mutation<
      void,
      { collections: UUID[]; books: UUID[] }
    >({
      query: (body) => ({
        url: `/collections/books`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { books, collections }) => [
        ...books.map((uuid) => ({ type: "Books" as const, id: uuid })),
        ...collections.map((uuid) => ({
          type: "Collections" as const,
          id: uuid,
        })),
      ],
    }),
    removeBooksFromCollections: build.mutation<
      void,
      { collections: UUID[]; books: UUID[] }
    >({
      query: (body) => ({
        url: `/collections/books`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: (_result, _error, { books, collections }) => [
        ...books.map((uuid) => ({ type: "Books" as const, id: uuid })),
        ...collections.map((uuid) => ({
          type: "Collections" as const,
          id: uuid,
        })),
      ],
    }),
    createCollection: build.mutation<
      CollectionWithRelations,
      {
        name: string
        description: string
        public: boolean
        users: string[]
      }
    >({
      query: ({ name, description, public: isPublic, users }) => ({
        url: "/collections",
        method: "POST",
        body: {
          name,
          description,
          public: isPublic,
          ...(!isPublic && { users }),
        },
      }),
      invalidatesTags: ["Collections"],
    }),
    addBooksToSeries: build.mutation<
      void,
      { series: NewSeries; relations: NewSeriesRelation[] }
    >({
      query: (body) => ({
        url: `/series/books`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { relations }) => [
        "Series",
        ...relations.map((r) => ({ type: "Books" as const, id: r.bookUuid })),
      ],

      onQueryStarted: async (
        { series, relations },
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        { dispatch, getState, queryFulfilled },
      ) => {
        const seriesUuid = series.uuid

        const existingSeries = seriesUuid
          ? api.endpoints.listSeries
              .select()(getState())
              .data?.find((s) => s.uuid === seriesUuid)
          : undefined

        const now = new Date().toISOString()
        const seriesEntry = {
          uuid: (seriesUuid ?? crypto.randomUUID()) as UUID,
          name: series.name,
          createdAt: existingSeries?.createdAt ?? now,
          updatedAt: existingSeries?.updatedAt ?? now,
        }

        const patches = relations.map((relation) =>
          dispatch(
            api.util.updateQueryData(
              "getBook",
              { uuid: relation.bookUuid },
              (draft) => {
                if (
                  seriesUuid &&
                  draft.series.some((s) => s.uuid === seriesUuid)
                ) {
                  return
                }

                draft.series.push({
                  ...seriesEntry,
                  position: relation.position ?? null,
                  featured: relation.featured ?? false,
                })
              },
            ),
          ),
        )

        try {
          await queryFulfilled
        } catch {
          patches.forEach((p) => {
            p.undo()
          })
        }
      },
    }),
    removeBooksFromSeries: build.mutation<
      void,
      { series: UUID[]; books: UUID[] }
    >({
      query: (body) => ({
        url: "/series/books",
        method: "DELETE",
        body,
      }),
      invalidatesTags: (_result, _error, { books, series }) => [
        ...books.map((uuid) => ({ type: "Books" as const, id: uuid })),
        ...series.map((uuid) => ({ type: "Series" as const, id: uuid })),
      ],

      onQueryStarted: async (
        { series, books },
        { dispatch, queryFulfilled },
      ) => {
        const seriesSet = new Set(series)

        const patches = books.map((bookUuid) =>
          dispatch(
            api.util.updateQueryData("getBook", { uuid: bookUuid }, (draft) => {
              draft.series = draft.series.filter((s) => !seriesSet.has(s.uuid))
            }),
          ),
        )

        try {
          await queryFulfilled
        } catch {
          patches.forEach((p) => {
            p.undo()
          })
        }
      },
    }),
    listTags: build.query<Tag[], void>({
      query: () => "/tags",
      providesTags: (tags) =>
        tags?.map((tag) => ({ type: "Tags", id: tag.uuid })) ?? ["Tags"],
    }),
    createTag: build.mutation<
      Tag,
      { name: string; icon?: string | null; color?: string | null }
    >({
      query: (body) => ({
        url: "/tags",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Tags"],
    }),
    addTagsToBooks: build.mutation<void, { tags: string[]; books: UUID[] }>({
      query: (body) => ({
        url: `/books/tags`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { books }) => [
        "Tags",
        ...books.map((uuid) => ({ type: "Books" as const, id: uuid })),
      ],
    }),
    removeTagsFromBooks: build.mutation<void, { tags: UUID[]; books: UUID[] }>({
      query: (body) => ({
        url: "/books/tags",
        method: "DELETE",
        body,
      }),
      invalidatesTags: (_result, _error, { books, tags }) => [
        "Tags",
        ...books.map((uuid) => ({ type: "Books" as const, id: uuid })),
        ...tags.map((uuid) => ({ type: "Tags" as const, id: uuid })),
      ],
    }),

    updateTag: build.mutation<
      Tag,
      {
        uuid: UUID
        update: {
          name?: string
          icon?: string | null
          color?: string | null
        }
      }
    >({
      query: ({ uuid, update }) => ({
        url: `/tags/${uuid}`,
        method: "PUT",
        body: update,
      }),
      invalidatesTags: ["Tags", "Books"],
    }),

    deleteTag: build.mutation<void, { uuid: UUID }>({
      query: ({ uuid }) => ({
        url: `/tags/${uuid}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Tags", "Books", "UserShelves"],
    }),

    mergeTags: build.mutation<void, { targetUuid: UUID; sourceUuids: UUID[] }>({
      query: (body) => ({
        url: "/tags/merge",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Tags", "Books", "UserShelves"],
    }),

    updateCreator: build.mutation<
      Creator,
      { uuid: UUID; update: { name?: string; fileAs?: string } }
    >({
      query: ({ uuid, update }) => ({
        url: `/creators/${uuid}`,
        method: "PUT",
        body: update,
      }),
      invalidatesTags: ["Authors", "Narrators", "Translators", "Books"],
    }),

    deleteCreator: build.mutation<void, { uuid: UUID }>({
      query: ({ uuid }) => ({
        url: `/creators/${uuid}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        "Authors",
        "Narrators",
        "Translators",
        "Books",
        "UserShelves",
      ],
    }),

    mergeCreators: build.mutation<
      void,
      { targetUuid: UUID; sourceUuids: UUID[] }
    >({
      query: (body) => ({
        url: "/creators/merge",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        "Authors",
        "Narrators",
        "Translators",
        "Books",
        "UserShelves",
      ],
    }),

    mergeSeries: build.mutation<
      void,
      { targetUuid: UUID; sourceUuids: UUID[] }
    >({
      query: (body) => ({
        url: "/series/merge",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Series", "Books", "UserShelves"],
    }),

    mergeCollections: build.mutation<
      void,
      { targetUuid: UUID; sourceUuids: UUID[] }
    >({
      query: (body) => ({
        url: "/collections/merge",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Collections", "Books", "UserShelves"],
    }),
    updateReadingStatus: build.mutation<
      BookWithRelations,
      { status: UUID; books: UUID[] }
    >({
      query: (body) => ({
        url: "/books/status",
        method: "PUT",
        body,
      }),
    }),
    getBookRating: build.query<UserBookRating | null, { bookUuid: UUID }>({
      query: ({ bookUuid }) => `/books/${bookUuid}/rating`,
      providesTags: (_result, _error, { bookUuid }) => [
        { type: "UserRatings", id: `${bookUuid}-${_result?.userId}` },
      ],
    }),
    setBookRating: build.mutation<
      UserBookRating | null,
      {
        bookUuid: UUID
        rating?: number | null
        review?: string | null
        dimensions?: RatingDimensionScores | null
      }
    >({
      query: ({ bookUuid, ...body }) => ({
        url: `/books/${bookUuid}/rating`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { bookUuid }) => [
        { type: "UserRatings", id: bookUuid },
        "UserRatings",
        { type: "Books", id: bookUuid },
      ],

      onQueryStarted: async (
        { bookUuid, rating, review, dimensions },
        { dispatch, queryFulfilled },
      ) => {
        const patchResult = dispatch(
          api.util.updateQueryData("getBook", { uuid: bookUuid }, (draft) => {
            const existing = draft.rating
            const nextReview =
              review !== undefined ? review : (existing?.review ?? null)

            // mirror the server: dimensions, when provided, drive the rating
            let nextRating: number | null
            let nextDimensions: RatingDimensionScores | null

            if (dimensions !== undefined) {
              const scores =
                dimensions && Object.values(dimensions).length
                  ? dimensions
                  : null
              nextDimensions = scores

              if (scores) {
                nextRating = computeRatingAverage(scores)
              } else {
                nextRating =
                  rating !== undefined ? rating : (existing?.rating ?? null)
              }
            } else {
              nextRating =
                rating !== undefined ? rating : (existing?.rating ?? null)
              nextDimensions = existing?.dimensions ?? null
            }

            // Object.assign (not a direct `draft.rating =`) sidesteps the
            // intersection type kysely infers for the rating column
            Object.assign(draft, {
              rating:
                nextRating == null && nextReview == null
                  ? null
                  : {
                      rating: nextRating,
                      review: nextReview,
                      dimensions: nextDimensions,
                    },
            })
          }),
        )

        try {
          await queryFulfilled
        } catch {
          patchResult.undo()
        }
      },
    }),
    deleteBookRating: build.mutation<void, { bookUuid: UUID }>({
      query: ({ bookUuid }) => ({
        url: `/books/${bookUuid}/rating`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { bookUuid }) => [
        { type: "UserRatings", id: bookUuid },
        "UserRatings",
        { type: "Books", id: bookUuid },
      ],

      onQueryStarted: async ({ bookUuid }, { dispatch, queryFulfilled }) => {
        const patchResult = dispatch(
          api.util.updateQueryData("getBook", { uuid: bookUuid }, (draft) => {
            draft.rating = null
          }),
        )

        try {
          await queryFulfilled
        } catch {
          patchResult.undo()
        }
      },
    }),
    listUserRatings: build.query<UserBookRating[], void>({
      query: () => "/user/ratings",
      providesTags: (ratings) =>
        ratings?.map((r) => ({
          type: "UserRatings",
          id: `${r.bookUuid}-${r.userId}`,
        })) ?? ["UserRatings"],
    }),

    getUserSettings: build.query<Record<string, UserSettingValue>, void>({
      query: () => "/user/settings",
      providesTags: ["UserSettings"],
    }),
    updateUserSettings: build.mutation<void, Record<string, UserSettingValue>>({
      query: (body) => ({
        url: "/user/settings",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["UserSettings"],
    }),
    setUserSetting: build.mutation<
      void,
      { name: string; value: UserSettingValue }
    >({
      query: ({ name, value }) => ({
        url: `/user/settings`,
        method: "PUT",
        body: { [name]: value },
      }),
      invalidatesTags: ["UserSettings"],
    }),

    getInfiniteChangelog: build.infiniteQuery<
      ChangelogEntry[],
      string,
      { page: number; perPage: number }
    >({
      infiniteQueryOptions: {
        getNextPageParam: (_lastPage, _allPages, lastPageParam) => {
          return {
            page: lastPageParam.page + 1,
            perPage: lastPageParam.perPage,
          }
        },
        initialPageParam: { page: 1, perPage: 20 },
        getPreviousPageParam: (_firstPage, _allPages, firstPageParam) => {
          return firstPageParam.page > 1
            ? {
                page: firstPageParam.page - 1,
                perPage: firstPageParam.perPage,
              }
            : undefined
        },
      },
      query: ({ pageParam, queryArg }) => {
        const params = new URLSearchParams({
          component: queryArg,
          page: String(pageParam.page),
          perPage: String(pageParam.perPage),
        })
        return `/changelog?${params.toString()}`
      },
    }),

    getChangelog: build.query<
      ChangelogEntry[],
      { component?: string; page?: number; perPage?: number }
    >({
      query: ({ component = "web", page = 1, perPage = 20 }) => {
        const params = new URLSearchParams({
          component,
          page: String(page),
          perPage: String(perPage),
        })
        return `/changelog?${params.toString()}`
      },
    }),

    getLatestVersion: build.query<
      { version: string | null },
      { component?: string; beta?: boolean }
    >({
      query: ({ component = "web", beta = false }) =>
        `/changelog/latest?component=${component}&beta=${beta}`,
    }),

    // shelves
    getHomeStats: build.query<HomeStats, void>({
      query: () => "/home/stats",
      providesTags: ["HomeStats"],
    }),

    listHomeShelves: build.query<HomeSectionWithDetails[], void>({
      query: () => "/shelves/home",
      providesTags: ["HomeShelves"],
    }),

    setHomeShelves: build.mutation<HomeSectionWithDetails[], HomeSectionBody[]>(
      {
        query: (body) => ({
          url: "/shelves/home",
          method: "PUT",
          body,
        }),
        invalidatesTags: ["HomeShelves"],
      },
    ),

    addHomeShelf: build.mutation<HomeSectionWithDetails, HomeSectionBody>({
      query: (body) => ({
        url: "/shelves/home",
        method: "POST",
        body,
      }),
      invalidatesTags: ["HomeShelves"],
    }),

    removeHomeShelf: build.mutation<void, { uuid: string }>({
      query: ({ uuid }) => ({
        url: `/shelves/home/${uuid}`,
        method: "DELETE",
      }),
      invalidatesTags: ["HomeShelves"],
    }),

    listSidebar: build.query<SidebarItemWithGroupDetails[], void>({
      query: () => "/sidebar",
      providesTags: ["Sidebar"],
    }),

    setSidebar: build.mutation<SidebarItemWithGroupDetails[], SidebarItemBody[]>({
      query: (body) => ({
        url: "/sidebar",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Sidebar"],
    }),

    listSidebarGroups: build.query<SidebarGroupWithItems[], void>({
      query: () => "/sidebar-groups",
      providesTags: ["Sidebar"],
    }),

    setSidebarGroups: build.mutation<SidebarGroupWithItems[], SidebarGroupBody[]>({
      query: (body) => ({
        url: "/sidebar-groups",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Sidebar"],
    }),

    toggleSidebarGroupCollapsed: build.mutation<
      void,
      { groupUuid: string; collapsed: boolean }
    >({
      query: (body) => ({
        url: "/sidebar-groups",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Sidebar"],
    }),

    listUserShelves: build.query<ShelfWithBooks[], void>({
      query: () => "/shelves",
      providesTags: ["UserShelves"],
    }),

    createUserShelf: build.mutation<
      ShelfWithBooks,
      {
        name: string
        description?: string | null
        filter?: ShelfFilter | null
        orderBy?: ShelfOrderBy
        orderDirection?: "asc" | "desc"
        limitCount?: number | null
        books?: string[]
        icon?: string | null
        color?: string | null
      }
    >({
      query: (body) => ({
        url: "/shelves",
        method: "POST",
        body,
      }),
      invalidatesTags: ["UserShelves", "Sidebar"],
    }),

    updateUserShelf: build.mutation<
      ShelfWithBooks,
      {
        uuid: string
        name?: string
        description?: string | null
        filter?: ShelfFilter | null
        orderBy?: ShelfOrderBy
        orderDirection?: "asc" | "desc"
        limitCount?: number | null
        books?: string[]
        icon?: string | null
        color?: string | null
      }
    >({
      query: ({ uuid, ...body }) => ({
        url: `/shelves/${uuid}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["UserShelves", "Sidebar"],
    }),

    deleteUserShelf: build.mutation<void, { uuid: string }>({
      query: ({ uuid }) => ({
        url: `/shelves/${uuid}`,
        method: "DELETE",
      }),
      invalidatesTags: ["UserShelves", "HomeShelves", "Sidebar"],
    }),

    listShelfBooks: build.query<
      BookWithRelations[],
      {
        shelfUuid: string
        limit?: number
        offset?: number
        orderBy?: ShelfOrderBy
        orderDirection?: "asc" | "desc"
      }
    >({
      query: ({ shelfUuid, ...params }) => {
        const searchParams = new URLSearchParams()

        if (params.limit) searchParams.set("limit", String(params.limit))
        if (params.offset) searchParams.set("offset", String(params.offset))
        if (params.orderBy) searchParams.set("orderBy", params.orderBy)
        if (params.orderDirection)
          searchParams.set("orderDirection", params.orderDirection)

        return `/shelves/${shelfUuid}/books?${searchParams.toString()}`
      },
    }),

    previewShelfFilter: build.mutation<
      BookWithRelations[],
      {
        filter: ShelfFilter
        orderBy?: string
        orderDirection?: "asc" | "desc"
        limit?: number
      }
    >({
      query: (body) => ({
        url: "/shelves/preview",
        method: "POST",
        body,
      }),
    }),
  }),
})

export const {
  useAddBooksToCollectionsMutation,
  useAddBooksToSeriesMutation,
  useAddTagsToBooksMutation,
  useCancelProcessingMutation,
  useGetScanStateQuery,
  useCreateBookMutation,
  useCreateCollectionMutation,
  useCreateInviteMutation,
  useClearBooksCacheMutation,
  useDeleteBookAssetsMutation,
  useDeleteBookMutation,
  useDeleteBooksMutation,
  useReplaceBookAssetMutation,
  useRemoveBookAssetMutation,
  useGetPositionQuery,
  useGetBookQuery,
  useUpdatePositionMutation,
  useDeleteCollectionMutation,
  useDeleteInviteMutation,
  useDeleteSeriesMutation,
  useDeleteUserMutation,
  useGetCurrentUserQuery,
  useGetGpuBuildWarningQuery,
  useGetMaxUploadChunkSizeQuery,
  useGetShelvesQuery,
  useLazyListCollectionsQuery,
  useLazyListCreatorsQuery,
  useLazyListSeriesQuery,
  useLazyListTagsQuery,
  useListAuthorsQuery,
  useListNarratorsQuery,
  useListTranslatorsQuery,
  useListCreatorsQuery,
  useListBooksQuery,
  useListInfiniteBooksInfiniteQuery,
  useListCollectionsQuery,
  useListInvitesQuery,
  useListSeriesQuery,
  useGetLibraryCountsQuery,
  useListStatusesQuery,
  useListTagsQuery,
  useListUsersQuery,
  useMergeBooksMutation,
  useProcessBookMutation,
  useTriggerBookScanMutation,
  useCancelScanMutation,
  useTriggerScanMutation,
  useScanBooksMutation,
  useRemoveBooksFromCollectionsMutation,
  useRemoveBooksFromSeriesMutation,
  useRemoveTagsFromBooksMutation,
  useResendInviteMutation,
  useUpdateBookMutation,
  useUpdateCollectionMutation,
  useUpdateReadingStatusMutation,
  useUpdateSeriesMutation,
  useUpdateSettingsMutation,
  useUpdateStatusMutation,
  useUpdateUserMutation,
  useGetChangelogQuery,
  useGetLatestVersionQuery,
  useUpgradeBookEpubMutation,
  useGetImportRulesQuery,
  useGetUserImportRulesQuery,
  useCreateImportRuleMutation,
  useUpdateImportRuleMutation,
  useDeleteImportRuleMutation,
  useDeleteImportRulesMutation,
  useGetBookRatingQuery,
  useSetBookRatingMutation,
  useDeleteBookRatingMutation,
  useListUserRatingsQuery,
  useGetHomeStatsQuery,
  useListHomeShelvesQuery,
  useSetHomeShelvesMutation,
  useAddHomeShelfMutation,
  useRemoveHomeShelfMutation,
  useListSidebarQuery,
  useSetSidebarMutation,
  useListSidebarGroupsQuery,
  useSetSidebarGroupsMutation,
  useToggleSidebarGroupCollapsedMutation,
  useListUserShelvesQuery,
  useCreateUserShelfMutation,
  useUpdateUserShelfMutation,
  useDeleteUserShelfMutation,
  useListShelfBooksQuery,
  usePreviewShelfFilterMutation,
  useGetUserSettingsQuery,
  useUpdateUserSettingsMutation,
  useSetUserSettingMutation,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useMergeTagsMutation,
  useUpdateCreatorMutation,
  useDeleteCreatorMutation,
  useMergeCreatorsMutation,
  useMergeSeriesMutation,
  useMergeCollectionsMutation,
} = api

export function getDownloadUrl(
  bookUuid: string,
  format: "readaloud" | "audiobook" | "ebook",
) {
  const searchParams = new URLSearchParams({ format })
  return `/api/v2/books/${bookUuid}/files?${searchParams.toString()}`
}

export function getCoverUrl(
  bookUuid: string,
  {
    height,
    width,
    updatedAt,
    audio = false,
  }: {
    height?: number
    width?: number
    audio?: boolean
    updatedAt: string | Date
  },
) {
  const searchParams = new URLSearchParams()
  if (audio) {
    searchParams.append("audio", "true")
  }
  if (height) {
    searchParams.append("h", height.toString())
  }
  if (width) {
    searchParams.append("w", width.toString())
  }
  return `/api/v2/books/${bookUuid}/cover?${searchParams.toString()}&v=${new Date(updatedAt).getTime()}`
}

export type MediaFilter = "all" | "ebook" | "audiobook" | "synced"

export type ListBooksQueryArg = {
  limit?: number | undefined
  orderBy?: "createdAt" | "updatedAt" | "title" | "publicationDate" | undefined
  orderDirection?: "asc" | "desc" | undefined
  search?: string | undefined
  collection?: string | undefined
  series?: string | undefined
  mediaFilter?: MediaFilter | undefined
  statusFilter?: string | undefined
}
