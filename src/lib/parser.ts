import type { RawLine, Script, ScriptBlock } from './types'

/**
 * Convierte las líneas de un guion en bloques (parlamentos, acotaciones, títulos).
 *
 * Formatos de parlamento reconocidos:
 *   JUAN.— Hola.            (raya, típico en teatro en castellano)
 *   JUAN: Hola.  /  Juan: Hola.
 *   JUAN. Hola.
 *   JUAN (en voz baja): Hola.
 *   JUAN                     (nombre solo en una línea, el texto debajo)
 *   Hola.
 * Las acotaciones van entre paréntesis o como párrafos sueltos.
 */

const UP = 'A-ZÁÉÍÓÚÜÑÀÈÌÒÙÇ'
const LO = 'a-záéíóúüñàèìòùç'
// Nombre en mayúsculas: "JUAN", "SR. GÓMEZ", "HOMBRE 2", "DOÑA ROSA".
const UPPER_NAME = `[${UP}][${UP}0-9.'’\\- ]{0,34}?`
// Nombre en tipo título (solo con dos puntos): "Juan", "Doña Rosa".
const TITLE_NAME = `[${UP}][${UP}${LO}.'’\\-]*(?: (?:de|del|la|las|los|y|[${UP}][${UP}${LO}.'’\\-]*)){0,3}`
const PAREN = `\\([^)]*\\)`

const DASH_RE = new RegExp(`^(${UPPER_NAME})\\s*(${PAREN})?\\s*(?:[.:]?\\s*[—–]|[.:]\\s*--?|\\s--?\\s)\\s*(.*)$`, 'u')
const COLON_RE = new RegExp(`^(${TITLE_NAME}|${UPPER_NAME})\\s*(${PAREN})?\\s*:\\s*(.*)$`, 'u')
const ALONE_RE = new RegExp(`^(${UPPER_NAME})\\s*(${PAREN})?\\s*[.:]?$`, 'u')

const HEADING_RE =
  /^(acto|escena|cuadro|jornada|parte|pr[óo]logo|ep[íi]logo|primer[oa]?|segund[oa]|tercer[oa]?|cuart[oa]|quint[oa]|personajes|reparto|dramatis personae)\b/i
const STAGE_WORDS_RE = /^(tel[óo]n|oscuro|apag[óo]n|fin|mutis|silencio|pausa|se hace oscuro|cae el tel[óo]n)\b/i

type Pattern = 'dash' | 'colon' | 'period' | 'alone'

interface Candidate {
  name: string
  /** Acotación que acompaña al nombre, p. ej. "(en voz baja)". */
  paren?: string
  rest: string
  pattern: Pattern
}

function isUpper(s: string): boolean {
  return s === s.toLocaleUpperCase('es') && /[A-ZÁÉÍÓÚÜÑ]/.test(s)
}

