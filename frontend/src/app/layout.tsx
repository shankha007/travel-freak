import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { BRAND, SITE_URL, pageTitle } from '@/shared/brand'
import { Providers } from '@/client/providers'
import './globals.css'

// Exposed as --font-sans / --font-mono to match the @theme mapping in globals.css.
const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: pageTitle(),
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: pageTitle(),
    description: BRAND.description,
  },
  twitter: {
    card: 'summary_large_image',
    site: BRAND.social.x,
  },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning is required by next-themes, which sets the theme
    // class on <html> before React hydrates to avoid a flash of the wrong theme.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Anything wrapped in `Reveal` ships as `opacity: 0` in the server HTML
          and is uncovered by JavaScript when it scrolls into view. With
          JavaScript off that second half never happens, so the page would be
          blank rather than un-animated. This pins it back to visible — the only
          rule in the app that has to live outside globals.css, because a
          `<noscript>` stylesheet cannot be expressed in a class.
        */}
        <noscript>
          <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
