import type { ReactNode } from 'react'

type BadgeTone = 'ocean' | 'palm' | 'sunset' | 'coral' | 'sand'

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
}

export function Badge({ tone = 'ocean', children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
