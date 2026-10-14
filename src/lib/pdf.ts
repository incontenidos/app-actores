import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { pagesToLines, type PositionedText } from './pdfText'
import type { RawLine } from './types'

GlobalWorkerOptions.workerSrc = workerUrl

/** Extrae las líneas de texto de un PDF, todo en el navegador (el archivo no se sube a ningún lado). */
export async function readPdf(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<RawLine[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  const task = getDocument({ data })
  const doc = await task.promise
  try {
    const pages: PositionedText[][] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const items: PositionedText[] = []
      for (const it of content.items) {
        if (!('str' in it)) continue
        items.push({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          width: it.width,
          height: it.height || Math.abs(it.transform[3]) || 10,
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
