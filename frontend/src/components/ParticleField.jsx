import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 80
const LINK_DISTANCE = 140
const LINK_ALPHA = 0.06
const COLORS = ['#a855f7', '#06b6d4', '#3b82f6']

// Each particle is a real object with position, velocity, size, opacity, color
function createParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    radius: 1 + Math.random() * 2,
    opacity: 0.1 + Math.random() * 0.3,
    opacityDir: (Math.random() < 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.004),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
}

export default function ParticleField() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let particles = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      // Re-seed particles on resize
      particles = Array.from({ length: PARTICLE_COUNT }, () =>
        createParticle(canvas.width, canvas.height)
      )
    }

    resize()
    window.addEventListener('resize', resize)

    const update = () => {
      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      // --- UPDATE: apply velocity, bounce off edges, animate opacity ---
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Position update
        p.x += p.vx
        p.y += p.vy

        // Wrap around edges
        if (p.x < -10) p.x = w + 10
        else if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        else if (p.y > h + 10) p.y = -10

        // Oscillate opacity
        p.opacity += p.opacityDir
        if (p.opacity >= 0.45) { p.opacity = 0.45; p.opacityDir *= -1 }
        if (p.opacity <= 0.08) { p.opacity = 0.08; p.opacityDir *= -1 }
      }

      // --- RENDER LINKS: draw lines between nearby particles ---
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINK_DISTANCE) {
            const alpha = LINK_ALPHA * (1 - dist / LINK_DISTANCE)
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // --- RENDER PARTICLES: draw each as a filled circle with glow ---
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Soft glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2)
        ctx.fillStyle = p.color.replace(')', `, ${p.opacity * 0.15})`)
          .replace('rgb', 'rgba')
          .replace('#', '')
        // Convert hex to rgba for glow
        const r = parseInt(p.color.slice(1, 3), 16)
        const g = parseInt(p.color.slice(3, 5), 16)
        const b = parseInt(p.color.slice(5, 7), 16)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity * 0.12})`
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(update)
    }

    animRef.current = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[1] pointer-events-none"
    />
  )
}
