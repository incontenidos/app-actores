import { useCallback, useEffect, useRef, useState } from 'react'
import { stripInlineDirections } from '../lib/parser'
import { estimateSpeechMs, speak, stopSpeaking } from '../lib/speech'
import type { Script, Settings, VoiceSettings } from '../lib/types'

export type PlayerStatus = 'idle' | 'playing' | 'waiting'

const FALLBACK_VOICE: VoiceSettings = { voiceURI: '', pitch: 1, rate: 1 }

function sleep(ms: number, isCancelled: () => boolean) {
  return new Promise<void>((resolve) => {
    const start = Date.now()
    const tick = () => (isCancelled() || Date.now() - start >= ms ? resolve() : setTimeout(tick, 100))
    tick()
  })
}

/** Reproduce el guion bloque por bloque, con la voz de cada personaje. */
export function usePlayer(
  script: Script | null,
  settings: Settings,
  voices: SpeechSynthesisVoice[],
  initialPosition = 0,
) {
  const [current, setCurrent] = useState(initialPosition)
  const [status, setStatus] = useState<PlayerStatus>('idle')
  // Cada reproducción tiene un número; si cambia, la anterior se corta.
  const runRef = useRef(0)
  const resumeRef = useRef<(() => void) | null>(null)
  // Los cambios de voz o velocidad se aplican desde el próximo parlamento, sin reiniciar.
  const settingsRef = useRef(settings)
  const voicesRef = useRef(voices)
  useEffect(() => {
    settingsRef.current = settings
    voicesRef.current = voices
  }, [settings, voices])

  const cancelRun = () => {
    runRef.current++
    stopSpeaking()
    resumeRef.current?.()
  }

  const play = useCallback(
    async (from: number) => {
      if (!script) return
      cancelRun()
      const run = runRef.current
      const cancelled = () => runRef.current !== run
      setStatus('playing')

      for (let i = Math.max(0, from); i < script.blocks.length; i++) {
        if (cancelled()) return
        setCurrent(i)
        const block = script.blocks[i]
        const s = settingsRef.current
        const v = voicesRef.current

        if (block.kind !== 'dialogue') {
          if (s.readDirections) await speak(block.text, s.narrator, v, s.globalRate, cancelled)
          continue
        }

        const text = s.readInlineDirections ? block.text : stripInlineDirections(block.text)
        const mine = s.myCharacter !== '' && block.character === s.myCharacter
        if (mine && s.myLineMode === 'wait') {
          setStatus('waiting')
          await new Promise<void>((resolve) => (resumeRef.current = resolve))
          resumeRef.current = null
          if (cancelled()) return
          setStatus('playing')
          continue
        }
        if (mine && s.myLineMode === 'silence') {
          await sleep(estimateSpeechMs(text, s.globalRate), cancelled)
          continue
        }
        const voice = s.voices[block.character ?? ''] ?? FALLBACK_VOICE
        await speak(text, voice, v, s.globalRate, cancelled)
      }
      if (!cancelled()) setStatus('idle')
    },
    [script],
  )

  const pause = useCallback(() => {
    cancelRun()
    setStatus('idle')
  }, [])

  /** Cuando el actor terminó de decir su parlamento. */
  const resume = useCallback(() => resumeRef.current?.(), [])

  const goTo = useCallback(
    (index: number) => {
      if (!script) return
      const i = Math.min(Math.max(0, index), script.blocks.length - 1)
      if (status === 'idle') setCurrent(i)
      else void play(i)
    },
    [script, status, play],
  )

  // Al cambiar de guion o desmontar, cortamos.
  useEffect(() => {
    return () => {
      cancelRun()
      setStatus('idle')
    }
  }, [script])

  // Si se cargó un guion más corto, la posición guardada puede quedar afuera.
  const safeCurrent = script && current < script.blocks.length ? current : 0
  return { current: safeCurrent, status, play, pause, resume, goTo }
}
