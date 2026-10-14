import { useCallback, useEffect, useMemo, useState } from 'react'
import { CastPanel } from './components/CastPanel'
import { PlayerBar } from './components/PlayerBar'
import { ScriptView } from './components/ScriptView'
import { Uploader } from './components/Uploader'
import { usePlayer } from './hooks/usePlayer'
import { charactersOf, normalizeName, stripInlineDirections } from './lib/parser'
import { assignVoices, loadVoices, speechSupported } from './lib/speech'
import * as storage from './lib/storage'
import type { Script, ScriptBlock, Settings } from './lib/types'

const saved = storage.load()

export default function App() {
  const [script, setScript] = useState<Script | null>(saved?.script ?? null)
  const [settings, setSettings] = useState<Settings>(saved?.settings ?? storage.defaultSettings)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [tab, setTab] = useState<'script' | 'cast'>('script')

  const player = usePlayer(script, settings, voices, saved?.position ?? 0)
  const { current, status, play, pause, resume, goTo } = player

  const characters = useMemo(() => (script ? charactersOf(script) : []), [script])

  useEffect(() => {
    void loadVoices().then(setVoices)
    if (!speechSupported) return
    const update = () => setVoices(speechSynthesis.getVoices())
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  // Cada personaje nuevo recibe una voz automáticamente (las voces del sistema llegan de forma asíncrona).
  useEffect(() => {
    if (voices.length === 0 || characters.length === 0) return
    // oxlint-disable-next-line react/set-state-in-effect
    setSettings((s) => {
      if (characters.every((c) => s.voices[c.name])) return s
      return { ...s, voices: assignVoices(characters.map((c) => c.name), voices, s.voices) }
    })
  }, [characters, voices])

  useEffect(() => {
    if (script) storage.save({ script, settings, position: current })
  }, [script, settings, current])

  const loadScript = (s: Script) => {
    setScript(s)
    setSettings((prev) => ({ ...prev, voices: {}, myCharacter: '' }))
    setTab('cast')
  }

  const closeScript = () => {
    if (!confirm('¿Cerrar este guion y cargar otro? Se pierden las voces elegidas y las correcciones.')) return
    pause()
    storage.clear()
    setScript(null)
  }

  const editBlock = (index: number, patch: Partial<ScriptBlock>) => {
    setScript((s) => s && { ...s, blocks: s.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) })
  }

  const renameCharacter = (from: string, rawTo: string) => {
    const to = normalizeName(rawTo)
    if (!to || to === from) return
    setScript(
      (s) =>
        s && {
          ...s,
          blocks: s.blocks.map((b) => (b.character === from ? { ...b, character: to } : b)),
        },
    )
    setSettings((s) => {
      const voicesMap = { ...s.voices }
      // Si ya existía el personaje destino, se unen y queda su voz.
      if (!voicesMap[to] && voicesMap[from]) voicesMap[to] = voicesMap[from]
      delete voicesMap[from]
      return { ...s, voices: voicesMap, myCharacter: s.myCharacter === from ? to : s.myCharacter }
    })
  }

  const sampleLine = useCallback(
    (character: string) => {
      const line = script?.blocks.find((b) => b.character === character && stripInlineDirections(b.text).length > 8)
      return line ? stripInlineDirections(line.text).slice(0, 140) : `Hola, soy ${character.toLocaleLowerCase('es')}.`
    },
    [script],
  )

  // Atajos: espacio = reproducir / pausa / continuar; flechas = anterior / siguiente.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select') && !(t instanceof HTMLInputElement && t.type === 'range')) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (status === 'waiting') resume()
        else if (status === 'idle') void play(current)
        else pause()
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault()
        if (status === 'waiting') resume()
        else goTo(current + 1)
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault()
        goTo(current - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, current, play, pause, resume, goTo])

  if (!script) {
    return (
      <div className="app">
        <header className="topbar">
          <h1>🎭 Ensayo</h1>
        </header>
        <main className="welcome">
          {!speechSupported && (
            <p className="warning">Este navegador no tiene síntesis de voz. Usá Chrome, Edge o Safari actualizados.</p>
          )}
          <Uploader onLoaded={loadScript} />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1 title={script.title}>🎭 {script.title}</h1>
        <nav className="tabs">
          <button className={tab === 'script' ? 'active' : ''} onClick={() => setTab('script')}>
            Guion
          </button>
          <button className={tab === 'cast' ? 'active' : ''} onClick={() => setTab('cast')}>
            Voces
          </button>
        </nav>
        <button className="link" onClick={closeScript}>
          Cambiar guion
        </button>
      </header>
      <div className={`layout show-${tab}`}>
        <aside className="sidebar">
          <CastPanel
            characters={characters}
            settings={settings}
            voices={voices}
            sampleLine={sampleLine}
            onChange={setSettings}
            onRename={renameCharacter}
          />
          <button className="primary only-mobile" onClick={() => setTab('script')}>
            Ir al guion →
          </button>
        </aside>
        <main className="main">
          <ScriptView
            blocks={script.blocks}
            characters={characters.map((c) => c.name)}
            current={current}
            status={status}
            settings={settings}
            onPlayFrom={(i) => void play(i)}
            onSelect={goTo}
            onEdit={editBlock}
          />
        </main>
      </div>
      <PlayerBar
        status={status}
        current={current}
        total={script.blocks.length}
        rate={settings.globalRate}
        onRate={(globalRate) => setSettings((s) => ({ ...s, globalRate }))}
        onPlay={() => {
          setTab('script')
          void play(current)
        }}
        onPause={pause}
        onResume={resume}
        onPrev={() => goTo(current - 1)}
        onNext={() => (status === 'waiting' ? resume() : goTo(current + 1))}
      />
    </div>
  )
}
