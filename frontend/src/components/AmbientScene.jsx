import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

function GlowOrb({ position, color, speed = 1 }) {
  const ref = useRef()

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed
    ref.current.position.y = position[1] + Math.sin(t) * 0.5
    ref.current.position.x = position[0] + Math.cos(t * 0.7) * 0.3
  })

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.8, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.04} />
      <pointLight color={color} intensity={2} distance={12} decay={2} />
    </mesh>
  )
}

export default function AmbientScene() {
  return (
    <div className="fixed inset-0 z-[2] pointer-events-none" style={{ opacity: 0.6 }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
        <GlowOrb position={[-4, 2, 0]} color="#a855f7" speed={0.6} />
        <GlowOrb position={[4, -1, -2]} color="#06b6d4" speed={0.8} />
        <GlowOrb position={[0, -3, 1]} color="#3b82f6" speed={0.5} />
      </Canvas>
    </div>
  )
}
