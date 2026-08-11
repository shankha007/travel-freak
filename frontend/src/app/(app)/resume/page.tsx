import type { Metadata } from 'next'
import { PlaceholderPage } from '@/client/components/placeholder-page'

export const metadata: Metadata = { title: 'Travel resume' }

export default function Page() {
  return <PlaceholderPage pathname="/resume" />
}
