'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Loader2, Lock, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { deleteExpense, setPlannedBudget } from '@/server/actions/budget'
import type { BudgetData, ExpenseRow } from '@/server/queries/budget'
import { budgetVerdict, categoryLabel, formatMoney, type CurrencyBudget } from '@/shared/budget'
import { planVariance } from '@/shared/itinerary'
import { EMPTY_FORM_STATE } from '@/shared/validation/form-state'
import { useActionToast } from '@/client/hooks/use-action-toast'
import { CategoryChart } from '@/client/components/budget/category-chart'
import { ExpenseDialog } from '@/client/components/budget/expense-dialog'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card'
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
import { Progress } from '@/client/components/ui/progress'

/**
 * The budget planner — screen 22.
 *
 * One panel per currency, because there is no exchange rate in this codebase
 * and there should not be one: a trip billed partly in rupees and partly in yen
 * has two budgets, and the screen says so rather than adding numbers that do
 * not add.
 *
 * The plan is `trips.budget_planned`, the same field the trip form and the
 * analytics screen read, so a budget set here is a budget everywhere.
 */

const VERDICT_TEXT: Record<string, string> = {
  under: 'text-muted-foreground',
  close: 'text-amber-600 dark:text-amber-500',
  over: 'text-destructive',
  unplanned: 'text-muted-foreground',
}

export function BudgetView({ budget }: { budget: BudgetData }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [removing, setRemoving] = useState<ExpenseRow | null>(null)
  const [editingPlan, setEditingPlan] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {budget.summary.count === 0
            ? 'Nothing recorded yet.'
            : `${budget.summary.count} ${
                budget.summary.count === 1 ? 'expense' : 'expenses'
              } recorded.`}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditingPlan(true)}>
            <Wallet className="size-4" aria-hidden />
            {budget.budgetPlanned === null ? 'Set a budget' : 'Edit the budget'}
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            Record a spend
          </Button>
        </div>
      </div>

      {budget.summary.currencies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <Wallet className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">What is this trip going to cost?</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Set what you mean to spend, then record what you actually do. Both are free on every
              plan, and nothing here is ever converted between currencies — a trip in two currencies
              gets two totals.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => setEditingPlan(true)}>
              Set a budget
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden />
              Record a spend
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {budget.summary.currencies.map((currencyBudget) => (
            <CurrencyPanel
              key={currencyBudget.currency}
              budget={currencyBudget}
              full={budget.full}
              plannedCurrency={budget.currency}
            />
          ))}
        </div>
      )}

      {budget.summary.hasUnplannedCurrency && (
        <p className="text-sm text-muted-foreground">
          Some of this trip was paid for in a currency the budget is not in. Those totals stand on
          their own — converting them would need an exchange rate this app does not have and would
          not want to guess.
        </p>
      )}

      {budget.itineraryPlanned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What the itinerary expects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {budget.itineraryPlanned.map((total) => (
              <p key={total.currency} className="font-medium tabular-nums">
                {formatMoney(total.total, total.currency)}
              </p>
            ))}
            <p className="text-sm text-muted-foreground">
              Added up from the costs on your{' '}
              <Link
                href={`/trips/${budget.tripId}/itinerary`}
                className="underline underline-offset-2"
              >
                itinerary
              </Link>
              . A third number, and a different one: what the plan says it will cost, rather than
              what you budgeted or what has actually gone.
            </p>
          </CardContent>
        </Card>
      )}

      {budget.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Everything recorded</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {budget.expenses.map((expense) => (
                <li key={expense.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-medium">
                      {expense.title || categoryLabel(expense.category)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabel(expense.category)}
                      {expense.spentAt && (
                        <>
                          {' · '}
                          <time dateTime={expense.spentAt}>
                            {new Date(`${expense.spentAt}T00:00:00`).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </time>
                        </>
                      )}
                      {expense.paidBy && ` · paid by ${expense.paidBy}`}
                    </p>
                    {expense.notes && (
                      <p className="text-sm text-muted-foreground">{expense.notes}</p>
                    )}
                    <FromPlanLine expense={expense} tripId={budget.tripId} />
                  </div>

                  <span className="shrink-0 font-medium tabular-nums">
                    {formatMoney(expense.amount, expense.currency)}
                  </span>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${expense.title || categoryLabel(expense.category)}`}
                      onClick={() => setEditing(expense)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${expense.title || categoryLabel(expense.category)}`}
                      onClick={() => setRemoving(expense)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Keyed by the row so the uncontrolled inputs remount with its values. */}
      <ExpenseDialog
        key={editing?.id ?? 'new-expense'}
        tripId={budget.tripId}
        expense={editing}
        currency={budget.currency}
        open={adding || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false)
            setEditing(null)
          }
        }}
      />

      <PlanDialog
        key={`${budget.budgetPlanned ?? 'none'}-${budget.currency}`}
        tripId={budget.tripId}
        planned={budget.budgetPlanned}
        currency={budget.currency}
        open={editingPlan}
        onOpenChange={setEditingPlan}
      />

      <RemoveExpenseDialog
        expense={removing}
        tripId={budget.tripId}
        onClose={() => setRemoving(null)}
      />
    </div>
  )
}

