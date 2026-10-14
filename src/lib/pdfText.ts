import { IT_CLOSE, IT_OPEN, plain, tidyMarks } from './marks'
import type { RawLine } from './types'

/** Fragmento de texto posicionado, el subconjunto que usamos de los items de pdf.js. */
export interface PositionedText {
  str: string
  x: number
  y: number
  width: number
  height: number
  /** Escrito en cursiva (didascalia). */
  italic?: boolean
}

interface Row {
  y: number
  height: number
  items: PositionedText[]
}

/**
 * Reconstruye las líneas de una página a partir de los fragmentos que da pdf.js.
 * Agrupa por coordenada Y (con tolerancia) y ordena por X dentro de cada línea.
 */
function pageRows(items: PositionedText[]): Row[] {
  const sorted = items
    .filter((it) => it.str.trim() !== '')
    .sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Row[] = []
  for (const it of sorted) {
    const tolerance = Math.max(2, (it.height || 10) * 0.4)
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance)
    if (row) {
      row.items.push(it)
      row.height = Math.max(row.height, it.height)
    } else {
      rows.push({ y: it.y, height: it.height, items: [it] })
    }
  }
  rows.sort((a, b) => b.y - a.y)
  for (const r of rows) r.items.sort((a, b) => a.x - b.x)
  return rows
}

function rowText(row: Row): string {
  let out = ''
  let prevEnd: number | null = null
  for (const it of row.items) {
    if (prevEnd !== null) {
      const gap = it.x - prevEnd
      const needsSpace = gap > Math.max(1, it.height * 0.15)
      if (needsSpace && !out.endsWith(' ') && !it.str.startsWith(' ')) out += ' '
    }
    out += it.italic && it.str.trim() ? IT_OPEN + it.str + IT_CLOSE : it.str
    prevEnd = it.x + it.width
  }
  return tidyMarks(out.replace(/\s+/g, ' ').trim())
}

/**
 * Interlineado normal (dentro de un mismo párrafo): el menor espaciado que se repite.
 * No sirve la mediana: en muchos guiones casi todos los parlamentos ocupan un solo renglón,
 * y lo más frecuente es justamente el espacio entre párrafos.
 */
export function lineSpacing(spacings: number[]): number {
  const s = spacings.filter((v) => v > 0).sort((a, b) => a - b)
  if (s.length === 0) return 12
  const minCount = Math.max(2, Math.ceil(s.length * 0.02))
  for (const v of s) {
    const near = s.filter((w) => Math.abs(w - v) <= v * 0.08).length
    if (near >= minCount) return v
  }
  return s[Math.floor(s.length / 2)]
}

const PAGE_NUMBER = /^(p[áa]g(ina)?\.?\s*)?[-–—]?\s*\d{1,4}\s*[-–—]?$/i

/**
 * Convierte el texto posicionado de todas las páginas en líneas,
 * marcando saltos de párrafo y quitando números de página y encabezados repetidos.
 */
export function pagesToLines(pages: PositionedText[][]): RawLine[] {
  const perPage = pages.map((items) => pageRows(items))

  // Distancia típica entre líneas consecutivas, para detectar saltos de párrafo.
  // Ignoramos distancias menores a media letra (subíndices, fragmentos desalineados).
  const heights = perPage.flat().map((r) => r.height).filter((h) => h > 0).sort((a, b) => a - b)
  const minSpacing = (heights[Math.floor(heights.length / 2)] ?? 10) * 0.6
  const spacings: number[] = []
  for (const rows of perPage) {
    for (let i = 1; i < rows.length; i++) {
      const d = rows[i - 1].y - rows[i].y
      if (d >= minSpacing) spacings.push(d)
    }
  }
  const typical = lineSpacing(spacings)

  const lines: RawLine[] = []
  perPage.forEach((rows, pageIndex) => {
    rows.forEach((row, i) => {
      const text = rowText(row)
      if (!text.replace(/[\uE000\uE001]/g, '')) return
      const gapBefore = i === 0 ? true : rows[i - 1].y - row.y > typical * 1.45
      lines.push({ text, page: pageIndex + 1, gapBefore })
    })
  })

  return removePageFurniture(lines, pages.length)
}

/** Índices de las primeras y últimas `n` líneas de cada página. */
function pageEdges(lines: RawLine[], n: number): Set<number> {
  const byPage = new Map<number, number[]>()
  lines.forEach((l, i) => {
    if (!byPage.has(l.page)) byPage.set(l.page, [])
    byPage.get(l.page)!.push(i)
  })
  const edges = new Set<number>()
  for (const idx of byPage.values()) {
    idx.slice(0, n).forEach((i) => edges.add(i))
    idx.slice(-n).forEach((i) => edges.add(i))
  }
  return edges
}

/** Saca las líneas marcadas conservando el salto de párrafo que tenían. */
function dropLines(lines: RawLine[], drop: (l: RawLine, i: number) => boolean): RawLine[] {
  const out: RawLine[] = []
  let pendingGap = false
  lines.forEach((l, i) => {
    if (drop(l, i)) {
      pendingGap = pendingGap || l.gapBefore
      return
    }
    out.push({ ...l, gapBefore: l.gapBefore || pendingGap })
    pendingGap = false
  })
  return out
}

/**
 * Quita números de página y encabezados / pies repetidos.
 * Solo mira los bordes de cada página, para no borrar parlamentos
 * que casualmente se repiten ("Sí.", "No.").
 */
export function removePageFurniture(lines: RawLine[], pageCount: number): RawLine[] {
  const numberEdges = pageEdges(lines, 2)
  const withoutNumbers = dropLines(lines, (l, i) => numberEdges.has(i) && PAGE_NUMBER.test(plain(l.text)))
  if (pageCount < 3) return withoutNumbers

  const edges = pageEdges(withoutNumbers, 1)
  const keyOf = (l: RawLine) => plain(l.text).replace(/\d+/g, '#').toLowerCase()
  const pagesWithText = new Map<string, Set<number>>()
  withoutNumbers.forEach((l, i) => {
    if (!edges.has(i)) return
    const key = keyOf(l)
    if (!pagesWithText.has(key)) pagesWithText.set(key, new Set())
    pagesWithText.get(key)!.add(l.page)
  })
  const threshold = Math.max(3, Math.ceil(pageCount * 0.5))
  return dropLines(withoutNumbers, (l, i) => edges.has(i) && pagesWithText.get(keyOf(l))!.size >= threshold)
}

/** Para texto plano (.txt o pegado): una línea vacía marca salto de párrafo. */
export function plainTextToLines(text: string): RawLine[] {
  const out: RawLine[] = []
  let gap = true
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.replace(/\s+/g, ' ').trim()
    if (!t) {
      gap = true
      continue
    }
    out.push({ text: t, page: 1, gapBefore: gap })
    gap = false
  }
  return out
}