export function normalizeName(name: string): string {
  return name
    .replace(/[.:,\s]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('es')
}

function plausibleName(name: string): boolean {
  const n = normalizeName(name)
  if (n.length < 2 || n.length > 35) return false
  if (n.split(' ').length > 4) return false
  if (HEADING_RE.test(n) || STAGE_WORDS_RE.test(n)) return false
  if (/^[\d\W]+$/u.test(n)) return false
  return true
}

/** Todas las formas en que una línea podría empezar un parlamento. */
function candidates(text: string): Candidate[] {
  const out: Candidate[] = []
  let m = DASH_RE.exec(text)
  if (m && isUpper(m[1])) out.push({ name: m[1], paren: m[2], rest: m[3], pattern: 'dash' })
  m = COLON_RE.exec(text)
  if (m) out.push({ name: m[1], paren: m[2], rest: m[3], pattern: 'colon' })
  m = ALONE_RE.exec(text)
  if (m && isUpper(m[1])) out.push({ name: m[1], paren: m[2], rest: '', pattern: 'alone' })

  // "JUAN. Hola" / "SR. GÓMEZ. Hola": probamos cada punto como posible fin del nombre.
  for (let i = text.indexOf('. '); i > 0 && i <= 40; i = text.indexOf('. ', i + 1)) {
    const name = text.slice(0, i)
    const rest = text.slice(i + 2).trim()
    if (rest && isUpper(name) && new RegExp(`^${UPPER_NAME}$`, 'u').test(name)) {
      out.push({ name, rest, pattern: 'period' })
    }
  }
  return out.filter((c) => plausibleName(c.name))
}

function minOccurrences(c: Candidate, next: RawLine | undefined): number {
  // Los formatos más ambiguos necesitan que el nombre aparezca más de una vez.
  if (c.pattern === 'dash') return 1
  if (c.pattern === 'colon') return isUpper(c.name) ? 1 : 2
  // Nombre solo seguido inmediatamente por texto: es un personaje aunque hable una vez.
  if (c.pattern === 'alone' && next && !next.gapBefore && !next.text.startsWith('(')) return 1
  return 2
}

function stripLeadingDash(s: string): string {
  return s.replace(/^\s*(?:[—–]|--?)\s*/u, '').trim()
}

function parenBalance(s: string): number {
  let b = 0
  for (const ch of s) {
    if (ch === '(') b++
    else if (ch === ')') b--
  }
  return b
}

export function parseScript(lines: RawLine[], title = 'Guion'): Script {
  // Primera pasada: cuántas veces aparece cada posible nombre.
  const counts = new Map<string, number>()
  const perLine = lines.map((l) => candidates(l.text))
  for (const cands of perLine) {
    const seen = new Set<string>()
    for (const c of cands) seen.add(normalizeName(c.name))
    for (const n of seen) counts.set(n, (counts.get(n) ?? 0) + 1)
  }

  const blocks: ScriptBlock[] = []
  let current: ScriptBlock | null = null
  let lastSpeaker: string | undefined
  // El bloque actual es una acotación entre paréntesis que interrumpe un parlamento.
  let interruption = false

  const push = (b: Omit<ScriptBlock, 'id'>) => {
    current = { ...b, id: blocks.length }
    blocks.push(current)
    return current
  }

  lines.forEach((line, i) => {
    const text = line.text
    const cur = current as ScriptBlock | null

    // Seguimos dentro de una acotación con paréntesis abierto.
    if (cur?.kind === 'direction' && parenBalance(cur.text) > 0) {
      cur.text += ' ' + text
      return
    }

    if (HEADING_RE.test(text) && text.length <= 60) {
      push({ kind: 'heading', text, page: line.page })
      interruption = false
      return
    }

    const valid = perLine[i]
      .filter((c) => (counts.get(normalizeName(c.name)) ?? 0) >= minOccurrences(c, lines[i + 1]))
      .sort(
        (a, b) =>
          (counts.get(normalizeName(b.name)) ?? 0) - (counts.get(normalizeName(a.name)) ?? 0) ||
          b.name.length - a.name.length,
      )
    const speaker = valid[0]
    if (speaker) {
      const character = normalizeName(speaker.name)
      const rest = stripLeadingDash(speaker.rest)
      const body = [speaker.paren, rest].filter(Boolean).join(' ')
      push({ kind: 'dialogue', character, text: body, page: line.page })
      lastSpeaker = character
      interruption = false
      return
    }

    if (text.startsWith('(')) {
      interruption = cur?.kind === 'dialogue' || (interruption && cur?.kind === 'direction')
      push({ kind: 'direction', text, page: line.page })
      return
    }

    if (cur?.kind === 'dialogue' && (!line.gapBefore || cur.text === '')) {
      cur.text = cur.text ? cur.text + ' ' + text : text
      return
    }

    if (cur?.kind === 'direction' && interruption && lastSpeaker && !line.gapBefore) {
      // "(Se sienta.)" en medio de un parlamento: lo que sigue es del mismo personaje.
      push({ kind: 'dialogue', character: lastSpeaker, text, page: line.page })
      interruption = false
      return
    }

    if (cur?.kind === 'direction' && !line.gapBefore) {
      cur.text += ' ' + text
      return
    }

    push({ kind: 'direction', text, page: line.page })
    interruption = false
  })

  return {
    title,
    blocks: blocks
      .map((b) => ({ ...b, text: b.text.replace(/\s+/g, ' ').trim() }))
      .filter((b) => b.text !== '' || b.kind === 'dialogue')
      .map((b, id) => ({ ...b, id })),
  }
}

/** Personajes del guion, ordenados por cantidad de parlamentos. */
export function charactersOf(script: Script): { name: string; lines: number }[] {
  const counts = new Map<string, number>()
  for (const b of script.blocks) {
    if (b.kind === 'dialogue' && b.character) counts.set(b.character, (counts.get(b.character) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name, 'es'))
}

/** Quita las acotaciones entre paréntesis de un texto (para no leerlas en voz alta). */
export function stripInlineDirections(text: string): string {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+([.,;:!?…])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
