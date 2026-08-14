'use client'

import { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { MotionConfig } from 'framer-motion'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DURATION, EASE_OUT } from '@/shared/motion'
import { TooltipProvider } from '@/client/components/ui/tooltip'
import { Toaster } from '@/client/components/ui/sonner'
import { THEME_IDS, THEME_VALUES } from '@/shared/themes'

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state so each browser session gets one client, and it is never
  // shared across requests on the server.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // The palettes beyond light and dark. `value` maps each id to the single
      // class that selects its block in globals.css — next-themes puts exactly
      // one class on <html>, which is why a dark palette carries its own copy of
      // the dark variables rather than relying on `.dark` being there too.
      themes={THEME_IDS}
      value={THEME_VALUES}
    >
      <QueryClientProvider client={queryClient}>
        {/*
          `reducedMotion="user"` is the whole accessibility story for animation:
          every motion component below drops its transforms — and keeps its
          fades, which do not trigger vestibular symptoms — when the operating
          system asks for reduced motion. Doing it here means no individual
          component has to remember, and none of them can forget.

          The transition is the app-wide default, so a component that animates
          without stating one still moves like the rest of the product.
        */}
        <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE_OUT }}>
          <TooltipProvider delay={200}>
            {children}
            <Toaster richColors closeButton />
          </TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
