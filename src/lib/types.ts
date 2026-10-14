/** Una línea de texto tal como sale del PDF (o de un .txt). */
export interface RawLine {
  text: string
  page: number
  /** Hay un espacio vertical grande antes de esta línea (cambio de párrafo). */
  gapBefore: boolean
}

export type BlockKind = 'dialogue' | 'direction' | 'heading'

/** Un bloque del guion: un parlamento, una acotación o un título (acto/escena). */
export interface ScriptBlock {
  id: number
  kind: BlockKind
  /** Solo para parlamentos. */
  character?: string
  text: string
  page: number
}

export interface Script {
  title: string
  blocks: ScriptBlock[]
}

export interface VoiceSettings {
  /** voiceURI de SpeechSynthesisVoice; vacío = voz por defecto del navegador. */
  voiceURI: string
  pitch: number
  rate: number
}

/** Qué hace la app cuando le toca hablar al personaje del actor. */
export type MyLineMode = 'wait' | 'silence' | 'read'

export interface Settings {
  voices: Record<string, VoiceSettings>
  narrator: VoiceSettings
  readDirections: boolean
  /** Leer las acotaciones que van entre paréntesis dentro de un parlamento. */
  readInlineDirections: boolean
  myCharacter: string
  myLineMode: MyLineMode
  hideMyLines: boolean
  globalRate: number
}
