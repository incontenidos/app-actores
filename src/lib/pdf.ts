// Versión "legacy" de pdf.js: anda también en navegadores de celular no tan nuevos.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { pagesToLines, type PositionedText } from './pdfText'
import type { RawLine } from './types'

GlobalWorkerOptions.workerSrc = workerUrl

/** Extrae las líneas de texto de un PDF, todo en el navegador (el archivo no se sube a ningún lado). */
export async function readPdf(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<RawLine[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  // fontExtraProperties: conserva el nombre de cada fuente ("...-ItalicMT"), para detectar la cursiva.
  const task = getDocument({ data, fontExtraProperties: true })
  const doc = await task.promise
  try {
    const pages: PositionedText[][] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      // Cargar las fuentes de la página para saber cuáles son cursivas.
      await page.getOperatorList()
      const italicFonts = new Map<string, boolean>()
      const isItalicFont = (name: string) => {
        if (!italicFonts.has(name)) {
          let italic = false
          try {
            if (page.commonObjs.has(name)) {
              const font = page.commonObjs.get(name) as { italic?: boolean; name?: string; loadedName?: string }
              italic = !!font.italic || /italic|oblique|cursiv/i.test(font.name ?? '')
            }
          } catch {
            // Fuente no disponible: la tratamos como normal.
          }
          italicFonts.set(name, italic)
        }
        return italicFonts.get(name)!
      }
      const items: PositionedText[] = []
      for (const it of content.items) {
        if (!('str' in it)) continue
        items.push({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          width: it.width,
          height: it.height || Math.abs(it.transform[3]) || 10,
          // Cursiva real de la fuente, o cursiva "falsa" (texto inclinado con la matriz).
          italic: isItalicFont(it.fontName) || Math.abs(it.transform[2]) > 0.1 * Math.abs(it.transform[3]),
        })
      }
      pages.push(items)
      onProgress?.(p, doc.numPages)
    }
    return pagesToLines(pages)
  } finally {
    await task.destroy()
  }
}
