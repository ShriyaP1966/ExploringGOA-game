import type { ReactNode } from 'react'

interface PanelProps {
  title?: string
  actions?: ReactNode
  className?: string
  ariaLabel?: string
  children: ReactNode
}

export function Panel({ title, actions, className = '', ariaLabel, children }: PanelProps) {
  return (
    <section className={`panel ${className}`.trim()} aria-label={ariaLabel ?? title}>
      {(title || actions) && (
        <header className="panel__header">
          {title && <h2 className="panel__title">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="panel__body">{children}</div>
    </section>
  )
}
