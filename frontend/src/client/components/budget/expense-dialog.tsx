'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { saveExpense } from '@/server/actions/budget'
import type { ExpenseRow } from '@/server/queries/budget'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL } from '@/shared/budget'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'
import { Button } from '@/client/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : editing ? 'Save changes' : 'Record it'}
    </Button>
  )
}

/**
 * One spend — screen 22.
 *
 * The amount is the only thing required. A receipt nobody has labelled is still
 * money that left, and a form that refuses it until you name it is a form
 * people abandon halfway through a trip.
 *
 * Recording an expense is free on every plan. `budget_full` gates the category
 * breakdown, not the ability to write down what you spent.
 */
export function ExpenseDialog({
  tripId,
  expense,
  currency,
  open,
  onOpenChange,
}: {
  tripId: string
  /** The row being edited, or null when adding. */
  expense: ExpenseRow | null
  /** The trip's currency, as the default for a new spend. */
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(saveExpense, EMPTY_FORM_STATE)
  const editing = expense !== null

  useEffect(() => {
    if (!state.saved) return
    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router])

  const err = (field: string) => state.fieldErrors?.[field]

  const rejected = state.values
  const initial = {
    category: rejected?.category ?? expense?.category ?? 'misc',
    title: rejected?.title ?? expense?.title ?? '',
    amount: rejected?.amount ?? expense?.amount?.toString() ?? '',
    currency: rejected?.currency ?? expense?.currency ?? currency,
    spentAt: rejected?.spentAt ?? expense?.spentAt ?? '',
    paidBy: rejected?.paidBy ?? expense?.paidBy ?? '',
    notes: rejected?.notes ?? expense?.notes ?? '',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit this expense' : 'Record what you spent'}</DialogTitle>
          <DialogDescription>
            The amount is the only thing needed. Everything else makes it easier to read back later.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="id" value={expense.id} />}
          <input type="hidden" name="tripId" value={tripId} />

          <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
            <div className="space-y-2">
              <Label htmlFor="amount">How much</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                defaultValue={initial.amount}
                required
                aria-describedby={err('amount') ? 'amount-error' : undefined}
              />
              {err('amount') && (
                <p id="amount-error" role="alert" className="text-sm text-destructive">
                  {err('amount')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseCurrency">Currency</Label>
              <Input
                id="expenseCurrency"
                name="currency"
                defaultValue={initial.currency}
                maxLength={3}
                className="uppercase"
                aria-describedby={err('currency') ? 'currency-error' : undefined}
              />
              {err('currency') && (
                <p id="currency-error" role="alert" className="text-sm text-destructive">
                  {err('currency')}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expenseCategory">Category</Label>
              {/* Keyed: React applies a select's `defaultValue` on mount only,
                  so a re-seeded value after a reset would be ignored. */}
              <select
                key={initial.category}
                id="expenseCategory"
                name="category"
                defaultValue={initial.category}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {EXPENSE_CATEGORY_LABEL[category]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="spentAt">When</Label>
              <Input
                id="spentAt"
                name="spentAt"
                type="date"
                defaultValue={initial.spentAt}
                aria-describedby={err('spentAt') ? 'spent-at-error' : undefined}
              />
              {err('spentAt') && (
                <p id="spent-at-error" role="alert" className="text-sm text-destructive">
                  {err('spentAt')}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expenseTitle">What for</Label>
              <Input
                id="expenseTitle"
                name="title"
                defaultValue={initial.title}
                placeholder="Optional — “Night bus to Manali”"
                maxLength={160}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paidBy">Paid by</Label>
              <Input
                id="paidBy"
                name="paidBy"
                defaultValue={initial.paidBy}
                placeholder="Optional"
                maxLength={80}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expenseNotes">Notes</Label>
            <Textarea
              id="expenseNotes"
              name="notes"
              defaultValue={initial.notes}
              rows={2}
              maxLength={2000}
            />
          </div>

          {state.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SaveButton editing={editing} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
