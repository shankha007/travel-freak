'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/server/supabase/server'

/**
 * Auth Server Actions.
 *
 * Credentials are validated with the same Zod schema the form uses, so a
 * hand-crafted POST cannot skip the checks the UI performs.
 */

const credentials = z.object({
  email: z.email({ error: 'Enter a valid email address' }),
  password: z.string().min(6, { error: 'Password must be at least 6 characters' }),
})

export interface AuthFormState {
  error: string | null
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details and try again.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" tells an attacker which emails are registered.
    return { error: 'Those credentials did not work. Please try again.' }
  }

  // `next` is validated as a relative path — an open redirect here would let a
  // phishing link bounce users to an attacker's domain post-login.
  const raw = formData.get('next')
  const next =
    typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
