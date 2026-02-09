import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'

const icons = {
  film: (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  music: (
    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V4.846a2.25 2.25 0 0 0-1.632-2.163l-6.75-1.93a2.25 2.25 0 0 0-2.868 2.164v12.133a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 14.553Z" />
    </svg>
  ),
}

const ytIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
  </svg>
)

const fileIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
  const [mode, setMode] = useState('file')
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
    if (!trimmed) { setUrlError(''); onUrl(''); return }
    if (!isValidYouTubeUrl(trimmed)) { setUrlError('Invalid YouTube URL'); return }
    setUrlError('')
    onUrl(trimmed)
    onFile(null)
  }

  const handleUrlKeyDown = (e) => { if (e.key === 'Enter') handleUrlSubmit() }

  const handleUrlClear = () => { setUrlInput(''); setUrlError(''); onUrl('') }

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: 'rgba(0,0,0,0.4)' }}
      >
        <button
          onClick={() => { setMode('file'); setUrlError('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all"
          style={mode === 'file'
            ? { background: 'rgba(168,85,247,0.2)', color: '#a855f7' }
            : { color: 'rgba(255,255,255,0.3)' }
          }
        >
          {fileIcon}
          <span>File</span>
        </button>
        <button
          onClick={() => { setMode('url'); setUrlError('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all"
          style={mode === 'url'
            ? { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
            : { color: 'rgba(255,255,255,0.3)' }
          }
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
            {...getRootProps()}
            className={`cursor-pointer transition-all duration-300 ${file ? 'glass-card-active' : 'glass-card'}`}
            style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              borderStyle: 'dashed',
              borderWidth: '2px',
              borderColor: isDragActive
                ? 'rgba(6,182,212,0.5)'
                : file
                  ? 'rgba(168,85,247,0.35)'
                  : 'rgba(168,85,247,0.12)',
              boxShadow: isDragActive
                ? '0 0 30px rgba(6,182,212,0.1)'
                : file
                  ? '0 0 20px rgba(168,85,247,0.08)'
                  : 'none',
            }}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div style={{ color: file ? '#a855f7' : 'rgba(255,255,255,0.15)' }}>
                {icons[icon]}
              </div>
              {file ? (
                <>
                  <p className="text-sm font-medium truncate max-w-full" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {file.name}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{formatSize(file.size)}</p>
                </>
              ) : (
                <>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Drop <span style={{ color: 'rgba(168,85,247,0.7)' }}>{label}</span> file here
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>or click to browse</p>
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
            className={url ? 'glass-card-active' : 'glass-card'}
            style={{
              padding: '1.5rem',
              borderColor: url ? 'rgba(239,68,68,0.3)' : undefined,
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div style={{ color: url ? '#f87171' : 'rgba(255,255,255,0.15)' }}>
                  {icons[icon]}
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  YouTube <span style={{ color: 'rgba(248,113,113,0.7)' }}>{label}</span>
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setUrlError('') }}
                  onKeyDown={handleUrlKeyDown}
                  onBlur={handleUrlSubmit}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 text-sm"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0.5rem',
                    padding: '0.625rem 0.75rem',
                    color: 'rgba(255,255,255,0.8)',
                    outline: 'none',
                  }}
                />
                {url && (
                  <button
                    onClick={handleUrlClear}
                    className="text-xs"
                    style={{
                      padding: '0 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.3)',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {urlError && <p className="text-xs" style={{ color: '#f87171' }}>{urlError}</p>}
              {url && !urlError && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                  <span style={{ color: 'rgba(74,222,128,0.7)' }}>URL ready</span>
                  <span className="truncate" style={{ color: 'rgba(255,255,255,0.2)', maxWidth: 200 }}>{url}</span>
                </div>
              )}
              {!url && !urlError && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
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
