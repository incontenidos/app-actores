import type { PlayerStatus } from '../hooks/usePlayer'

interface Props {
  status: PlayerStatus
  current: number
  total: number
  rate: number
  onRate: (rate: number) => void
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onPrev: () => void
  onNext: () => void
}

export function PlayerBar({ status, current, total, rate, onRate, onPlay, onPause, onResume, onPrev, onNext }: Props) {
  return (
    <div className="player">
      <div className="player-buttons">
        <button className="icon" onClick={onPrev} aria-label="Anterior" title="Anterior">
          ⏮
        </button>
        {status === 'idle' ? (
          <button className="primary round" onClick={onPlay} aria-label="Reproducir" title="Reproducir (espacio)">
            ▶
          </button>
        ) : (
          <button className="primary round" onClick={onPause} aria-label="Pausa" title="Pausa">
            ⏸
          </button>
        )}
        <button className="icon" onClick={onNext} aria-label="Siguiente" title="Siguiente">
          ⏭
        </button>
      </div>
      {status === 'waiting' && (
        <button className="continue" onClick={onResume} title="Barra espaciadora">
          Ya dije mi texto → Continuar
        </button>
      )}
      <div className="player-info">
        <span className="muted small">
          {Math.min(current + 1, total)} / {total}
        </span>
        <label className="small rate">
          Velocidad {rate.toFixed(2).replace(/\.?0+$/, '')}×
          <input type="range" min={0.6} max={1.8} step={0.05} value={rate} onChange={(e) => onRate(Number(e.target.value))} />
        </label>
      </div>
    </div>
  )
}
