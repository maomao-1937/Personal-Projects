import { useEffect, useRef } from 'react'

// Light, airy characters — NO heavy blocks like ░▒▓█
const CHARS = '·.:-=+*#>/<\\|_~^'
const CHAR_COUNT = CHARS.length
const FONT_SIZE = 18
const BASE_ALPHA = 0.045
const CELL_GAP = 1.4 // multiplier — spaces out the grid so it's not a wall of text

export default function ASCIIBackground() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const stateRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const buildGrid = () => {
      const spacing = FONT_SIZE * CELL_GAP
      const cols = Math.ceil(canvas.width / spacing)
      const rows = Math.ceil(canvas.height / spacing)
      const cells = new Array(cols * rows)
      for (let i = 0; i < cells.length; i++) {
        cells[i] = {
          charPhase: Math.random() * Math.PI * 2,
          wavePhase: Math.random() * Math.PI * 2,
          hueShift: Math.random() * 30 - 15,
          cycleSpeed: 0.15 + Math.random() * 0.6,
          glitchSeed: Math.random(),
        }
      }
      stateRef.current = { cols, rows, cells, spacing }
    }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      buildGrid()
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = (time) => {
      const { cols, rows, cells, spacing } = stateRef.current
      const t = time * 0.001

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x
          const cell = cells[idx]

          // Character: slow sine cycling
          const charWave = Math.sin(t * cell.cycleSpeed + cell.charPhase)
          const charIdx = Math.floor(((charWave + 1) / 2) * (CHAR_COUNT - 0.01))
          let ch = CHARS[charIdx]

          // Glitch: rare and brief
          const glitchCycle = Math.sin(t * 0.5 + cell.glitchSeed * 80)
          if (glitchCycle > 0.95) {
            ch = CHARS[Math.floor(Math.random() * CHAR_COUNT)]
          }

          // Alpha: gentle undulating wave
          const wave1 = Math.sin(x * 0.25 + y * 0.18 + t * 0.4 + cell.wavePhase)
          const wave2 = Math.cos(x * 0.1 - y * 0.22 + t * 0.25)
          const combined = (wave1 + wave2) / 2
          const alpha = BASE_ALPHA * (0.2 + 0.8 * ((combined + 1) / 2))

          // Color: soft purple/blue range
          const hue = 265 + cell.hueShift + Math.sin(t * 0.2 + cell.wavePhase) * 10
          ctx.fillStyle = `hsla(${hue}, 60%, 65%, ${alpha})`
          ctx.fillText(ch, x * spacing + spacing / 2, y * spacing + spacing / 2)
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  )
}
