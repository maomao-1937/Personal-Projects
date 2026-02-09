# AUTO BEAT // VIDEO ENGINE

A production-grade AI video editor that automatically syncs video cuts to music beats.

## Features

- **Beat Detection** — Analyzes BPM, beats, downbeats, and energy using librosa
- **Smart Cutting** — Aligns video cuts to musical beats intelligently
- **Scene Analysis** — Detects scene cuts and motion intensity
- **Cyberpunk UI** — Modern dark interface with ASCII art, particles, and ambient lighting
- **Export** — Renders final MP4 (H.264) with ffmpeg

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + Tailwind + Three.js + tsParticles |
| Backend | Python + FastAPI |
| Video | ffmpeg + moviepy |
| Audio | librosa |

## Quick Start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend (coming soon)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Project State

See `verdict.txt` for current project status, decisions, and next steps.

## Versioning

This project follows [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

## License

MIT
