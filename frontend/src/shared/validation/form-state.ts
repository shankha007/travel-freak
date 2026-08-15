import type { z } from 'zod'

/**
 * What a Server Action hands back to the form that called it.
 *
 * The planner screens — 21, 22 and 23 — are a dozen small dialogs over five
 * tables, and every one of them needs the same four things: a sentence when
 * something went wrong, the per-field version of it, a flag saying the dialog
 * may close, and the rejected submission.
 *
 * That last one is not decoration. React resets an uncontrolled form once its
 * action returns, so a failure without it means being told the end time is
 * before the start *and* losing everything else typed. The wishlist dialog
 * learned this first; this is the same fix, shared.
 */
export interface FormState {
  error: string | null
  fieldErrors?: Record<string, string>
  /** Set on the way out, so a dialog knows it succeeded. */
  saved?: boolean
  /** The submission as typed, keyed by field name. */
  values?: Record<string, string>
}

/** The starting state, before anything has been submitted. */
export const EMPTY_FORM_STATE: FormState = { error: null }

/**
 * Reads named fields off a `FormData` as plain strings.
 *
 * Everything arrives as a string or a `File`; anything that is not a string
 * becomes an empty one, so the schema sees a consistent shape and reports a
 * missing field rather than a type nobody submitted on purpose.
 */
export function textFields(formData: FormData, ...keys: string[]): Record<string, string> {
  const values: Record<string, string> = {}
  for (const key of keys) {
    const value = formData.get(key)
    values[key] = typeof value === 'string' ? value : ''
  }
  return values
}

/**
 * Zod issues, flattened to one message per field.
 *
 * First issue wins: a field with three problems gets the first, because a form
 * that stacks three sentences under one input is read as none.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    fieldErrors[key] ??= issue.message
  }
  return fieldErrors
}
