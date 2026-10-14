import { describe, expect, it } from 'vitest'
import { charactersOf, parseScript, stripInlineDirections } from './parser'
import { IT_CLOSE, IT_OPEN, segments } from './marks'
import { plainTextToLines, removePageFurniture } from './pdfText'

const parse = (text: string) => parseScript(plainTextToLines(text))
const summary = (text: string) =>
  parse(text).blocks.map((b) => (b.kind === 'dialogue' ? `${b.character}: ${b.text}` : `[${b.kind}] ${b.text}`))

describe('parseScript', () => {
  it('reconoce el formato con raya', () => {
    expect(
      summary(`ACTO PRIMERO

Una sala humilde. Es de noche.

BERNARDA.— ¡Silencio!
ADELA.— (Entrando.) Madre, yo no
quería molestar.
BERNARDA.— ¡A tu cuarto!`),
    ).toEqual([
      '[heading] ACTO PRIMERO',
      '[direction] Una sala humilde. Es de noche.',
      'BERNARDA: ¡Silencio!',
      'ADELA: (Entrando.) Madre, yo no quería molestar.',
      'BERNARDA: ¡A tu cuarto!',
    ])
  })

  it('reconoce dos puntos, nombres compuestos y acotaciones junto al nombre', () => {
    expect(
      summary(`SR. GÓMEZ: Buenas tardes.
Doña Rosa: ¿Qué desea?
SR. GÓMEZ (nervioso): Nada, nada.
Doña Rosa: Bueno.`),
    ).toEqual([
      'SR. GÓMEZ: Buenas tardes.',
      'DOÑA ROSA: ¿Qué desea?',
      'SR. GÓMEZ: (nervioso) Nada, nada.',
      'DOÑA ROSA: Bueno.',
    ])
  })

  it('reconoce "NOMBRE. texto" y prefiere el nombre que más se repite', () => {
    expect(
      summary(`SR. GÓMEZ. Hola.
ANA. Hola, señor.
SR. GÓMEZ. ¿Cómo está?
ANA. Bien.`),
    ).toEqual(['SR. GÓMEZ: Hola.', 'ANA: Hola, señor.', 'SR. GÓMEZ: ¿Cómo está?', 'ANA: Bien.'])
  })

  it('reconoce el nombre solo en una línea (formato guion de cine)', () => {
    expect(
      summary(`PEDRO
No sé qué decirte.

LUCÍA
Entonces no digas nada.

Pedro se va.

PEDRO
Adiós.`),
    ).toEqual([
      'PEDRO: No sé qué decirte.',
      'LUCÍA: Entonces no digas nada.',
      '[direction] Pedro se va.',
      'PEDRO: Adiós.',
    ])
  })

  it('una acotación en medio de un parlamento no corta al personaje', () => {
    expect(
      summary(`JUAN.— Ya voy.
(Se sienta.)
No me mires así.
MARÍA.— (Larga pausa. Lo mira
fijo.) Te miro como quiero.`),
    ).toEqual([
      'JUAN: Ya voy.',
      '[direction] (Se sienta.)',
      'JUAN: No me mires así.',
      'MARÍA: (Larga pausa. Lo mira fijo.) Te miro como quiero.',
    ])
  })

  it('no confunde palabras de escena con personajes', () => {
    const s = parse(`JUAN.— Chau.

TELÓN.

ESCENA II

JUAN.— Volví.`)
    expect(charactersOf(s)).toEqual([{ name: 'JUAN', lines: 2 }])
  })

  it('no toma frases con dos puntos como personajes', () => {
    const s = parse(`ANA: Mirá esto: es increíble.
ANA: Escuchame: no.`)
    expect(charactersOf(s)).toEqual([{ name: 'ANA', lines: 2 }])
  })
})

// En las pruebas, *texto* representa texto en cursiva del PDF.
const italics = (text: string) =>
  plainTextToLines(text).map((l) => ({ ...l, text: l.text.replace(/\*([^*]*)\*/g, `${IT_OPEN}$1${IT_CLOSE}`) }))
const show = (s: string) => s.replace(new RegExp(IT_OPEN, 'g'), '*').replace(new RegExp(IT_CLOSE, 'g'), '*')

describe('didascalias en cursiva', () => {
  it('una línea en cursiva es una didascalia y no corta al personaje', () => {
    const s = parseScript(
      italics(`*Una sala humilde. Es de noche.*
*Entra Juan.*
JUAN.— Ya voy.
*Se sienta y la mira*
*largamente.*
No me mires así.
MARÍA.— *Sin mirarlo.* Te miro
como quiero.`),
    )
    expect(s.blocks.map((b) => (b.kind === 'dialogue' ? `${b.character}: ${show(b.text)}` : `[${b.kind}] ${show(b.text)}`))).toEqual([
      '[direction] *Una sala humilde. Es de noche. Entra Juan.*',
      'JUAN: Ya voy.',
      '[direction] *Se sienta y la mira largamente.*',
      'JUAN: No me mires así.',
      'MARÍA: *Sin mirarlo.* Te miro como quiero.',
    ])
  })

  it('la cursiva dentro de un parlamento no se dice', () => {
    const [b] = parseScript(italics('JUAN.— Hola *(sonríe)* y *se va* chau.')).blocks
    expect(stripInlineDirections(b.text)).toBe('Hola y chau.')
    expect(segments(b.text)).toEqual([
      { direction: false, text: 'Hola ' },
      { direction: true, text: '(sonríe)' },
      { direction: false, text: ' y ' },
      { direction: true, text: 'se va' },
      { direction: false, text: ' chau.' },
    ])
  })

  it('una línea en cursiva que parece un nombre no es un personaje', () => {
    const s = parseScript(italics(`ANA: Hola.
*OSCURIDAD: todo se apaga.*
ANA: Chau.
*OSCURIDAD: vuelve.*`))
    expect(charactersOf(s)).toEqual([{ name: 'ANA', lines: 2 }])
  })
})

describe('stripInlineDirections', () => {
  it('quita las acotaciones entre paréntesis', () => {
    expect(stripInlineDirections('(Entrando.) Madre, yo (pausa) no quería .')).toBe('Madre, yo no quería.')
  })
})

describe('removePageFurniture', () => {
  it('quita números de página y encabezados repetidos', () => {
    const last = ['', 'Bueno.', 'Chau.', 'Listo.', 'Vamos.']
    const lines = [1, 2, 3, 4].flatMap((page) => [
      { text: 'La casa de Bernarda Alba', page, gapBefore: true },
      { text: 'ANA.— Hola.', page, gapBefore: false },
      { text: 'JUAN.— Sí.', page, gapBefore: false },
      { text: `JUAN.— Línea ${page}`, page, gapBefore: false },
      { text: 'ANA.— No.', page, gapBefore: false },
      { text: `JUAN.— ${last[page]}`, page, gapBefore: false },
      { text: `- ${page} -`, page, gapBefore: true },
    ])
    expect(removePageFurniture(lines, 4).map((l) => l.text)).toEqual(
      [1, 2, 3, 4].flatMap((page) => ['ANA.— Hola.', 'JUAN.— Sí.', `JUAN.— Línea ${page}`, 'ANA.— No.', `JUAN.— ${last[page]}`]),
    )
  })
})
