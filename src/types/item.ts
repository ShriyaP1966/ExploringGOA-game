export type ItemId = string

export type ItemKind = 'tool' | 'ticket' | 'souvenir'

export interface Item {
  id: ItemId
  name: string
  emoji: string
  kind: ItemKind
  description: string
  /** Short line explaining what the item does in the game. */
  effect: string
  /** You can only ever hold one. */
  unique: boolean
  /** Can be used from the inventory (USE_ITEM). */
  usable?: boolean
  /** Other words players use for it ("map", "shades"), matched as whole words after normalising. */
  aliases?: string[]
  /** Rupees, where it can be bought. */
  price: number
}

export interface InventoryEntry {
  itemId: ItemId
  quantity: number
}
