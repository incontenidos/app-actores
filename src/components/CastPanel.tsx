import { useState, type CSSProperties } from 'react'
import { characterHue } from '../lib/colors'
import { speak, stopSpeaking } from '../lib/speech'
import type { MyLineMode, Settings, VoiceSettings } from '../lib/types'
import { VoiceSelect } from './VoiceSelect'

interface Props {
  characters: { name: string; lines: number }[]
  settings: Settings
  voices: SpeechSynthesisVoice[]
  sampleLine: (character: string) => string
  onChange: (settings: Settings) => void
  onRename: (from: string, to: string) => void
}

const MODES: { value: MyLineMode; label: string; hint: string }[] = [
  { value: 'wait', label: 'Esperarme', hint: 'Se detiene en tus parlamentos hasta que toques "Continuar" (o la barra espaciadora).' },
  { value: 'silence', label: 'Dejar el silencio', hint: 'Deja un silencio del largo aproximado de tu parlamento.' },
  { value: 'read', label: 'Leerlos también', hint: 'Lee tus parlamentos como los demás (para escuchar la obra entera).' },
]

function VoiceControls({
  value,
  voices,
  showAll,
  onChange,
  onPreview,
  label,
}: {
  value: VoiceSettings
  voices: SpeechSynthesisVoice[]
  showAll: boolean
  onChange: (v: VoiceSettings) => void
  onPreview: () => void
  label: string
}) {
  return (
    <div className="voice-controls">
      <div className="row">
        <VoiceSelect
          label={`Voz de ${label}`}
          value={value.voiceURI}
          voices={voices}
          showAll={showAll}
          onChange={(voiceURI) => onChange({ ...value, voiceURI })}
        />
        <button className="icon" title="Probar voz" aria-label={`Probar voz de ${label}`} onClick={onPreview}>
          🔊
        </button>
      </div>
      <div className="row sliders">
        <label>
          Tono
          <input
            type="range"
            min={0.5}
            max={1.6}
            step={0.05}
            value={value.pitch}
            onChange={(e) => onChange({ ...value, pitch: Number(e.target.value) })}
          />
        </label>
        <label>
          Velocidad
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={value.rate}
            onChange={(e) => onChange({ ...value, rate: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  )
}

export function CastPanel({ characters, settings, voices, sampleLine, onChange, onRename }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })
  const preview = (text: string, v: VoiceSettings) => {
    stopSpeaking()
    void speak(text, v, voices, settings.globalRate)
  }

  return (
    <div className="cast">
      <section>
        <h3>Ensayo</h3>
        <label className="field">
          Mi personaje
          <select value={settings.myCharacter} onChange={(e) => set({ myCharacter: e.target.value })}>
            <option value="">— Ninguno (escuchar la obra) —</option>
            {characters.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {settings.myCharacter && (
          <>
            <fieldset className="modes">
              <legend>En mis parlamentos…</legend>
              {MODES.map((m) => (
                <label key={m.value} title={m.hint}>
                  <input
                    type="radio"
                    name="mode"
                    checked={settings.myLineMode === m.value}
                    onChange={() => set({ myLineMode: m.value })}
                  />
                  {m.label}
                </label>
              ))}
              <p className="muted small">{MODES.find((m) => m.value === settings.myLineMode)?.hint}</p>
            </fieldset>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.hideMyLines}
                onChange={(e) => set({ hideMyLines: e.target.checked })}
              />
              Ocultar mi texto (para memorizar)
            </label>
          </>
        )}
      </section>

      <section>
        <h3>Reparto y voces</h3>
        {voices.length === 0 && (
          <p className="warning small">
            Este navegador no ofrece voces. Probá con Chrome, Edge o Safari (en Android, instalá "Servicios de voz de
            Google").
          </p>
        )}
        <label className="check small">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Mostrar voces de otros idiomas
        </label>
        <ul className="characters">
          {characters.map((c) => {
            const v = settings.voices[c.name] ?? { voiceURI: '', pitch: 1, rate: 1 }
            const mine = c.name === settings.myCharacter
            return (
              <li key={c.name} style={{ '--hue': characterHue(c.name) } as CSSProperties}>
                <div className="character-head">
                  <span className="dot" />
                  {renaming === c.name ? (
                    <form
                      className="rename"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (newName.trim()) onRename(c.name, newName)
                        setRenaming(null)
                      }}
                    >
                      <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
                      <button type="submit">OK</button>
                    </form>
                  ) : (
                    <button
                      className="link name"
                      title="Renombrar (si ponés el nombre de otro personaje, se unen)"
                      onClick={() => {
                        setRenaming(c.name)
                        setNewName(c.name)
                      }}
                    >
                      {c.name}
                    </button>
                  )}
                  <span className="muted small">
                    {c.lines} {c.lines === 1 ? 'parlamento' : 'parlamentos'}
                    {mine && ' · vos'}
                  </span>
                </div>
                <VoiceControls
                  label={c.name}
                  value={v}
                  voices={voices}
                  showAll={showAll}
                  onChange={(nv) => set({ voices: { ...settings.voices, [c.name]: nv } })}
                  onPreview={() => preview(sampleLine(c.name), v)}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h3>Didascalias</h3>
        <p className="muted small">
          Lo que está en <em>cursiva</em> o (entre paréntesis) es una didascalia: se ve en el guion, pero los
          personajes no lo dicen.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.readDirections}
            onChange={(e) => set({ readDirections: e.target.checked })}
          />
          Que un narrador lea las didascalias entre parlamentos y los títulos
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.readInlineDirections}
            onChange={(e) => set({ readInlineDirections: e.target.checked })}
          />
          Que el narrador lea también las didascalias dentro de los parlamentos
        </label>
        {(settings.readDirections || settings.readInlineDirections) && (
          <VoiceControls
            label="narrador"
            value={settings.narrator}
            voices={voices}
            showAll={showAll}
            onChange={(narrator) => set({ narrator })}
            onPreview={() => preview('Se abre el telón. Una sala humilde.', settings.narrator)}
          />
        )}
      </section>
    </div>
  )
}
