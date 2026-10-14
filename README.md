# 🎭 Ensayo — app para actores de teatro

Cargá el guion de una obra en PDF y escuchalo leído en voz alta, con una voz distinta para cada personaje.
Elegí tu personaje y la app se detiene en tus parlamentos para que los digas vos.

## Qué hace (primera versión)

- **Carga de PDF** (o `.txt`, o texto pegado). Se procesa en el navegador con [pdf.js](https://mozilla.github.io/pdf.js/): el archivo no se sube a ningún servidor.
- **Detecta personajes, parlamentos y acotaciones** en los formatos más comunes:
  `JUAN.— Hola`, `JUAN: Hola`, `JUAN. Hola`, `JUAN (bajo): Hola` o el nombre solo en una línea con el texto debajo.
  Quita números de página y encabezados repetidos.
- **Una voz por personaje**, asignada automáticamente (voces en castellano primero), con tono y velocidad ajustables y botón para probarla.
- **Modo ensayo**: elegís tu personaje y en tus parlamentos la app
  - *te espera* hasta que tocás "Continuar" (o la barra espaciadora),
  - *deja un silencio* del largo aproximado de tu texto, o
  - *los lee también*.

  Opción para **ocultar tu texto** (borroso) y memorizar.
- **Acotaciones**: se pueden leer con una voz de narrador o saltear; los paréntesis dentro de un parlamento se omiten al leer (configurable).
- **Correcciones a mano**: si la detección se equivoca, cada bloque tiene un ✎ para cambiar quién lo dice, y los personajes se pueden renombrar (o unir, poniendo el mismo nombre).
- **Recuerda** el guion, las voces y por dónde ibas (en el navegador, `localStorage`).
- Atajos: `espacio` reproducir / pausa / continuar · `←` `→` bloque anterior / siguiente. Doble clic en un bloque = leer desde ahí.

## Voces gratis

Usa la **Web Speech API** del navegador: sin costo, sin claves y sin límites.
Las voces disponibles dependen del navegador y del sistema:

| Dónde | Voces |
|---|---|
| Chrome (escritorio) | Voces de Google ("Google español", "Google español de Estados Unidos") + las del sistema |
| Android (Chrome) | Voces de Google del sistema (instalar/actualizar *Servicios de voz de Google* y descargar las voces en castellano) |
| Edge | Voces neuronales de Microsoft ("online"), muy naturales, con variantes de castellano (Argentina, México, España…) |
| Safari / iPhone | Voces de Apple (se pueden descargar más en Ajustes → Accesibilidad → Contenido leído) |

En Firefox para Linux suele no haber voces.

## Limitaciones conocidas

- Los PDFs **escaneados** (imagen, sin texto seleccionable) todavía no se pueden leer: haría falta OCR.
- La detección es heurística: con formatos muy raros puede confundir algún bloque (para eso está el ✎).

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # pruebas del detector de guiones
npm run lint
npm run build    # genera dist/, publicable en cualquier hosting estático (GitHub Pages, Netlify, Vercel…)
```

Estructura:

- `src/lib/pdf.ts`, `src/lib/pdfText.ts`: extracción de líneas del PDF.
- `src/lib/parser.ts`: detección de personajes, parlamentos y acotaciones.
- `src/lib/speech.ts`: voces, asignación automática y lectura.
- `src/hooks/usePlayer.ts`: reproducción del guion y modo ensayo.
- `src/components/`: interfaz.
