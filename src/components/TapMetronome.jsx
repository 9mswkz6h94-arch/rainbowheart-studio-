import { useState, useRef } from 'react'

export default function TapMetronome({ onTempoChange, currentTempo }) {
  const [taps, setTaps] = useState([])
  const [isTapping, setIsTapping] = useState(false)
  const resetTimeoutRef = useRef(null)

  function handleTap() {
    const now = Date.now()
    const newTaps = [...taps, now].slice(-3)
    setTaps(newTaps)
    setIsTapping(true)

    clearTimeout(resetTimeoutRef.current)
    resetTimeoutRef.current = setTimeout(() => {
      setTaps([])
      setIsTapping(false)
    }, 3000)

    if (newTaps.length >= 2) {
      const intervals = []
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1])
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const bpm = Math.round(60000 / avgInterval)

      if (bpm >= 40 && bpm <= 300) {
        onTempoChange(bpm.toString())
      }
    }
  }

  return (
    <button
      className={`cc-tap-btn${isTapping ? ' active' : ''}`}
      onClick={handleTap}
      title={`Tap to beat · ${taps.length} tap${taps.length !== 1 ? 's' : ''}`}
      style={{
        padding: '6px 12px',
        fontSize: '12px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        background: isTapping ? '#e8f5e9' : '#f5f5f5',
        cursor: 'pointer',
        fontWeight: isTapping ? 'bold' : 'normal',
        transition: 'all 0.15s ease',
      }}
    >
      🎵 {taps.length > 0 ? `Tap (${taps.length})` : 'Tap'}
    </button>
  )
}
