import type { Metadata } from "next"
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { WallpaperImageProvider } from "@/lib/wallpaper-context"
import { ClerkThemeProvider } from "@/components/clerk-theme-provider"
import { ScaleProvider } from "@/components/scale-provider"
import { NotificationProvider } from "@/lib/notifications"
import { TimezoneProvider } from "@/lib/timezone"
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
      <head>
        {/* Apply the user's saved wallpaper synchronously before React
            hydrates. We never force a default — if the user hasn't picked
            one, we render against pure black. The chosen image fades in
            once the browser has decoded it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var root=document.documentElement;
              // Always start from a clean black canvas so we never flash
              // an image the user didn't choose.
              root.style.setProperty("background","#000");
              try{
                var s=localStorage.getItem("ts_settings");
                if(!s)return;
                var settings=JSON.parse(s);
                var kind=settings && settings.wallpaper_kind;
                var url=settings && settings.wallpaper_url;
                if(!kind || kind==="none") return;
                var presets={
                  photo1:"https://images.unsplash.com/photo-1669295384050-a1d4357bd1d7?q=80&w=3270&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
                  photo2:"https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=2079&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
                  photo3:"https://plus.unsplash.com/premium_photo-1667587245819-2bea7a93e7a1?q=80&w=3270&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
                  photo4:"https://images.unsplash.com/photo-1776695799247-b15851a1aa2d?q=80&w=3283&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
                  photo5:"https://plus.unsplash.com/premium_photo-1732736767074-daf7bba30e81?q=80&w=2750&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                };
                var imageUrl=null;
                if(kind==="custom"&&url) imageUrl=url;
                else if(presets[kind]) imageUrl=presets[kind];
                if(!imageUrl) return;
                // Preload — only attach as the wallpaper once decoded so it
                // fades in from black instead of painting half-loaded.
                var img=new Image();
                img.onload=function(){
                  root.style.setProperty("--ts-wallpaper-image","url("+JSON.stringify(imageUrl)+") center/cover no-repeat fixed");
                  root.setAttribute("data-wallpaper","1");
                  root.classList.add("ts-wallpaper-loaded");
                };
                img.src=imageUrl;
              }catch(e){}
            })();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider defaultTheme="dark">
          <ClerkThemeProvider>
            <ScaleProvider>
              <TimezoneProvider>
                <NotificationProvider>
                  <WallpaperImageProvider>
                    {children}
                  </WallpaperImageProvider>
                </NotificationProvider>
              </TimezoneProvider>
            </ScaleProvider>
            <Toaster position="bottom-right" />
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
