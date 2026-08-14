'use server'

import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/server/supabase/server'
import { requireUser } from '@/server/auth'
import { purgeBucket } from '@/server/account/purge'

/**
 * Account deletion — screen 44, and a legal requirement under both the GDPR and
 * India's DPDP Act rather than a courtesy.
 *
 * The order matters and is the whole design:
 *
 *  1. Prove it is them, by password. A settings page left open on a borrowed
 *     laptop should not be enough to destroy someone's decade of photographs.
 *  2. Remove the files, while the account still exists. Storage does not
 *     cascade — it is not the database — so if the auth row went first the
 *     objects would be orphaned under a user id nothing points at any more,
 *     and nothing would ever come back for them.
 *  3. Delete the `auth.users` row. Every table keys on `user_id` with
 *     `on delete cascade`, so that one statement takes the profile, the trips,
 *     the places, the media rows, the posts, the wishlist and the aggregates
 *     with it. The pgTAP suite asserts exactly that, because a cascade that
 *     quietly stops working leaves rows behind that nobody would think to look
 *     for.
 *  4. Sign out, so the browser is not holding a token for a user that no
 *     longer exists.
 */

export interface DeleteAccountState {
  error: string | null
  fieldErrors?: Record<string, string>
}

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const user = await requireUser()

  const confirm = String(formData.get('confirm') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')

  // Typing your own username is the deliberate friction. It cannot be done by
  // a mis-click, and unlike a checkbox it requires having read the sentence
  // above it.
  if (confirm !== user.username.toLowerCase()) {
    return {
      error: 'That does not match your username.',
      fieldErrors: { confirm: `Type ${user.username} exactly` },
    }
  }

  if (!password) {
    return {
      error: 'Enter your password to confirm.',
      fieldErrors: { password: 'Your password is required' },
    }
  }

  const supabase = await createClient()
  const { error: wrongPassword } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })

  if (wrongPassword) {
    return {
      error: 'That password is not right.',
      fieldErrors: { password: 'This does not match your password' },
    }
  }

  const admin = createAdminClient()

  // Both buckets, before the account goes. Failures are collected rather than
  // thrown: a file that will not delete is a problem worth knowing about, and
  // it is not a reason to refuse someone the deletion they asked for.
  const purges = await Promise.all([
    purgeBucket(admin.storage.from('media'), user.id),
    purgeBucket(admin.storage.from('media-public'), user.id),
  ])

  const storageErrors = purges.flatMap((p) => p.errors)
  if (storageErrors.length > 0) {
    console.error('account deletion: storage purge incomplete', {
      userId: user.id,
      errors: storageErrors,
    })
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    // Deliberately not "nothing has been removed": the files are already gone
    // by this point, and telling someone their data is intact when it is not
    // is the one thing a deletion flow must never do. Everything destroyed so
    // far is something they asked to have destroyed, which is why the purge
    // goes first — a failure here costs a retry, not an unwanted deletion.
    return {
      error:
        'Your files have been removed, but the account itself could not be deleted. Try again — the second attempt finishes the job.',
    }
  }

  await supabase.auth.signOut()

  // Outside the try/catch shape above on purpose: redirect() works by throwing.
  redirect('/?deleted=1')
}
