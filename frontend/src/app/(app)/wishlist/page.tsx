import type { Metadata } from 'next'
import { getWishlist } from '@/server/queries/wishlist'
import { WishlistBoard } from '@/client/components/wishlist/wishlist-board'

export const metadata: Metadata = {
  title: 'Wishlist',
  description: 'Places you want to reach, and what you would want out of each one.',
}

export const dynamic = 'force-dynamic'

export default async function WishlistPage() {
  const items = await getWishlist()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Somewhere you mean to get to, with the notes you will want when you finally book it.
        </p>
      </header>

      <WishlistBoard items={items} />
    </div>
  )
}
