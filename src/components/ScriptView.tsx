import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { characterHue } from '../lib/colors'
import type { ScriptBlock, Settings } from '../lib/types'
import type { PlayerStatus } from '../hooks/usePlayer'

interface Props {
  blocks: ScriptBlock[]
  characters: string[]
  current: number
  status: PlayerStatus
  settings: Settings
  onPlayFrom: (index: number) => void
  onSelect: (index: number) => void
  onEdit: (index: number, patch: Partial<ScriptBlock>) => void
}

const DIRECTION = '__direction__'
const NEW = '__new__'

function BlockEditor({
  block,
  characters,
  onEdit,
  onClose,
}: {
  block: ScriptBlock
  characters: string[]
  onEdit: (patch: Partial<ScriptBlock>) => void
  onClose: () => void
}) {
  return (
    <div className="block-editor" onClick={(e) => e.stopPropagation()}>
      <label>
        ¿Quién dice esto?
        <select
          autoFocus
          value={block.kind === 'dialogue' ? block.character : DIRECTION}
          onChange={(e) => {
            const value = e.target.value
            if (value === DIRECTION) onEdit({ kind: 'direction', character: undefined })
            else if (value === NEW) {
              const name = prompt('Nombre del personaje')?.trim().toLocaleUpperCase('es')
              if (name) onEdit({ kind: 'dialogue', character: name })
            } else onEdit({ kind: 'dialogue', character: value })
            onClose()
          }}
        >
          <option value={DIRECTION}>Acotación (nadie)</option>
          {characters.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={NEW}>+ Otro personaje…</option>
        </select>
      </label>
      <button onClick={onClose}>Cerrar</button>
    </div>
  )
}

export function ScriptView({ blocks, characters, current, status, settings, onPlayFrom, onSelect, onEdit }: Props) {
  const currentRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  // Mientras se lee, el bloque actual queda siempre a la vista.
  useEffect(() => {
    if (status !== 'idle') currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [current, status])

  return (
    <div className="script">
      {blocks.map((b, i) => {
        const isCurrent = i === current
        const mine = b.kind === 'dialogue' && b.character === settings.myCharacter && settings.myCharacter !== ''
        const hidden = mine && settings.hideMyLines && !revealed.has(i)
        const cls = [
          'block',
          b.kind,
          isCurrent ? 'current' : '',
          isCurrent && status === 'waiting' ? 'waiting' : '',
          mine ? 'mine' : '',
        ].join(' ')
        const style = b.character ? ({ '--hue': characterHue(b.character) } as CSSProperties) : undefined
        return (
          <div
            key={b.id}
            ref={isCurrent ? currentRef : undefined}
            className={cls}
            style={style}
            onClick={() => onSelect(i)}
            onDoubleClick={() => onPlayFrom(i)}
          >
            <div className="block-tools">
              <button
                className="icon"
                title="Leer desde acá"
                aria-label="Leer desde acá"
                onClick={(e) => {
                  e.stopPropagation()
                  onPlayFrom(i)
                }}
              >
                ▶
              </button>
              <button
                className="icon"
                title="Corregir quién lo dice"
                aria-label="Corregir quién lo dice"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(editing === i ? null : i)
                }}
              >
                ✎
              </button>
            </div>
            {b.kind === 'dialogue' && <div className="speaker">{b.character}</div>}
            <div
              className={`text ${hidden ? 'hidden-line' : ''}`}
              title={hidden ? 'Tocá para ver tu texto' : undefined}
              onClick={
                hidden
                  ? (e) => {
                      e.stopPropagation()
                      setRevealed(new Set(revealed).add(i))
                    }
                  : undefined
              }
            >
              {b.text.split(/(\([^)]*\))/).map((part, k) =>
                part.startsWith('(') ? (
                  <em key={k} className="inline-direction">
                    {part}
                  </em>
                ) : (
                  part
                ),
              )}
            </div>
            {isCurrent && status === 'waiting' && <div className="your-turn">Tu turno — decí tu texto</div>}
            {editing === i && (
              <BlockEditor
                block={b}
                characters={characters}
                onEdit={(patch) => onEdit(i, patch)}
                onClose={() => setEditing(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
