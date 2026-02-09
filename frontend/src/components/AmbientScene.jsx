import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function GlowOrb({ position, color, speed = 1, pulseSpeed = 1.2 }) {
  const meshRef = useRef()
  const lightRef = useRef()
  const baseColor = new THREE.Color(color)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // --- POSITION: continuous orbital drift ---
    const ts = t * speed
    meshRef.current.position.x = position[0] + Math.cos(ts * 0.7) * 1.5
    meshRef.current.position.y = position[1] + Math.sin(ts) * 1.0
    meshRef.current.position.z = position[2] + Math.sin(ts * 0.5) * 0.8

    // --- LIGHT INTENSITY: pulsing per frame ---
    const pulse = 0.5 + 0.5 * Math.sin(t * pulseSpeed)
    lightRef.current.intensity = 1.5 + pulse * 3.5

    // --- LIGHT COLOR: subtle hue rotation per frame ---
    const hsl = {}
    baseColor.getHSL(hsl)
    const shiftedHue = hsl.h + Math.sin(t * 0.4) * 0.05
    lightRef.current.color.setHSL(shiftedHue, hsl.s, hsl.l)

    // --- MESH SCALE: breathing effect ---
    const scale = 0.8 + 0.3 * Math.sin(t * pulseSpeed * 0.8)
    meshRef.current.scale.setScalar(scale)

    // --- MESH OPACITY: sync with pulse ---
    meshRef.current.material.opacity = 0.02 + 0.04 * pulse
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.04} depthWrite={false} />
      <pointLight ref={lightRef} color={color} intensity={3} distance={15} decay={2} />
    </mesh>
  )
}

export default function AmbientScene() {
  return (
    <div className="fixed inset-0 z-[2] pointer-events-none" style={{ opacity: 0.6 }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }} gl={{ alpha: true }}>
        <GlowOrb position={[-5, 3, 0]} color="#a855f7" speed={0.5} pulseSpeed={1.0} />
        <GlowOrb position={[5, -2, -3]} color="#06b6d4" speed={0.7} pulseSpeed={1.4} />
        <GlowOrb position={[0, -4, 1]} color="#3b82f6" speed={0.4} pulseSpeed={0.9} />
        <GlowOrb position={[3, 4, -1]} color="#ec4899" speed={0.6} pulseSpeed={1.1} />
      </Canvas>
    </div>
  )
}
