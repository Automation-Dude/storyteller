import type { Metadata, Viewport } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getTranslations } from "next-intl/server"
import { IBM_Plex_Serif, Inter, Young_Serif } from "next/font/google"
import Script from "next/script"
import { NuqsAdapter } from "nuqs/adapters/next"

import StoreProvider from "@/components/StoreProvider"
import { AudioProviderRedux } from "@/components/reader/AudioProviderRedux"
import { PiPProvider } from "@/components/reader/PipProvider"
import { env } from "@/env"

import { ThemeProvider } from "@v3/_/components/theme-provider"
import { Toaster } from "@v3/_/components/ui/sonner"

import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const youngSerif = Young_Serif({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-young-serif",
})

const trySerif = IBM_Plex_Serif({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
  variable: "--font-try-serif",
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Layout")
  return {
    title: {
      template: `%s | ${t("title")}`,
      default: t("title"),
    },
    description: t("description"),
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const dynamic = "force-dynamic"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${youngSerif.variable} ${trySerif.variable}`}
    >
      <head>
        {env.NODE_ENV === "development" && env.ENABLE_REACT_SCAN && (
          <Script
            src="//unpkg.com/react-scan/dist/auto.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body suppressHydrationWarning>
        {!env.ENABLE_V3_FRONTEND ? (
          <div>V3 frontend is not enabled</div>
        ) : (
          <NextIntlClientProvider>
            <StoreProvider>
              <AudioProviderRedux>
                <PiPProvider>
                  <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                  >
                    <NuqsAdapter>
                      {children}
                      <Toaster />
                    </NuqsAdapter>
                  </ThemeProvider>
                </PiPProvider>
              </AudioProviderRedux>
            </StoreProvider>
          </NextIntlClientProvider>
        )}
      </body>
    </html>
  )
}
