// @ts-check

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { locales } from "./src/i18n/locales"

import createNextIntlPlugin from "next-intl/plugin"

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
)

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

const nextConfig: import("next").NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
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
  outputFileTracingRoot: resolve(new URL(import.meta.url).pathname, "../.."),
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
    authInterrupts: true,
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      config.devtool = "source-map"
    }

    return config
  },
}

export default withNextIntl(nextConfig)
