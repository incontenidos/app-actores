import { useState } from 'react'
import { parseScript } from '../lib/parser'
import { plainTextToLines } from '../lib/pdfText'
import type { Script } from '../lib/types'

interface Props {
  onLoaded: (script: Script) => void
}

function titleFromFile(name: string) {
  return name.replace(/\.(pdf|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Guion'
}

export function Uploader({ onLoaded }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pasted, setPasted] = useState('')

  const finish = (script: Script) => {
    if (!script.blocks.some((b) => b.kind === 'dialogue')) {
      setError(
        'Leí el texto pero no encontré personajes. Probá con un guion donde los parlamentos empiecen con el nombre (por ejemplo "JUAN.— Hola" o "JUAN: Hola").',
      )
      return
    }
    onLoaded(script)
  }

  const handleFile = async (file: File) => {
    setError(null)
    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        setBusy('Abriendo el PDF…')
        const { readPdf } = await import('../lib/pdf')
        const lines = await readPdf(file, (p, total) => setBusy(`Leyendo página ${p} de ${total}…`))
        if (lines.length === 0) {
          setError(
            'Este PDF no tiene texto seleccionable (parece escaneado como imagen). Por ahora la app necesita un PDF con texto; podés pasarlo por un OCR o pegar el texto abajo.',
          )
          return
        }
        finish(parseScript(lines, titleFromFile(file.name)))
      } else {
        finish(parseScript(plainTextToLines(await file.text()), titleFromFile(file.name)))
      }
    } catch (e) {
      console.error(e)
      setError('No pude leer el archivo. ¿Es un PDF válido y sin contraseña?')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="uploader">
      <h2>Cargá tu guion</h2>
      <p className="muted">
        Subí el PDF de la obra: la app detecta los personajes, le da una voz a cada uno y te deja ensayar tu papel.
        El archivo se procesa en tu dispositivo, no se sube a ningún servidor.
      </p>

      <label
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) void handleFile(file)
        }}
      >
        <input
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />
        <span className="dropzone-icon" aria-hidden>
          📄
        </span>
        <strong>{busy ?? 'Elegí un PDF o arrastralo acá'}</strong>
        <span className="muted">También acepta .txt</span>
      </label>

      {error && <p className="error">{error}</p>}

      <details className="paste">
        <summary>…o pegá el texto del guion</summary>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={10}
          placeholder={'JUAN.— Hola, ¿cómo estás?\nMARÍA.— (Sin mirarlo.) Bien.'}
        />
        <button
          className="primary"
          disabled={!pasted.trim()}
          onClick={() => {
            setError(null)
            finish(parseScript(plainTextToLines(pasted), 'Guion pegado'))
          }}
        >
          Usar este texto
        </button>
      </details>
    </div>
  )
}
