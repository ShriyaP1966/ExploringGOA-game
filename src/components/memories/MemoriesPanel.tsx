import { STORY_MEMORIES } from '../../data/memories'
import { hasStoryMemory } from '../../engine/memories'
import { useGameState } from '../../hooks/useGame'
import { Card } from '../ui/Card'
import { MemoryCard } from './MemoryCard'

/** Every memory made on the trip, newest first, plus how many story moments are still out there. */
export function MemoriesPanel() {
  const state = useGameState()
  const memories = [...state.player.memories].reverse()
  const storiesFound = STORY_MEMORIES.filter((s) => hasStoryMemory(state, s.id)).length

  return (
    <Card title={`📔 Memories (${memories.length})`}>
      <p className="memories__progress">
        ✨ {storiesFound} of {STORY_MEMORIES.length} trip moments found
      </p>
      {memories.length === 0 ? (
        <p className="side-panel__muted">No memories yet. They happen as you explore.</p>
      ) : (
        <ul className="polaroid-grid">
          {memories.map((memory) => (
            <li key={memory.id}>
              <MemoryCard memory={memory} isNew={state.newMemoryIds.includes(memory.id)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
