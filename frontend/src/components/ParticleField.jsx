import { useEffect, useState } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'

export default function ParticleField() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <Particles
      id="particle-field"
      className="fixed inset-0 z-[1] pointer-events-none"
      options={{
        fullScreen: false,
        fpsLimit: 60,
        particles: {
          number: { value: 50, density: { enable: true, width: 1920, height: 1080 } },
          color: { value: ['#a855f7', '#06b6d4', '#3b82f6'] },
          shape: { type: 'circle' },
          opacity: {
            value: { min: 0.1, max: 0.4 },
            animation: { enable: true, speed: 0.5, sync: false },
          },
          size: {
            value: { min: 1, max: 3 },
            animation: { enable: true, speed: 1, sync: false },
          },
          move: {
            enable: true,
            speed: 0.4,
            direction: 'none',
            random: true,
            straight: false,
            outModes: { default: 'out' },
          },
          links: {
            enable: true,
            distance: 120,
            color: '#a855f7',
            opacity: 0.06,
            width: 1,
          },
        },
        detectRetina: true,
      }}
    />
  )
}
