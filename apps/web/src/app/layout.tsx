import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Blink — Real-time Messaging",
    template: "%s | Blink",
  },
  description:
    "Blink is a fast, secure real-time messaging app. Send text, voice, media, and files with instant delivery, read receipts, and group conversations.",
  keywords: [
    "messaging",
    "chat",
    "real-time",
    "instant messaging",
    "voice messages",
    "group chat",
    "file sharing",
    "secure messaging",
  ],
  authors: [{ name: "Blink" }],
  creator: "Blink",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Blink",
    title: "Blink — Real-time Messaging",
    description:
      "Fast, secure real-time messaging. Send text, voice, media, and files with instant delivery.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Blink — Real-time Messaging",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blink — Real-time Messaging",
    description:
      "Fast, secure real-time messaging. Send text, voice, media, and files with instant delivery.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#00a884",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="h-dvh overflow-hidden antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
