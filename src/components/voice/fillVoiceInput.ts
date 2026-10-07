/** Puts text in the voice input (e.g. an example clicked in How to play), ready to send with Enter. */
export const VOICE_FILL_EVENT = 'exploringgoa:voice-fill'

export function fillVoiceInput(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(VOICE_FILL_EVENT, { detail: text }))
}
