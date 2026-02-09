import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'

const icons = {
  film: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  music: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V4.846a2.25 2.25 0 0 0-1.632-2.163l-6.75-1.93a2.25 2.25 0 0 0-2.868 2.164v12.133a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 14.553Z" />
    </svg>
  ),
}

const ytIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
  </svg>
)

const fileIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
)

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)/

function isValidYouTubeUrl(url) {
  return YT_REGEX.test(url.trim())
}

export default function UploadCard({ label, accept, icon, file, url, onFile, onUrl }) {
  const [mode, setMode] = useState('file') // 'file' | 'url'
  const [urlInput, setUrlInput] = useState(url || '')
  const [urlError, setUrlError] = useState('')

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles: 1,
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        onFile(accepted[0])
        onUrl('')
        setUrlInput('')
        setUrlError('')
      }
    },
  })

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) {
      setUrlError('')
      onUrl('')
      return
    }
    if (!isValidYouTubeUrl(trimmed)) {
      setUrlError('Invalid YouTube URL')
      return
    }
    setUrlError('')
    onUrl(trimmed)
    onFile(null)
  }

  const handleUrlKeyDown = (e) => {
    if (e.key === 'Enter') handleUrlSubmit()
  }

  const handleUrlClear = () => {
    setUrlInput('')
    setUrlError('')
    onUrl('')
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setUrlError('')
  }

  const hasSource = file || url

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg bg-black/30 p-1 w-fit">
        <button
          onClick={() => switchMode('file')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
            mode === 'file'
              ? 'bg-neon-purple/20 text-neon-purple'
              : 'text-white/30 hover:text-white/50'
          }`}
        >
          {fileIcon}
          <span>File</span>
        </button>
        <button
          onClick={() => switchMode('url')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
            mode === 'url'
              ? 'bg-red-500/20 text-red-400'
              : 'text-white/30 hover:text-white/50'
          }`}
        >
          {ytIcon}
          <span>YouTube</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'file' ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            whileHover={{ scale: 1.01 }}
            {...getRootProps()}
            className={`
              relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer
              transition-all duration-300 backdrop-blur-xl
              ${isDragActive
                ? 'border-neon-cyan bg-neon-cyan/5 shadow-[0_0_30px_rgba(6,182,212,0.15)]'
                : file
                  ? 'border-neon-purple/40 bg-cyber-card'
                  : 'border-cyber-border bg-cyber-card hover:border-neon-purple/30'
              }
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div className={`${file ? 'text-neon-purple' : 'text-white/20'} transition-colors`}>
                {icons[icon]}
              </div>
              {file ? (
                <>
                  <p className="text-white/80 text-sm font-medium truncate max-w-full">
                    {file.name}
                  </p>
                  <p className="text-white/30 text-xs">{formatSize(file.size)}</p>
                </>
              ) : (
                <>
                  <p className="text-white/40 text-sm">
                    Drop <span className="text-neon-purple/70">{label}</span> file here
                  </p>
                  <p className="text-white/20 text-xs">or click to browse</p>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="url"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className={`
              relative rounded-2xl border-2 p-6 backdrop-blur-xl transition-all duration-300
              ${url
                ? 'border-red-500/40 bg-cyber-card'
                : 'border-cyber-border bg-cyber-card'
              }
            `}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className={`${url ? 'text-red-400' : 'text-white/20'} transition-colors`}>
                  {icons[icon]}
                </div>
                <span className="text-white/40 text-sm">
                  YouTube <span className="text-red-400/70">{label}</span>
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value)
                    setUrlError('')
                  }}
                  onKeyDown={handleUrlKeyDown}
                  onBlur={handleUrlSubmit}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5
                    text-sm text-white/80 placeholder-white/20
                    focus:outline-none focus:border-red-500/40 focus:shadow-[0_0_10px_rgba(239,68,68,0.1)]
                    transition-all"
                />
                {url && (
                  <button
                    onClick={handleUrlClear}
                    className="px-3 rounded-lg border border-white/10 text-white/30
                      hover:text-white/60 hover:border-white/20 transition-all text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {urlError && (
                <p className="text-red-400 text-xs">{urlError}</p>
              )}

              {url && !urlError && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400/70">URL ready</span>
                  <span className="text-white/20 truncate max-w-[200px]">{url}</span>
                </div>
              )}

              {!url && !urlError && (
                <p className="text-white/15 text-xs">
                  Paste a YouTube link and press Enter
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
