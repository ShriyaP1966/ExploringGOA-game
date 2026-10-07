export interface Tab<T extends string> {
  id: T
  label: string
}

interface TabBarProps<T extends string> {
  tabs: readonly Tab<T>[]
  activeId: T
  onChange: (id: T) => void
  ariaLabel: string
}

export function TabBar<T extends string>({ tabs, activeId, onChange, ariaLabel }: TabBarProps<T>) {
  return (
    <div className="tab-bar" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`tab-bar__tab ${active ? 'tab-bar__tab--active' : ''}`.trim()}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
