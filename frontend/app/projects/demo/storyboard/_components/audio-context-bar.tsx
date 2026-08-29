import { Play } from "lucide-react";

const waveform = [
  14, 22, 32, 18, 38, 30, 46, 24, 34, 54, 28, 42, 62, 35, 50, 44, 68, 38, 52,
  70, 42, 56, 74, 46, 64, 40, 58, 72, 36, 52, 65, 44, 55, 68, 32, 48, 60, 40,
  52, 46, 62, 36, 56, 44, 66, 38, 52, 42, 58, 34, 48, 38, 54, 30, 44, 36, 48,
  28, 40, 32, 46, 24, 36, 20,
] as const;

export function AudioContextBar() {
  return (
    <section className="audio-context" aria-label="音频波形">
      <div className="audio-controls">
        <button type="button" className="play-button" aria-label="播放界面预览音频">
          <Play aria-hidden="true" fill="currentColor" size={20} />
        </button>
        <span className="timecode">01:24 / 03:48</span>
      </div>
      <div className="waveform-wrap" aria-hidden="true">
        <div className="selection-range" />
        <div className="waveform-bars">
          {waveform.map((height, index) => (
            <span key={`${height}-${index}`} style={{ height: `${height}%` }} />
          ))}
        </div>
        {[9, 22, 36, 50, 64, 78, 91].map((position) => (
          <i className="beat-marker" key={position} style={{ left: `${position}%` }} />
        ))}
      </div>
      <span className="bpm-badge">BPM 124</span>
      <div className="audio-ticks" aria-hidden="true">
        <span>00:00</span><span>00:45</span><span>01:00</span><span>01:45</span><span>02:30</span><span>03:15</span><span>03:48</span>
      </div>
    </section>
  );
}
