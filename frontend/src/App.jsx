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
      videoUrl ? `> fetching video from YouTube...` : '> loading video source...',
      audioUrl ? `> fetching audio from YouTube...` : '> loading audio source...',
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
      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 py-8">
        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-12 mt-8"
        >
          <h1
            className="text-4xl md:text-6xl font-black tracking-widest mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-neon-purple">AUTO BEAT</span>
            <span className="text-white/20 mx-3">//</span>
            <span className="text-neon-cyan">VIDEO ENGINE</span>
          </h1>
          <p className="text-white/30 text-sm tracking-[0.3em] uppercase">
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
              className="w-full max-w-4xl space-y-6"
            >
              {/* Upload cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                className="w-full py-4 rounded-xl font-bold text-lg tracking-wider uppercase
                  bg-gradient-to-r from-neon-purple to-neon-cyan
                  text-white shadow-[0_0_30px_rgba(168,85,247,0.3)]
                  disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
                  transition-shadow hover:shadow-[0_0_50px_rgba(168,85,247,0.5)]"
                style={{ fontFamily: 'var(--font-display)' }}
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
              <div className="rounded-2xl border border-cyber-border bg-cyber-card backdrop-blur-xl p-6">
                <h2
                  className="text-neon-purple text-sm tracking-[0.2em] uppercase mb-4"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Processing
                </h2>
                <div className="bg-black/50 rounded-lg p-4 font-mono text-sm space-y-1 min-h-[240px]">
                  {logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={
                        log.includes('complete')
                          ? 'text-green-400'
                          : 'text-neon-cyan/70'
                      }
                    >
                      {log}
                    </motion.div>
                  ))}
                  {logs.length > 0 && !logs[logs.length - 1]?.includes('complete') && (
                    <span className="inline-block w-2 h-4 bg-neon-cyan animate-pulse" />
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
              className="w-full max-w-2xl space-y-6"
            >
              {/* Preview */}
              <div className="rounded-2xl border border-cyber-border bg-cyber-card backdrop-blur-xl p-6">
                <h2
                  className="text-neon-cyan text-sm tracking-[0.2em] uppercase mb-4"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Output Preview
                </h2>
                <div className="aspect-video bg-black/60 rounded-lg flex items-center justify-center border border-white/5">
                  <span className="text-white/20 text-sm">
                    [ video preview — backend required ]
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-3 rounded-xl font-bold tracking-wider uppercase
                    bg-gradient-to-r from-neon-purple to-neon-cyan text-white
                    shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Download MP4
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                  className="flex-1 py-3 rounded-xl font-bold tracking-wider uppercase
                    border border-neon-purple/30 text-neon-purple
                    hover:bg-neon-purple/10 transition-colors"
                  style={{ fontFamily: 'var(--font-display)' }}
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
          className="mt-auto pt-12 pb-4 text-center text-white/10 text-xs tracking-widest uppercase"
        >
          v1.1.0 — auto beat video engine
        </motion.footer>
      </div>
    </div>
  )
}
