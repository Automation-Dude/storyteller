import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import createNextIntlPlugin from "next-intl/plugin"

import { locales } from "./src/i18n/locales"
import { V3_ROOTS } from "./src/v3Routes"

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as Record<string, unknown>

const withNextIntl = createNextIntlPlugin({
  experimental: {
    // this allows next-intl to generate typescript declarations for the messages
    // so that stuff like hello: `Hello {name}`  -> t('Hello') throws an error if you try to use it without the {name}
    createMessagesDeclaration: ["./messages/en.json", "./messages/nl.json"],

    // saves some bundle size by precompiling more complex messages
    messages: {
      path: "./messages",
      format: "json",
      precompile: true,
      locales: Object.keys(locales),
    },
  },
  // extract: {
  //   sourceLocale: "./messages/en.json",
  // },
  // },
})

// opting into the old ui sets this cookie; every v3 rewrite is skipped while
// it is present so the v2 pages resolve from the filesystem instead
const unlessV2Cookie = [
  { type: "cookie" as const, key: "frontend-version", value: "v2" },
]

const nextConfig: import("next").NextConfig = {
  redirects: () => [
    {
      source: "/opds",
      destination: "/opds/v1",
      permanent: true,
    },
  ],
  rewrites: () => ({
    beforeFiles: [
      { source: "/", missing: unlessV2Cookie, destination: "/v3" },
      ...V3_ROOTS.filter((root) => root !== "books").map((root) => ({
        source: `/${root}/:path*`,
        missing: unlessV2Cookie,
        destination: `/v3/${root}/:path*`,
      })),
      { source: "/books", missing: unlessV2Cookie, destination: "/v3/books" },
      {
        source: "/books/:path((?![^/]+/read$).+)",
        missing: unlessV2Cookie,
        destination: "/v3/books/:path",
      },
    ],
  }),
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg["version"] as string,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@storyteller-platform/epub",
    "@storyteller-platform/fs",
    "@storyteller-platform/path",
    "@storyteller-platform/audiobook",
    "@t3-oss/env-nextjs",
    "@t3-oss/env-core",
  ],
  serverExternalPackages: [
    "piscina",
    "@mapbox/node-pre-gyp",
    "pino",
    "pino-pretty",
    "onnxruntime-node",
    "@node-rs/crc32",
    "@node-rs/xxhash",
    "@parcel/watcher",
    "@reflink/reflink",
    "@storyteller-platform/okmain",
  ],
  output: "standalone",
  outputFileTracingRoot: resolve(new URL(import.meta.url).pathname, "../../.."),
  // test fixtures otherwise get traced into the standalone output (~740 MB)
  outputFileTracingExcludes: {
    "*": ["./applications/web/src/__fixtures__/**"],
  },
  reactCompiler: true,
  productionBrowserSourceMaps: true,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
    authInterrupts: true,
    turbopackSourceMaps: true,
  },
  webpack: (config: Record<string, unknown>, { isServer, dev }) => {
    if (isServer && !dev) {
      config["devtool"] = "source-map"
    }

    return config
  },
}

export default withNextIntl(nextConfig)
