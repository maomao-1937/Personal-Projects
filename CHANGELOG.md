# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [3.0.0a1] - 2026-08-28

### Added
- SQLite-backed Project, Job, Event, Audio, Storyboard, Cut, Timeline, Preview and Export state.
- Invite authentication, owner isolation and safe local Artifact storage.
- Provider abstractions for librosa, OpenAI Compatible Storyboard, Ark Seedance and FFmpeg.
- Independent Cut retry/regenerate semantics with partial-success aggregation.
- Immutable TimelineVersion and stale Preview/Export enforcement.
- Persistent SSE replay and startup recovery.
- Minimal backend acceptance page and Python 3.11 pytest suite.

### Changed
- Backend version and run command now have one documented source of truth.
- 16:9 and 9:16 exports are independent H.264/AAC MP4 tasks.

### Known issue
- Seedance real smoke creation was rejected by Ark with HTTP 400 and no task ID; account-side activation/balance/policy requires verification before a paid retry.

## [2.0.1] - 2026-02-09

### Fixed
- **Beat-sync algorithm**: complete rewrite to guarantee every segment jumps to a different source location (100% visible cuts vs 3% before)
- **Frame-grid snapping**: cut times and source positions snapped to the video frame boundary, eliminating accumulated timestamp drift across segments (drift reduced from 196ms to 98ms median)
- **Exporter**: single-pass `filter_complex_script` with `start/end` trim (instead of `duration`) and `video_track_timescale=90000` for sub-millisecond timing precision
- **Source coverage**: golden ratio spread algorithm covers 90%+ of source video instead of biasing toward first 10 seconds
- **Musical scoring**: beats ranked by energy (RMS) + onset strength + downbeat bonus; only musically significant beats trigger cuts
- **Anti-repetition**: proximity penalties and forced jumps prevent reusing the same source region consecutively

### Added
- `verify_sync.py`: beat-sync verification tool that measures actual visual cut alignment against beat grid using FFmpeg scene detection
- `test_pipeline.py`: end-to-end pipeline test (download, analyze, sync, export, verify)
- `_ensure_jump()`, `_pick_source_location()`, `_build_interest_map()` functions in beat_sync module

### Verified
- 93% of visual cuts land within 1/4 beat interval (183ms tolerance)
- 98ms median drift, stable across all time quarters
- 100/100 verification score (beat alignment + duration match + drift stability)

## [2.0.0] - 2026-02-09

### Added
- **Full backend** with FastAPI, uvicorn, CORS, SSE streaming
- **Audio analysis pipeline**: librosa-based BPM detection, beat tracking, onset strength, RMS energy curves
- **Video analysis pipeline**: FFmpeg scene detection (`select` filter), motion estimation via frame differencing at low-res
- **Beat-sync algorithm**: aggressiveness controls cut density (downbeats → sub-beats), motionBias selects high-motion windows, sensitivity tunes beat detection tightness; candidates scored by motion + energy + scene proximity
- **Export pipeline**: FFmpeg segment trimming (libx264 CRF 18), concat demuxer, AAC audio mux, faststart
- **YouTube download**: yt-dlp integration for both video and audio URLs
- **Job system**: in-memory job store with asyncio.Queue for real-time SSE log streaming
- **API endpoints**: POST `/api/process`, GET `/api/status/{job_id}` (SSE), GET `/api/download/{job_id}`
- **Real-time progress**: percentage bar + live terminal log in processing view
- **Video preview**: `<video>` tag with controls on completion screen
- **Working download**: actual MP4 file served via FileResponse
- **Error handling**: red error logs + "Try Again" button on failure
- Vite dev proxy (`/api` → `localhost:8000`)

### Changed
- `App.jsx` rewritten: mock setTimeout replaced with real `fetch` + `EventSource` API calls
- Footer version updated to v2.0.0

### Dependencies (backend)
- fastapi, uvicorn[standard], python-multipart, pydantic
- librosa, numpy, soundfile
- yt-dlp, aiofiles

## [1.2.0] - 2026-02-09

### Changed
- **ASCIIBackground**: Every cell now deterministically cycles characters per frame via sine-driven indexing; per-cell phase offsets, multi-frequency alpha waves, hue drift, and periodic glitch bursts
- **ParticleField**: Replaced tsParticles library with custom Canvas 2D particle system — 80 real particle objects each with explicit `x/y/vx/vy/radius/opacity`, updated and rendered every frame in a `requestAnimationFrame` loop; inter-particle link lines drawn when distance < threshold
- **AmbientScene**: Added per-frame light intensity pulsing, hue rotation, mesh scale breathing, opacity sync; added 4th orb (neon pink); wider orbital drift paths

### Removed
- `@tsparticles/react` and `@tsparticles/slim` dependencies (replaced by hand-rolled Canvas 2D)

## [1.1.0] - 2026-02-09

### Added
- YouTube URL input mode for both Video and Music upload cards
- File/YouTube toggle switch on each UploadCard
- YouTube URL validation (youtube.com, youtu.be, music.youtube.com, shorts)
- URL ready indicator with green pulse dot
- Processing log adapts to show "fetching from YouTube" when URLs are used

### Changed
- UploadCard now accepts `url` and `onUrl` props alongside file props
- Process button enables when either file or URL is provided for both inputs

## [1.0.0] - 2026-02-09

### Added
- Project initialization with full directory structure
- React + Vite + Tailwind frontend scaffold
- ASCIIBackground component (Canvas-based animated ASCII art)
- ParticleField component (tsParticles floating particles)
- AmbientScene component (Three.js volumetric lighting)
- UploadCard component (drag-and-drop video/audio upload)
- ControlPanel component (beat aggressiveness, motion bias, sensitivity)
- ProcessingView with terminal-style status output
- OutputPreview with video player placeholder
- Dark cyberpunk theme with neon purple/cyan/blue accents
- Glassmorphism UI cards with backdrop-blur
- Framer Motion animations throughout
- verdict.txt for session continuity
- README.md, CHANGELOG.md, LICENSE, .gitignore
