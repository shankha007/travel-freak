import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { FormState } from '@/shared/validation/form-state'

/**
 * The hook's whole job is "once per submission, and never twice".
 *
 * Worth a test rather than a look in the browser, because the thing that would
 * go wrong is invisible: a toast that fires again on an unrelated re-render, or
 * one that stays silent because the state object looked unchanged. Both read as
 * normal until somebody is confused by them.
 *
 * `sonner` is mocked rather than mounted — a real toast is an animated element
 * that removes itself after four seconds, and asserting on that would be a test
 * about timers, not about this.
 */
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const { useActionToast } = await import('./use-action-toast')

function Harness({ state, success }: { state: FormState; success?: string }) {
  useActionToast(state, { success })
  return null
}

const SAVED: FormState = { error: null, saved: true }

beforeEach(() => {
  toast.success.mockClear()
  toast.error.mockClear()
})

describe('useActionToast', () => {
  it('says nothing on first render', () => {
    // A component mounting is not a submission. Announcing here would greet
    // anybody opening a screen with a result they never asked for.
    render(<Harness state={SAVED} success="Saved." />)

    expect(toast.success).not.toHaveBeenCalled()
  })

  it('announces a success once the action returns', () => {
    const { rerender } = render(<Harness state={{ error: null }} success="Saved." />)
    rerender(<Harness state={SAVED} success="Saved." />)

    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Saved.')
  })

  it('does not repeat on a re-render with the same result', () => {
    // `useActionState` hands back the same object until the action runs again,
    // so a parent re-rendering must not re-announce.
    const { rerender } = render(<Harness state={{ error: null }} success="Saved." />)
    rerender(<Harness state={SAVED} success="Saved." />)
    rerender(<Harness state={SAVED} success="Saved." />)

    expect(toast.success).toHaveBeenCalledOnce()
  })

  it('announces the same failure twice when it happens twice', () => {
    // Two fresh objects carrying identical text are two separate failures, and
    // the second is exactly when somebody needs telling. Comparing messages
    // rather than identity would swallow it.
    const { rerender } = render(<Harness state={{ error: null }} />)
    rerender(<Harness state={{ error: 'Could not save.' }} />)
    rerender(<Harness state={{ error: 'Could not save.' }} />)

    expect(toast.error).toHaveBeenCalledTimes(2)
  })

  it('reports the failure and not a success', () => {
    const { rerender } = render(<Harness state={{ error: null }} success="Saved." />)
    rerender(<Harness state={{ error: 'Nope.', saved: true }} success="Saved." />)

    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Nope.')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('stays silent on success when there is nothing to say', () => {
    // How the status picker is wired: the select already shows the new value,
    // so only its failures are worth a word.
    const { rerender } = render(<Harness state={{ error: null }} />)
    rerender(<Harness state={SAVED} />)

    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('useActionToast with errors suppressed', () => {
  function QuietHarness({ state }: { state: FormState }) {
    useActionToast(state, { success: 'Saved.', error: false })
    return null
  }

  it('leaves the error to the form that prints it', () => {
    const { rerender } = render(<QuietHarness state={{ error: null }} />)
    rerender(<QuietHarness state={{ error: 'Enter an amount.' }} />)

    expect(toast.error).not.toHaveBeenCalled()
  })

  it('still announces the success', () => {
    const { rerender } = render(<QuietHarness state={{ error: null }} />)
    rerender(<QuietHarness state={SAVED} />)

    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Saved.')
  })
})
