import { isSpanish, sortVoices } from '../lib/speech'

interface Props {
  value: string
  voices: SpeechSynthesisVoice[]
  showAll: boolean
  onChange: (voiceURI: string) => void
  label?: string
}

export function VoiceSelect({ value, voices, showAll, onChange, label }: Props) {
  const sorted = sortVoices(voices)
  const spanish = sorted.filter(isSpanish)
  const others = sorted.filter((v) => !isSpanish(v))
  // Si la voz elegida es de otro idioma, la mostramos igual.
  const selectedOther = others.find((v) => v.voiceURI === value)
  const option = (v: SpeechSynthesisVoice) => (
    <option key={v.voiceURI} value={v.voiceURI}>
      {v.name} ({v.lang}){v.localService ? '' : ' · online'}
    </option>
  )
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Voz por defecto</option>
      {spanish.length > 0 && <optgroup label="Castellano">{spanish.map(option)}</optgroup>}
      {(showAll || spanish.length === 0) && others.length > 0 && (
        <optgroup label="Otros idiomas">{others.map(option)}</optgroup>
      )}
      {!showAll && spanish.length > 0 && selectedOther && option(selectedOther)}
    </select>
  )
}
