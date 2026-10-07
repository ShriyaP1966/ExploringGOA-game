import { ITEMS } from '../../data/items'
import { checkUseItem } from '../../engine/items'
import { useGameDispatch, useGameState } from '../../hooks/useGame'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

/** A slight, stable tilt per sticker, like they were slapped on a suitcase. */
const TILTS = [-6, 4, -3, 7, -5, 3]

/**
 * Your bag as stickers: each item is an icon you can hover or focus for its tooltip (what it is,
 * what it does, and why it can't be used right now). The engine decides if an item can be used.
 */
export function InventoryPanel() {
  const state = useGameState()
  const dispatch = useGameDispatch()
  const { inventory } = state.player

  return (
    <Card title="🎒 Inventory">
      {inventory.length === 0 ? (
        <p className="side-panel__muted">Your bag is empty.</p>
      ) : (
        <ul className="stickers">
          {inventory.map(({ itemId, quantity }, index) => {
            const item = ITEMS[itemId]
            const check = item.usable ? checkUseItem(state, itemId) : null
            const tipId = `item-tip-${itemId}`
            return (
              <li key={itemId} className="sticker-slot">
                <span
                  className={`sticker sticker--${item.kind}`}
                  tabIndex={0}
                  aria-describedby={tipId}
                  style={{ ['--tilt' as string]: `${TILTS[index % TILTS.length]}deg` }}
                >
                  <span className="sticker__emoji" aria-hidden="true">
                    {item.emoji}
                  </span>
                  {quantity > 1 && <span className="sticker__qty">×{quantity}</span>}
                </span>
                <span className="sticker__name">{item.name}</span>
                <span role="tooltip" id={tipId} className="sticker__tip">
                  <strong>
                    {item.emoji} {item.name}
                    {quantity > 1 && ` ×${quantity}`}
                  </strong>
                  <span>{item.description}</span>
                  <span className="sticker__tip-effect">✨ {item.effect}</span>
                  {check && !check.ok && <span className="sticker__tip-reason">{check.reason}</span>}
                </span>
                {item.usable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="sticker__use"
                    disabled={!check?.ok}
                    title={check && !check.ok ? check.reason : undefined}
                    onClick={() => dispatch({ type: 'USE_ITEM', itemId })}
                    aria-label={`Use ${item.name}`}
                  >
                    Use
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
