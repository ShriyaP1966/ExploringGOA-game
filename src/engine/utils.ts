export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 4500 -> "₹4,500" for engine messages. */
export function rupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export function isPositiveAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0
}
