import { useEffect, useRef } from 'react'

const CHARS = '░▒▓█><\\/|_·.:'
const CHAR_COUNT = CHARS.length
const FONT_SIZE = 14
const BASE_ALPHA = 0.09

// Each cell cycles through characters on its own timer
// driven by deterministic math so every cell visibly updates every frame

export default function ASCIIBackground() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const stateRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let cols, rows, cells

    // Per-cell state: phase offsets for character cycling, wave, and color
    const buildGrid = () => {
      cols = Math.ceil(canvas.width / FONT_SIZE)
      rows = Math.ceil(canvas.height / FONT_SIZE)
      cells = new Array(cols * rows)
      for (let i = 0; i < cells.length; i++) {
        cells[i] = {
          charPhase: Math.random() * Math.PI * 2,   // offset for char cycling
          wavePhase: Math.random() * Math.PI * 2,    // offset for alpha wave
          hueShift: Math.random() * 40 - 20,         // subtle color variation ±20
          cycleSpeed: 0.3 + Math.random() * 1.2,     // how fast this cell cycles chars
          glitchSeed: Math.random(),                  // for glitch bursts
        }
      }
      stateRef.current = { cols, rows, cells }
    }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      buildGrid()
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = (time) => {
      const { cols, rows, cells } = stateRef.current
      const t = time * 0.001 // seconds

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`
      ctx.textBaseline = 'top'

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x
          const cell = cells[idx]

          // --- CHARACTER: deterministic per-frame cycling ---
          // Every cell picks a character based on time + its unique phase
          const charWave = Math.sin(t * cell.cycleSpeed + cell.charPhase)
          // Map sine [-1,1] to char index [0, CHAR_COUNT-1]
          const charIdx = Math.floor(((charWave + 1) / 2) * (CHAR_COUNT - 0.01))
          const ch = CHARS[charIdx]

          // --- GLITCH: periodic burst where char randomizes rapidly ---
          const glitchCycle = Math.sin(t * 0.7 + cell.glitchSeed * 100)
          const inGlitch = glitchCycle > 0.92
          const finalChar = inGlitch
            ? CHARS[Math.floor(Math.random() * CHAR_COUNT)]
            : ch

          // --- ALPHA: multi-frequency wave so every cell visibly shifts ---
          const wave1 = Math.sin((x * 0.18) + (y * 0.12) + t * 0.8 + cell.wavePhase)
          const wave2 = Math.cos((x * 0.07) - (y * 0.15) + t * 0.5)
          const combined = (wave1 + wave2) / 2 // [-1, 1]
          const alpha = BASE_ALPHA * (0.15 + 0.85 * ((combined + 1) / 2))

          // --- COLOR: base purple with per-cell hue drift ---
          const hue = 270 + cell.hueShift + Math.sin(t * 0.3 + cell.wavePhase) * 15
          const sat = inGlitch ? 100 : 70
          const light = inGlitch ? 75 : 65

          ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
          ctx.fillText(finalChar, x * FONT_SIZE, y * FONT_SIZE)
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
