/**
 * What a trip cost, against what it was meant to cost — screen 22.
 *
 * Pure, and tested, because every number here is a claim about somebody's money
 * and the wrong one is worse than none. Three rules hold throughout:
 *
 * **Currencies are never converted.** `trips.budget_planned` carries a currency
 * and so does every expense. Adding ₹40,000 to $400 needs an exchange rate this
 * codebase does not have and should not invent, so totals are grouped by
 * currency and a plan is only ever compared against spend in the same one. The
 * analytics screen already made this call; the budget screen makes the same one.
 *
 * **A missing plan is not a plan of zero.** A trip with no `budget_planned` has
 * not been budgeted, which is a different statement from budgeting nothing, and
 * "100% over budget" is not the thing to tell someone who never set one.
 *
 * **Nothing here reads the database.** The screen supplies rows; this file does
 * the arithmetic. That is what lets the arithmetic be checked without one.
 */

export const EXPENSE_CATEGORIES = [
  'flights',
  'hotels',
  'food',
  'activities',
  'shopping',
  'misc',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  flights: 'Getting there',
  hotels: 'Stays',
  food: 'Food & drink',
  activities: 'Activities',
  shopping: 'Shopping',
  misc: 'Everything else',
}

/** lucide-react icon names, resolved in the client component. */
export const EXPENSE_CATEGORY_ICON: Record<ExpenseCategory, string> = {
  flights: 'Plane',
  hotels: 'BedDouble',
  food: 'Utensils',
  activities: 'Ticket',
  shopping: 'ShoppingBag',
  misc: 'Ellipsis',
}

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value)
}

export function categoryLabel(value: string): string {
  return isExpenseCategory(value) ? EXPENSE_CATEGORY_LABEL[value] : value
}

/** One recorded spend, reduced to what the arithmetic needs. */
export interface BudgetExpense {
  category: string
  amount: number
  currency: string
}

export interface CategoryTotal {
  category: ExpenseCategory | string
  label: string
  total: number
  /** Share of the currency's spend, 0–100, rounded to one decimal. */
  percent: number
  count: number
}

/** Everything spent in one currency, and how it breaks down. */
export interface CurrencyBudget {
  currency: string
  spent: number
  /** The trip's planned budget, when it was set *in this currency*. */
  planned: number | null
  /** `planned - spent`. Negative means over. Null when there is no plan. */
  remaining: number | null
  /** Spend as a percentage of the plan, uncapped. Null when there is no plan. */
  usedPercent: number | null
  count: number
  categories: CategoryTotal[]
}

export interface BudgetSummary {
  /**
   * One entry per currency anything was spent in, plus the planned currency
   * even when nothing has been spent in it yet — a budget set and untouched is
   * the state every trip starts in, and it should show as such rather than
   * vanish until the first receipt.
   */
  currencies: CurrencyBudget[]
  /** Expenses recorded, across every currency. */
  count: number
  /**
   * True when spend exists in a currency the plan is not in. The screen says so
   * rather than folding it in, because there is no rate to fold it with.
   */
  hasUnplannedCurrency: boolean
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Groups spend by currency, then by category, and compares each against the
 * plan when the plan is in that currency.
 *
 * `plannedCurrency` is `trips.currency`, which is never null in the schema, so
 * a plan of null simply means the trip has no budget rather than no currency.
 */
export function summariseBudget({
  expenses,
  planned,
  plannedCurrency,
}: {
  expenses: readonly BudgetExpense[]
  planned: number | null
  plannedCurrency: string
}): BudgetSummary {
  const planCurrency = plannedCurrency.toUpperCase()

  // currency → category → running total and count.
  const byCurrency = new Map<string, Map<string, { total: number; count: number }>>()

  for (const expense of expenses) {
    if (!Number.isFinite(expense.amount)) continue
    const currency = expense.currency.toUpperCase()
    const categories = byCurrency.get(currency) ?? new Map()
    const bucket = categories.get(expense.category) ?? { total: 0, count: 0 }
    bucket.total += expense.amount
    bucket.count += 1
    categories.set(expense.category, bucket)
    byCurrency.set(currency, categories)
  }

  // A budget nobody has spent against still has something to say.
  if (planned !== null && !byCurrency.has(planCurrency)) {
    byCurrency.set(planCurrency, new Map())
  }

  const currencies: CurrencyBudget[] = [...byCurrency]
    .map(([currency, categories]) => {
      const spent = round2([...categories.values()].reduce((sum, c) => sum + c.total, 0))
      const count = [...categories.values()].reduce((sum, c) => sum + c.count, 0)

      // The plan only applies to the currency it was written in. Anything else
      // gets a total and no comparison, which is the honest answer.
      const currencyPlan = currency === planCurrency ? planned : null

      return {
        currency,
        spent,
        planned: currencyPlan,
        remaining: currencyPlan === null ? null : round2(currencyPlan - spent),
        usedPercent:
          currencyPlan === null || currencyPlan === 0
            ? null
            : Math.round((spent / currencyPlan) * 1000) / 10,
        count,
        categories: rankCategories(categories, spent),
      }
    })
    // The currency the trip is planned in leads, then by size.
    .sort((a, b) => {
      if (a.currency === planCurrency) return -1
      if (b.currency === planCurrency) return 1
      return b.spent - a.spent || a.currency.localeCompare(b.currency)
    })

  return {
    currencies,
    count: expenses.length,
    hasUnplannedCurrency: currencies.some((c) => c.currency !== planCurrency && c.count > 0),
  }
}

/**
 * Category totals for one currency, largest first.
 *
 * Only categories with spend appear. A breakdown listing four empty categories
 * to show two real ones buries the answer it exists to give; the screen says
 * separately which categories are untouched if that is worth knowing.
 */
function rankCategories(
  categories: Map<string, { total: number; count: number }>,
  spent: number
): CategoryTotal[] {
  return [...categories]
    .map(([category, { total, count }]) => ({
      category,
      label: categoryLabel(category),
      total: round2(total),
      percent: spent === 0 ? 0 : Math.round((total / spent) * 1000) / 10,
      count,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
}

/**
 * Money, written the way the rest of the app writes it.
 *
 * The code rather than a symbol: this app deals in currencies whose symbols
 * collide — $ is four different currencies — and a total that says which one it
 * is cannot be misread.
 */
export function formatMoney(amount: number, currency: string): string {
  return `${currency.toUpperCase()} ${amount.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/** How a budget is doing, as a word the screen can colour by. */
export type BudgetVerdict = 'unplanned' | 'under' | 'close' | 'over'

export function budgetVerdict(budget: CurrencyBudget): BudgetVerdict {
  if (budget.planned === null || budget.usedPercent === null) return 'unplanned'
  if (budget.usedPercent > 100) return 'over'
  if (budget.usedPercent >= 85) return 'close'
  return 'under'
}
