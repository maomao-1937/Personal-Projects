from __future__ import annotations

import json
import os
import secrets
import subprocess
from pathlib import Path

from pydantic import BaseModel, Field

from backend.config import FFMPEG_BIN, FFPROBE_BIN
from backend.domain.errors import DomainError


class RenderCut(BaseModel):
    cut_id: str
    duration_ms: int = Field(gt=0)
    video_path: Path | None


class RenderMetadata(BaseModel):
    duration_ms: int
    width: int
    height: int
    video_codec: str
    audio_codec: str
    format: str = "mp4"
    placeholder_cut_ids: list[str]


class FFmpegRenderProvider:
    def __init__(
        self,
        *,
        ffmpeg_bin: str = FFMPEG_BIN,
        ffprobe_bin: str = FFPROBE_BIN,
        timeout_seconds: int = 600,
    ) -> None:
        self.ffmpeg_bin = ffmpeg_bin
        self.ffprobe_bin = ffprobe_bin
        self.timeout_seconds = timeout_seconds

    def render_preview(
        self,
        *,
        audio_path: str | Path,
        cuts: list[RenderCut],
        output_path: str | Path,
        width: int = 1280,
        height: int = 720,
    ) -> RenderMetadata:
        if not cuts:
            raise DomainError("render_has_no_cuts", "Preview 没有可渲染的 Cut。", status_code=422)
        audio = Path(audio_path)
        output = Path(output_path)
        if not audio.is_file():
            raise DomainError("render_audio_missing", "Preview 音频文件不存在。", status_code=409)
        for cut in cuts:
            if cut.video_path is not None and not Path(cut.video_path).is_file():
                raise DomainError(
                    "render_video_missing",
                    "Preview 引用的视频文件不存在。",
                    status_code=409,
                    details={"cut_id": cut.cut_id},
                )

        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_name(f".{output.name}.{secrets.token_hex(4)}.tmp.mp4")
        command = [self.ffmpeg_bin, "-y", "-i", str(audio)]
        video_input_index: dict[int, int] = {}
        next_input = 1
        for index, cut in enumerate(cuts):
            if cut.video_path is not None:
                command.extend(["-stream_loop", "-1", "-i", str(cut.video_path)])
                video_input_index[index] = next_input
                next_input += 1

        filter_parts: list[str] = []
        concat_inputs: list[str] = []
        placeholders: list[str] = []
        for index, cut in enumerate(cuts):
            duration = cut.duration_ms / 1000
            if index in video_input_index:
                source = video_input_index[index]
                filter_parts.append(
                    f"[{source}:v]trim=duration={duration:.6f},setpts=PTS-STARTPTS,"
                    f"scale={width}:{height}:force_original_aspect_ratio=increase,"
                    f"crop={width}:{height},fps=30,format=yuv420p,setsar=1[v{index}]"
                )
            else:
                placeholders.append(cut.cut_id)
                filter_parts.append(
                    f"color=c=0x16181d:s={width}x{height}:r=30:d={duration:.6f},"
                    "drawbox=x=20:y=20:w=iw-40:h=ih-40:color=0x596273:t=4,"
                    f"format=yuv420p,setsar=1[v{index}]"
                )
            concat_inputs.append(f"[v{index}]")
        total_duration = sum(cut.duration_ms for cut in cuts) / 1000
        filter_parts.append(
            f"{''.join(concat_inputs)}concat=n={len(cuts)}:v=1:a=0[vout]"
        )
        filter_parts.append(
            f"[0:a]atrim=duration={total_duration:.6f},asetpts=PTS-STARTPTS[aout]"
        )
        command.extend(
            [
                "-filter_complex",
                ";".join(filter_parts),
                "-map",
                "[vout]",
                "-map",
                "[aout]",
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "20",
                "-pix_fmt",
                "yuv420p",
                "-video_track_timescale",
                "90000",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-t",
                f"{total_duration:.6f}",
                "-movflags",
                "+faststart",
                str(temporary),
            ]
        )
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
            if result.returncode != 0:
                raise DomainError(
                    "ffmpeg_render_failed",
                    "FFmpeg 构建 Preview 失败。",
                    status_code=500,
                    retryable=True,
                )
            metadata = self.probe(temporary, placeholder_cut_ids=placeholders)
            if metadata.video_codec != "h264" or metadata.audio_codec != "aac":
                raise DomainError(
                    "render_verification_failed",
                    "Preview 编码验证失败。",
                    status_code=500,
                    retryable=True,
                )
            os.replace(temporary, output)
            return metadata
        except subprocess.TimeoutExpired as exc:
            raise DomainError(
                "ffmpeg_render_timed_out",
                "FFmpeg 构建 Preview 超时。",
                status_code=504,
                retryable=True,
            ) from exc
        finally:
            temporary.unlink(missing_ok=True)

    def probe(
        self,
        path: str | Path,
        *,
        placeholder_cut_ids: list[str] | None = None,
    ) -> RenderMetadata:
        result = subprocess.run(
            [
                self.ffprobe_bin,
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode != 0:
            raise DomainError(
                "render_verification_failed",
                "无法验证渲染结果。",
                status_code=500,
                retryable=True,
            )
        try:
            payload = json.loads(result.stdout)
            video = next(stream for stream in payload["streams"] if stream["codec_type"] == "video")
            audio = next(stream for stream in payload["streams"] if stream["codec_type"] == "audio")
            duration_ms = round(float(payload["format"]["duration"]) * 1000)
            return RenderMetadata(
                duration_ms=duration_ms,
                width=int(video["width"]),
                height=int(video["height"]),
                video_codec=video["codec_name"],
                audio_codec=audio["codec_name"],
                placeholder_cut_ids=placeholder_cut_ids or [],
            )
        except (KeyError, StopIteration, TypeError, ValueError) as exc:
            raise DomainError(
                "render_verification_failed",
                "渲染结果缺少有效的视频或音频轨。",
                status_code=500,
                retryable=True,
            ) from exc
