import { useEffect, useRef } from 'react'

const CHARS = '░▒▓█><\\/|_·.:'
const FONT_SIZE = 14
const OPACITY = 0.08

export default function ASCIIBackground() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let cols, rows, grid

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      cols = Math.ceil(canvas.width / FONT_SIZE)
      rows = Math.ceil(canvas.height / FONT_SIZE)
      grid = Array.from({ length: cols * rows }, () =>
        CHARS[Math.floor(Math.random() * CHARS.length)]
      )
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`
      ctx.textBaseline = 'top'

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = y * cols + x
          const wave = Math.sin((x + time * 0.0005) * 0.15) *
                       Math.cos((y + time * 0.0003) * 0.12)
          const alpha = OPACITY * (0.3 + 0.7 * ((wave + 1) / 2))

          // Randomly swap characters occasionally
          if (Math.random() < 0.0003) {
            grid[idx] = CHARS[Math.floor(Math.random() * CHARS.length)]
          }

          ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`
          ctx.fillText(grid[idx], x * FONT_SIZE, y * FONT_SIZE)
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
      style={{ opacity: 1 }}
    />
  )
}
