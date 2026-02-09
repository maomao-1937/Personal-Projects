# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
