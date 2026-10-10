import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { PlayerSync } from "@/components/providers/player-sync";
import { SiteHeader } from "@/components/nav/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * Display face (UI_REDESIGN §1.2) — headlines only. `wght` is the default axis and
 * must not be listed; `opsz`/`SOFT`/`WONK` are the extra ones the `.font-display`
 * utility in globals.css pins with `font-variation-settings`.
 */
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Abay Chess", template: "%s · Abay Chess" },
  description: "Online 3D chess platform with real-time matchmaking, an AI opponent, and custom rooms. Play, compete, grow.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://chess-3d-ai-clerk-game.vercel.app"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Abay Chess",
    description: "Online 3D chess platform with real-time matchmaking, an AI opponent, and custom rooms. Play, compete, grow.",
    siteName: "Abay Chess",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Abay Chess",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Abay Chess",
    description: "Online 3D chess platform with real-time matchmaking, an AI opponent, and custom rooms. Play, compete, grow.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Abay Chess",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#151916" },
  ],
};

/**
 * The Clerk card headings name the CLERK APPLICATION, which is not this product's name.
 * Overriding them here is the only way to say "Abay Chess" on the auth screens without a
 * dashboard change — and the copy voice of UI_REDESIGN §2 applies to them like anything
 * else: sentence case, plain verbs, no exclamation marks.
 */
const CLERK_COPY = {
  signIn: {
    start: {
      title: "Sign in to Abay Chess",
      subtitle: "Welcome back to the board. Pick up where you left off.",
    },
  },
  signUp: {
    start: {
      title: "Create your Abay Chess account",
      subtitle: "Join the community, build your rating, and compete in chess.",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground">
        {/* Provider order is mandatory: Clerk must wrap Convex so
            ConvexProviderWithClerk can read the Clerk context. */}
        <ClerkProvider
          afterSignOutUrl="/"
          signInFallbackRedirectUrl="/play"
          signUpFallbackRedirectUrl="/play"
          localization={CLERK_COPY}
        >
          <ConvexClientProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
              <TooltipProvider>
                <PlayerSync />
                <SiteHeader />
                <main className="w-full min-w-0">{children}</main>
                <Toaster position="top-center" richColors />
              </TooltipProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
