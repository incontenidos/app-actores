/**
 * Marcas invisibles para el texto en cursiva del PDF.
 * En teatro, la cursiva (igual que los paréntesis) indica una didascalia:
 * se muestra, pero no la dice el personaje.
 */
export const IT_OPEN = ''
export const IT_CLOSE = ''

const MARKS_RE = /[]/g

/** El texto sin marcas. */
export function plain(s: string): string {
  return s.replace(MARKS_RE, '')
}

/** Une tramos en cursiva vecinos y saca los vacíos. */
export function tidyMarks(s: string): string {
  return s
    .replace(/(\s*)/g, '$1')
    .replace(/(\s*)/g, '$1')
}

/** Texto (con marcas) desde la posición `plainIndex` del texto sin marcas. */
export function sliceMarked(s: string, plainIndex: number): string {
  let count = 0
  let open = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === IT_OPEN) open = true
    else if (ch === IT_CLOSE) open = false
    else {
      if (count === plainIndex) return tidyMarks((open ? IT_OPEN : '') + s.slice(i))
      count++
    }
  }
  return ''
}

/** Todo lo que tiene letras está en cursiva. */
export function isAllItalic(s: string): boolean {
  if (!s.includes(IT_OPEN)) return false
  return !/[\p{L}\p{N}]/u.test(s.replace(/[^]*(|$)/g, ''))
}

/** Termina dentro de (o justo con) un tramo en cursiva. */
export function endsItalic(s: string): boolean {
  return /[\s.,;:!?…)»"]*$/u.test(s) || s.lastIndexOf(IT_OPEN) > s.lastIndexOf(IT_CLOSE)
}

export interface Segment {
  /** Didascalia (cursiva o entre paréntesis): no la dice el personaje. */
  direction: boolean
  text: string
}

/** Divide un parlamento en texto dicho y didascalias (cursiva o paréntesis). */
export function segments(s: string): Segment[] {
  const out: Segment[] = []
  const push = (direction: boolean, text: string) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.direction === direction) last.text += text
    else out.push({ direction, text })
  }
  let italic = false
  let paren = 0
  for (const ch of s) {
    if (ch === IT_OPEN) italic = true
    else if (ch === IT_CLOSE) italic = false
    else if (ch === '(') {
      paren++
      push(true, ch)
    } else if (ch === ')') {
      push(true, ch)
      paren = Math.max(0, paren - 1)
    } else push(italic || paren > 0, ch)
  }
  return out
}
