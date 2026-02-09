import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'

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

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

export default function UploadCard({ label, accept, icon, file, onFile }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles: 1,
    onDrop: (accepted) => {
      if (accepted.length > 0) onFile(accepted[0])
    },
  })

  return (
    <motion.div
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
  )
}
