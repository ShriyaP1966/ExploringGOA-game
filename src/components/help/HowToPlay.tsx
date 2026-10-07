import { useEffect } from 'react'
import { EXAMPLE_GROUPS, HOW_TO_PLAY_STEPS } from '../../data/howToPlay'
import { fillTemplate } from '../format'
import { Button } from '../ui/Button'
import { fillVoiceInput } from '../voice/fillVoiceInput'

/**
 * How to play: the basics and example things to say. It stops above the voice panel and doesn't
 * take focus, so you can keep talking while it's open; clicking an example puts it in the input.
 */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tryPhrase = (phrase: string) => {
    fillVoiceInput(phrase)
    onClose()
  }

  return (
    <div className="help-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="help-card" role="dialog" aria-modal="false" aria-labelledby="help-title">
        <header className="help-card__header">
          <h2 id="help-title" className="help-card__title">
            🧭 How to play
          </h2>
          <button type="button" className="help-card__close" onClick={onClose} aria-label="Close how to play">
            ✕
          </button>
        </header>

        <ol className="help-steps">
          {HOW_TO_PLAY_STEPS.map((step) => (
            <li key={step.text}>
              <span className="help-steps__icon" aria-hidden="true">
                {step.icon}
              </span>
              <span>{fillTemplate(step.text)}</span>
            </li>
          ))}
        </ol>

        <h3 className="help-card__subtitle">Things you can say</h3>
        <p className="help-card__hint">Click one to put it in the box, then press Enter. Any wording works: these are just ideas.</p>
        <div className="help-examples">
          {EXAMPLE_GROUPS.map((group) => (
            <div key={group.title} className="help-examples__group">
              <h4 className="help-examples__title">{group.title}</h4>
              <div className="help-examples__chips">
                {group.phrases.map((phrase) => (
                  <button key={phrase} type="button" className="say-chip" onClick={() => tryPhrase(phrase)}>
                    “{phrase}”
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="help-card__actions">
          <Button variant="sunset" onClick={onClose}>
            Got it
          </Button>
        </div>
      </section>
    </div>
  )
}
