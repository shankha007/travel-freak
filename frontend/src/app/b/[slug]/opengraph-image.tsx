import { ImageResponse } from 'next/og'
import { getBlogPost } from '@/server/queries/blog'
import { BRAND } from '@/shared/brand'
import { OG_CONTENT_TYPE, OG_SIZE, countLabel, factLine } from '@/shared/og'
import { Card } from '@/server/og/card'

/**
 * A published post's share card — screen 38.
 *
 * No map on this one. A post is a piece of writing rather than a place, and the
 * countries of the trip it links to are not what it is about — the headline is,
 * which is why it gets the whole card.
 *
 * `getBlogPost` reads through the visitor's client, so a draft or a private
 * post returns nothing here even though its author can open the page. An
 * unlisted post is deliberately included: its URL is already the secret, and a
 * link pasted into a chat with no preview is the case this whole screen exists
 * to fix. The page itself still carries `noindex` for those.
 */
export const alt = 'A post'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post || !post.publishedAt) {
    return new ImageResponse(
      <Card
        eyebrow="Travel, mapped"
        title="Every place you have been, on one globe."
        subtitle={BRAND.description}
        footnote={BRAND.domain}
      />,
      size
    )
  }

  const subtitle = factLine([
    post.author?.displayName && `By ${post.author.displayName}`,
    countLabel(post.readingMinutes, 'minute read', 'minute read'),
    post.trip?.title,
  ])

  return new ImageResponse(
    <Card
      eyebrow="Journal"
      title={post.seoTitle || post.title}
      subtitle={subtitle || post.excerpt}
      footnote={BRAND.domain}
    />,
    size
  )
}