function CurrencyPanel({
  budget,
  full,
  plannedCurrency,
}: {
  budget: CurrencyBudget
  full: boolean
  plannedCurrency: string
}) {
  const verdict = budgetVerdict(budget)
  const isPlanned = budget.currency === plannedCurrency.toUpperCase()

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">
          {budget.currency}
          {!isPlanned && (
            <Badge variant="outline" className="ml-2 font-normal">
              Not the budget currency
            </Badge>
          )}
        </CardTitle>
        <span className={`text-sm ${VERDICT_TEXT[verdict]}`}>
          {verdict === 'unplanned'
            ? 'No budget set for this currency'
            : verdict === 'over'
              ? `${budget.usedPercent}% of the budget — over by ${formatMoney(
                  Math.abs(budget.remaining ?? 0),
                  budget.currency
                )}`
              : `${budget.usedPercent}% of the budget`}
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Planned</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {budget.planned === null ? '—' : formatMoney(budget.planned, budget.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">Spent</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatMoney(budget.spent, budget.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground uppercase">
              {budget.remaining !== null && budget.remaining < 0 ? 'Over by' : 'Left'}
            </dt>
            <dd className={`text-lg font-semibold tabular-nums ${VERDICT_TEXT[verdict]}`}>
              {budget.remaining === null
                ? '—'
                : formatMoney(Math.abs(budget.remaining), budget.currency)}
            </dd>
          </div>
        </dl>

        {/* Capped at 100 so the bar stays a bar; the sentence above carries the
            real figure when it is past the plan. */}
        {budget.usedPercent !== null && <Progress value={Math.min(100, budget.usedPercent)} />}

        {full ? (
          budget.categories.length > 0 && (
            <CategoryChart categories={budget.categories} currency={budget.currency} />
          )
        ) : (
          <p className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              The category breakdown comes with the paid plans. Totals, the budget and every expense
              you record are free —{' '}
              <Link href="/upgrade" className="underline underline-offset-2">
                what that changes
              </Link>
              .
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Saving…' : label}
    </Button>
  )
}

/**
 * What the trip was meant to cost.
 *
 * Blank clears it, and clearing is not the same as budgeting zero — the copy
 * says so, because the two produce visibly different screens.
 */
function PlanDialog({
  tripId,
  planned,
  currency,
  open,
  onOpenChange,
}: {
  tripId: string
  planned: number | null
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(setPlannedBudget, EMPTY_FORM_STATE)
  useActionToast(state, { success: 'Budget saved.', error: false })

  useEffect(() => {
    if (!state.saved) return
    onOpenChange(false)
    router.refresh()
  }, [state, onOpenChange, router])

  const err = (field: string) => state.fieldErrors?.[field]
  const rejected = state.values

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>What is this trip meant to cost?</DialogTitle>
          <DialogDescription>
            This is the trip&rsquo;s planned budget — the same one the trip page and analytics show.
            Leave it blank to have no budget, which is different from a budget of zero.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tripId" value={tripId} />

          <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
            <div className="space-y-2">
              <Label htmlFor="budgetPlanned">Budget</Label>
              <Input
                id="budgetPlanned"
                name="budgetPlanned"
                type="number"
                min={0}
                step={1000}
                inputMode="decimal"
                defaultValue={rejected?.budgetPlanned ?? planned?.toString() ?? ''}
                placeholder="Leave blank for none"
                aria-describedby={err('budgetPlanned') ? 'planned-error' : undefined}
              />
              {err('budgetPlanned') && (
                <p id="planned-error" role="alert" className="text-sm text-destructive">
                  {err('budgetPlanned')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="planCurrency">Currency</Label>
              <Input
                id="planCurrency"
                name="currency"
                defaultValue={rejected?.currency ?? currency}
                maxLength={3}
                className="uppercase"
                aria-describedby={err('currency') ? 'plan-currency-error' : undefined}
              />
              {err('currency') && (
                <p id="plan-currency-error" role="alert" className="text-sm text-destructive">
                  {err('currency')}
                </p>
              )}
            </div>
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
            <SaveButton label="Save the budget" />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * "This came from the itinerary", and what the plan had said it would cost.
 *
 * The pair is the whole point of the link — a hotel planned at ₹8,000 and paid
 * at ₹9,240 is the sentence neither screen could say before. The difference is
 * omitted when the two are in different currencies, for the reason every total
 * here gives: there is no exchange rate, so the two amounts are two facts.
 *
 * Links to the itinerary rather than naming the day, because the entry may have
 * been dragged to another one since — the link stays right and a remembered day
 * number would not.
 */
function FromPlanLine({ expense, tripId }: { expense: ExpenseRow; tripId: string }) {
  if (!expense.fromPlan) return null

  const variance = planVariance(expense.fromPlan, expense)

  return (
    <p className="text-xs text-muted-foreground">
      <Link href={`/trips/${tripId}/itinerary`} className="underline underline-offset-2">
        From the itinerary
      </Link>
      {expense.fromPlan.cost !== null && (
        <>
          {' · planned at '}
          <span className="tabular-nums">
            {formatMoney(expense.fromPlan.cost, expense.fromPlan.currency)}
          </span>
          {variance && variance.difference !== 0 && (
            <span className={variance.difference > 0 ? 'text-destructive' : undefined}>
              {variance.difference > 0 ? ' · over by ' : ' · under by '}
              <span className="tabular-nums">
                {formatMoney(Math.abs(variance.difference), variance.currency)}
              </span>
            </span>
          )}
        </>
      )}
    </p>
  )
}

function RemoveSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? 'Removing…' : 'Remove it'}
    </Button>
  )
}

function RemoveExpenseDialog({
  expense,
  tripId,
  onClose,
}: {
  expense: ExpenseRow | null
  tripId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(deleteExpense, EMPTY_FORM_STATE)
  // The dialog closes on success, so the toast is what says it actually went.
  useActionToast(state, { success: 'Expense removed.' })

  useEffect(() => {
    if (!state.saved) return
    onClose()
    router.refresh()
  }, [state, onClose, router])

  return (
    <Dialog open={expense !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove this expense?</DialogTitle>
          <DialogDescription>
            {expense && formatMoney(expense.amount, expense.currency)} comes back off the total.
            There is no trash for an expense — this one is gone.
          </DialogDescription>
        </DialogHeader>

        {state.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        )}

        <form action={formAction}>
          <input type="hidden" name="id" value={expense?.id ?? ''} />
          <input type="hidden" name="tripId" value={tripId} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Keep it
            </Button>
            <RemoveSubmit />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
