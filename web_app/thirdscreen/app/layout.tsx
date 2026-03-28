import type { Metadata } from "next"
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ClerkThemeProvider } from "@/components/clerk-theme-provider"
import { ScaleProvider } from "@/components/scale-provider"
import { NotificationProvider } from "@/lib/notifications"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Third Screen",
  description: "A glanceable personal dashboard",
  icons: {
    icon: "/logo-128.png",
    apple: "/logo-128.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        inter.variable,
        spaceGrotesk.variable,
        jetbrainsMono.variable,
        "font-sans"
      )}
    >
      <body>
        <ThemeProvider defaultTheme="dark">
          <ClerkThemeProvider>
            <ScaleProvider>
              <NotificationProvider>
                  {children}
              </NotificationProvider>
            </ScaleProvider>
            <Toaster position="bottom-right" />
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
