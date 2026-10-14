import type { VoiceSettings } from './types'

/**
 * Texto a voz con la Web Speech API: gratis, sin claves ni servidores.
 * Usa las voces que trae el navegador / sistema operativo
 * (en Chrome y Android incluye las voces de Google; en Edge, las de Microsoft; en Safari, las de Apple).
 */

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported) return Promise.resolve([])
  const now = speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices())
    speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    // Algunos navegadores nunca disparan el evento.
    setTimeout(done, 1500)
  })
}

const PREFERRED_LANGS = ['es-AR', 'es-US', 'es-419', 'es-MX', 'es-ES', 'es']

/** Voces en castellano primero (variantes latinoamericanas antes), después el resto. */
export function sortVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const rank = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.replace('_', '-')
    const exact = PREFERRED_LANGS.indexOf(lang)
    if (exact >= 0) return exact
    return lang.toLowerCase().startsWith('es') ? PREFERRED_LANGS.length : 100
  }
  return [...voices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

export function isSpanish(v: SpeechSynthesisVoice): boolean {
  return v.lang.toLowerCase().startsWith('es')
}

const PITCHES = [1, 0.8, 1.25, 0.9, 1.15, 0.7, 1.35]

/**
 * Le da una voz distinta a cada personaje que todavía no tiene una.
 * Si hay más personajes que voces, repite voces pero con otro tono.
 */
export function assignVoices(
  characters: string[],
  voices: SpeechSynthesisVoice[],
  existing: Record<string, VoiceSettings>,
): Record<string, VoiceSettings> {
  const spanish = sortVoices(voices).filter(isSpanish)
  const pool = spanish.length ? spanish : sortVoices(voices)
  const result: Record<string, VoiceSettings> = { ...existing }
  let k = Object.keys(existing).length
  for (const name of characters) {
    if (result[name]) continue
    const voice = pool.length ? pool[k % pool.length] : undefined
    const cycle = pool.length ? Math.floor(k / pool.length) : k
    result[name] = { voiceURI: voice?.voiceURI ?? '', pitch: PITCHES[cycle % PITCHES.length], rate: 1 }
    k++
  }
  return result
}

/**
 * Divide el texto en frases cortas. Chrome corta las locuciones largas
 * (más de ~15 segundos), así que nunca le pasamos párrafos enteros.
 */
export function splitForSpeech(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?…;:]+[.!?…;:]*["»”)]*\s*/g) ?? [text]
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      chunks.push(cur.trim())
      cur = ''
    }
    if (s.length > max) {
      // Frase muy larga sin puntos: cortamos por comas o espacios.
      const words = s.split(/(?<=,)\s+|\s+/)
      for (const w of words) {
        if ((cur + ' ' + w).length > max && cur) {
          chunks.push(cur.trim())
          cur = ''
        }
        cur += (cur ? ' ' : '') + w
      }
    } else {
      cur += s
    }
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks.filter((c) => /[\p{L}\p{N}]/u.test(c))
}

// Guardamos las locuciones vivas: si el recolector de basura se las lleva, Chrome no dispara `onend`.
const alive = new Set<SpeechSynthesisUtterance>()

function speakChunk(text: string, voice: SpeechSynthesisVoice | undefined, pitch: number, rate: number) {
  return new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    } else {
      u.lang = 'es-ES'
    }
    u.pitch = Math.min(2, Math.max(0, pitch))
    u.rate = Math.min(3, Math.max(0.3, rate))
    alive.add(u)
    const finish = () => {
      alive.delete(u)
      resolve()
    }
    u.onend = finish
    u.onerror = finish
    speechSynthesis.speak(u)
  })
}

/**
 * Lee un texto con una voz. Resuelve al terminar o al cancelar con `stopSpeaking()`.
 * `isCancelled` se consulta entre frases para cortar enseguida.
 */
export async function speak(
  text: string,
  settings: VoiceSettings,
  voices: SpeechSynthesisVoice[],
  globalRate: number,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  if (!speechSupported) return
  const voice = voices.find((v) => v.voiceURI === settings.voiceURI)
  for (const chunk of splitForSpeech(text)) {
    if (isCancelled()) return
    await speakChunk(chunk, voice, settings.pitch, settings.rate * globalRate)
  }
}

export function stopSpeaking() {
  if (speechSupported) speechSynthesis.cancel()
}

/** Cuánto tardaría alguien en decir el texto (para el modo "dejar el silencio"). */
export function estimateSpeechMs(text: string, rate: number): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1200, (words / 2.6) * 1000 / rate + 600)
}
