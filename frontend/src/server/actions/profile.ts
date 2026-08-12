'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'

/**
 * Profile Server Actions.
 *
 * Only what the resume needs to be shareable. The full profile screen (39) is
 * still a stub, so this deliberately covers the one setting that decides
 * whether a public URL exists at all.
 */

export interface ProfileActionResult {
  ok: boolean
  error?: string
  isPublic?: boolean
}

/**
 * Publishes or unpublishes the profile.
 *
 * This is the switch behind `/u/[username]`: with it off, the RLS policy
 * `profiles_select_public` stops matching and the page 404s for everyone but
 * the owner — as do the visited regions the public globe reads. Individual
 * trips and posts keep their own visibility; this does not override them.
 */
export async function setProfileVisibility(isPublic: boolean): Promise<ProfileActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_public: isPublic })
    .eq('id', user.id)
    .select('username, is_public')
    .maybeSingle()

  if (error) {
    return { ok: false, error: `Could not update your profile: ${error.message}` }
  }
  if (!data) {
    return { ok: false, error: 'Your profile could not be found.' }
  }

  revalidatePath('/resume')
  revalidatePath(`/u/${data.username}`)
  return { ok: true, isPublic: data.is_public }
}

const detailsInput = z.object({
  displayName: z.string().trim().max(80, { error: 'Keep it under 80 characters' }),
  bio: z.string().trim().max(300, { error: 'Keep the bio under 300 characters' }),
})

/** The two fields a public profile is nothing without. */
export async function updateProfileDetails(
  input: z.input<typeof detailsInput>
): Promise<ProfileActionResult> {
  const user = await requireUser()

  const parsed = detailsInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check those details.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.displayName, bio: parsed.data.bio })
    .eq('id', user.id)
    .select('username')
    .maybeSingle()

  if (error) {
    return { ok: false, error: `Could not save: ${error.message}` }
  }
  if (!data) {
    return { ok: false, error: 'Your profile could not be found.' }
  }

  revalidatePath('/resume')
  revalidatePath(`/u/${data.username}`)
  return { ok: true }
}
