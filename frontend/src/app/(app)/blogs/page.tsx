import type { Metadata } from 'next'
import { PlaceholderPage } from '@/client/components/placeholder-page'

export const metadata: Metadata = { title: 'Blogs' }

export default function Page() {
  return <PlaceholderPage pathname="/blogs" />
}
