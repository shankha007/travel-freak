'use client'

import { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
        <TooltipProvider delay={200}>
          {children}
          <Toaster richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
