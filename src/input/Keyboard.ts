type Action = () => void

/** Held keys drive the loco; tapped keys work the points and the coupling. */
export class Keyboard {
  private held = new Set<string>()
  private taps = new Map<string, Action>()

  constructor() {
    addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase()
      if (!e.repeat) {
        const action = this.taps.get(key)
        if (action) {
          e.preventDefault()
          action()
        }
      }
      this.held.add(key)
    })
    addEventListener('keyup', (e) => this.held.delete(e.key.toLowerCase()))
    addEventListener('blur', () => this.held.clear())
  }

  on(key: string, action: Action): void {
    this.taps.set(key, action)
  }

  down(...keys: string[]): boolean {
    return keys.some((k) => this.held.has(k))
  }
}
