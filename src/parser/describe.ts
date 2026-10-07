import type { Budget, Constraint } from '../types'

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (minute: number) => {
  const h = Math.floor(minute / 60)
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(minute % 60)} ${h < 12 ? 'AM' : 'PM'}`
}

/** Plain words for what the parser understood about money. */
export function describeBudget(budget: Budget): string {
  const parts: string[] = []
  if (budget.maxSpend === 0) parts.push('spend nothing')
  else if (budget.maxSpend !== null) parts.push(`${budget.approximate ? 'around' : 'under'} ${rupees(budget.maxSpend)}`)
  if (budget.moneyLeft !== null) parts.push(`${rupees(budget.moneyLeft)} left`)
  return parts.join(' · ')
}

/** Plain words for one constraint. */
export function describeConstraint(c: Constraint): string {
  switch (c.kind) {
    case 'avoid-crowds':
      return 'not crowded'
    case 'avoid-mood':
      return `not ${c.mood}`
    case 'avoid-activity':
      return `no ${c.activity}`
    case 'free':
      return 'free'
    case 'cheap':
      return 'cheap'
    case 'nearby':
      return 'nearby'
    case 'tired':
      return 'tired: low effort'
    case 'place-type':
      return `a ${c.placeType}`
    case 'before':
      return `before ${c.label}${c.label === 'sunset' ? ` (${clock(c.minute)})` : ''}`
  }
}
