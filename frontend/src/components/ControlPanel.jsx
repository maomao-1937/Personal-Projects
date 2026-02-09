import { motion } from 'framer-motion'

const controls = [
  { key: 'aggressiveness', label: 'Beat Aggressiveness', desc: 'How tightly cuts snap to beats' },
  { key: 'motionBias', label: 'Motion Bias', desc: 'Prefer high-motion vs. static clips' },
  { key: 'sensitivity', label: 'Sensitivity', desc: 'Beat detection threshold' },
]

function Slider({ label, desc, value, onChange }) {
  return (
    <div style={{ padding: '0.75rem 0' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
        <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</label>
        <span className="text-xs font-mono" style={{ color: '#06b6d4' }}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem' }}>{desc}</p>
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
      className="glass-card"
      style={{ padding: '1.75rem' }}
    >
      <h2
        className="text-xs tracking-widest uppercase"
        style={{
          fontFamily: 'var(--font-display)',
          color: '#a855f7',
          marginBottom: '0.5rem',
          letterSpacing: '0.2em',
        }}
      >
        Controls
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {controls.map((ctrl, i) => (
          <div key={ctrl.key}>
            <Slider
              label={ctrl.label}
              desc={ctrl.desc}
              value={settings[ctrl.key]}
              onChange={update(ctrl.key)}
            />
            {i < controls.length - 1 && (
              <div style={{ height: 1, background: 'rgba(168,85,247,0.08)', margin: '0.25rem 0' }} />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
