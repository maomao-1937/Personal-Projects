import { motion } from 'framer-motion'

const controls = [
  { key: 'aggressiveness', label: 'Beat Aggressiveness', desc: 'How tightly cuts snap to beats' },
  { key: 'motionBias', label: 'Motion Bias', desc: 'Prefer high-motion vs. static clips' },
  { key: 'sensitivity', label: 'Sensitivity', desc: 'Beat detection threshold' },
]

function Slider({ label, desc, value, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <label className="text-white/60 text-sm">{label}</label>
        <span className="text-neon-cyan text-xs font-mono">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer
          bg-white/10 accent-neon-purple
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-neon-purple
          [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.6)]"
      />
      <p className="text-white/20 text-xs">{desc}</p>
    </div>
  )
}

export default function ControlPanel({ settings, onChange }) {
  const update = (key) => (value) => onChange({ ...settings, [key]: value })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="rounded-2xl border border-cyber-border bg-cyber-card backdrop-blur-xl p-6 space-y-5"
    >
      <h2
        className="text-neon-purple text-xs tracking-[0.2em] uppercase"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Controls
      </h2>
      {controls.map((ctrl) => (
        <Slider
          key={ctrl.key}
          label={ctrl.label}
          desc={ctrl.desc}
          value={settings[ctrl.key]}
          onChange={update(ctrl.key)}
        />
      ))}
    </motion.div>
  )
}
