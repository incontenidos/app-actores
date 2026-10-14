/** Un tono de color estable por personaje, para reconocerlo de un vistazo. */
export function characterHue(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h * 137.508) % 360
}
