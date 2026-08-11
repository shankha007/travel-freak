import { z } from 'zod'
import { VISIBILITIES } from '@/shared/validation/trip'

/**
 * Blog post input, shared by the studio and the Server Action.
 *
 * The studio autosaves, so this schema has to accept work in progress: an
 * untitled post mid-sentence is a normal state, not a validation failure. The
 * only hard limits are the ones the database or a page layout would break on.
 */

/** What an untitled draft is called, so `trim(title) > 0` always holds. */
export const UNTITLED = 'Untitled post'

export const MAX_CONTENT_BYTES = 200_000

export const blogPostSchema = z.object({
  /** Absent on the first save of a new post; present on every save after. */
  id: z.uuid().optional(),
  title: z
    .string()
    .trim()
    .max(160, { error: 'Keep the title under 160 characters' })
    // Empty is allowed and named rather than rejected: autosave must never fail
    // because the writer has not thought of a title yet.
    .transform((v) => v || UNTITLED),
  /** Rendered by the editor; sanitised server-side before it is stored. */
  contentHtml: z.string().max(MAX_CONTENT_BYTES, { error: 'This post is too long to save' }),
  /** Tiptap's document, kept so the editor reopens exactly as it was left. */
  contentJson: z.unknown().optional(),
  excerpt: z.string().trim().max(300, { error: 'Keep the excerpt under 300 characters' }),
  visibility: z.enum(VISIBILITIES),
  /** Optional link to the trip the post is about. '' means standalone. */
  tripId: z
    .string()
    .trim()
    .refine((v) => v === '' || z.uuid().safeParse(v).success, {
      error: 'Pick a trip from the list',
    })
    .transform((v) => (v === '' ? null : v)),
  seoTitle: z.string().trim().max(70, { error: 'Search engines cut titles off around 60' }),
  seoDescription: z
    .string()
    .trim()
    .max(160, { error: 'Search engines cut descriptions off around 155' }),
})

export type BlogPostInput = z.input<typeof blogPostSchema>
export type BlogPostValues = z.output<typeof blogPostSchema>

/** URL-safe slug from a title. Uniqueness is settled server-side. */
export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'post'
  )
}
