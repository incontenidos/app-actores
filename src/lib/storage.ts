import type { Script, Settings } from './types'

const KEY = 'app-actores:v1'

export interface Saved {
  script: Script
  settings: Settings
  position: number
}

export const defaultSettings: Settings = {
  voices: {},
  narrator: { voiceURI: '', pitch: 1, rate: 1.05 },
  readDirections: false,
  readInlineDirections: false,
  myCharacter: '',
  myLineMode: 'wait',
  hideMyLines: false,
  globalRate: 1,
}

/** Se guarda solo en este navegador (localStorage); nada sale del dispositivo. */
export function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    return { ...saved, settings: { ...defaultSettings, ...saved.settings } }
  } catch {
    return null
  }
}

export function save(data: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Sin espacio o modo privado: la app sigue funcionando, solo no recuerda el guion.
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignorar
  }
}
