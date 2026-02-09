import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ASCIIBackground from './components/ASCIIBackground'
import ParticleField from './components/ParticleField'
import AmbientScene from './components/AmbientScene'
import UploadCard from './components/UploadCard'
import ControlPanel from './components/ControlPanel'

const STAGES = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
}

export default function App() {
  const [stage, setStage] = useState(STAGES.UPLOAD)
  const [videoFile, setVideoFile] = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [settings, setSettings] = useState({
    aggressiveness: 50,
    motionBias: 50,
    sensitivity: 50,
  })
  const [logs, setLogs] = useState([])

  const hasVideo = videoFile || videoUrl
  const hasAudio = audioFile || audioUrl

  const handleProcess = () => {
    if (!hasVideo || !hasAudio) return
    setStage(STAGES.PROCESSING)
    setLogs([])

    const messages = [
      '> initializing engine...',
      videoUrl ? '> fetching video from YouTube...' : '> loading video source...',
      audioUrl ? '> fetching audio from YouTube...' : '> loading audio source...',
      '> analyzing audio waveform...',
      '> detecting BPM and beat grid...',
      '> mapping scene boundaries...',
      '> calculating motion vectors...',
      '> aligning cuts to downbeats...',
      '> rendering timeline...',
      '> encoding output (H.264)...',
      '> complete.',
    ]

    messages.forEach((msg, i) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, msg])
        if (i === messages.length - 1) {
          setTimeout(() => setStage(STAGES.COMPLETE), 800)
        }
      }, (i + 1) * 600)
    })
  }

  const handleReset = () => {
    setStage(STAGES.UPLOAD)
    setVideoFile(null)
    setAudioFile(null)
    setVideoUrl('')
    setAudioUrl('')
    setLogs([])
  }

  return (
    <div className="relative min-h-screen">
      {/* Background layers */}
      <ASCIIBackground />
      <ParticleField />
      <AmbientScene />

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center px-6 py-12">
        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-16 mt-12"
        >
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-black tracking-widest mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span style={{ color: '#a855f7' }}>AUTO BEAT</span>
            <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 0.75rem' }}>//</span>
            <span style={{ color: '#06b6d4' }}>VIDEO ENGINE</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            AI-powered beat-synced video editing
          </p>
        </motion.header>

        {/* Stage content */}
        <AnimatePresence mode="wait">
          {stage === STAGES.UPLOAD && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-4xl"
              style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
            >
              {/* Upload cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <UploadCard
                  label="Video"
                  accept={{ 'video/*': ['.mp4', '.mov', '.avi', '.mkv'] }}
                  icon="film"
                  file={videoFile}
                  url={videoUrl}
                  onFile={setVideoFile}
                  onUrl={setVideoUrl}
                />
                <UploadCard
                  label="Music"
                  accept={{ 'audio/*': ['.mp3', '.wav', '.flac', '.aac'] }}
                  icon="music"
                  file={audioFile}
                  url={audioUrl}
                  onFile={setAudioFile}
                  onUrl={setAudioUrl}
                />
              </div>

              {/* Controls */}
              <ControlPanel settings={settings} onChange={setSettings} />

              {/* Process button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleProcess}
                disabled={!hasVideo || !hasAudio}
                style={{
                  width: '100%',
                  padding: '1.1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-display)',
                  background: (!hasVideo || !hasAudio)
                    ? 'rgba(168,85,247,0.15)'
                    : 'linear-gradient(135deg, #a855f7, #06b6d4)',
                  color: (!hasVideo || !hasAudio) ? 'rgba(255,255,255,0.2)' : '#fff',
                  cursor: (!hasVideo || !hasAudio) ? 'not-allowed' : 'pointer',
                  boxShadow: (!hasVideo || !hasAudio)
                    ? 'none'
                    : '0 0 40px rgba(168,85,247,0.3), 0 0 80px rgba(168,85,247,0.1)',
                  transition: 'box-shadow 0.3s, background 0.3s',
                }}
              >
                Process
              </motion.button>
            </motion.div>
          )}

          {stage === STAGES.PROCESSING && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-2xl"
            >
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: '#a855f7',
                    fontSize: '0.8rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: '1.25rem',
                  }}
                >
                  Processing
                </h2>
                <div
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '0.5rem',
                    padding: '1.25rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    minHeight: '280px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  {logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        color: log.includes('complete') ? '#4ade80' : 'rgba(6,182,212,0.7)',
                      }}
                    >
                      {log}
                    </motion.div>
                  ))}
                  {logs.length > 0 && !logs[logs.length - 1]?.includes('complete') && (
                    <span
                      className="animate-pulse"
                      style={{ display: 'inline-block', width: 8, height: 16, background: '#06b6d4' }}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {stage === STAGES.COMPLETE && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-2xl"
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              {/* Preview */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: '#06b6d4',
                    fontSize: '0.8rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: '1.25rem',
                  }}
                >
                  Output Preview
                </h2>
                <div
                  style={{
                    aspectRatio: '16/9',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>
                    [ video preview — backend required ]
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    flex: 1,
                    padding: '0.85rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 0 30px rgba(168,85,247,0.3)',
                  }}
                >
                  Download MP4
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                  style={{
                    flex: 1,
                    padding: '0.85rem',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(168,85,247,0.3)',
                    background: 'transparent',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    color: '#a855f7',
                    cursor: 'pointer',
                  }}
                >
                  New Project
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          style={{
            marginTop: 'auto',
            paddingTop: '4rem',
            paddingBottom: '1rem',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.1)',
            fontSize: '0.7rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          v1.2.0 — auto beat video engine
        </motion.footer>
      </div>
    </div>
  )
}
