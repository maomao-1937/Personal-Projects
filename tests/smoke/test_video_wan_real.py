from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

import pytest

from backend.config import FFPROBE_BIN, Settings
from backend.domain.errors import DomainError
from backend.providers.video_wan import DashScopeWanVideoProvider
from backend.services.cuts import validate_mp4


pytestmark = pytest.mark.real_model


def test_real_wan_generates_one_fixed_five_second_480p_cut() -> None:
    if os.getenv("RUN_REAL_WAN_SMOKE") != "1":
        pytest.skip("set RUN_REAL_WAN_SMOKE=1 to create one paid Wan task")
    settings = Settings()
    if settings.video_provider != "dashscope_wan":
        pytest.skip("VIDEO_PROVIDER must be dashscope_wan")
    if not settings.video_api_key or not settings.video_base_url or not settings.video_model:
        pytest.skip("Wan Video Provider is not configured")
    provider = DashScopeWanVideoProvider(
        api_key=settings.video_api_key.get_secret_value(),
        base_url=settings.video_base_url,
        model=settings.video_model,
        timeout_seconds=settings.video_request_timeout_seconds,
    )
    smoke_dir = Path(".smoke")
    smoke_dir.mkdir(exist_ok=True)
    request_file = smoke_dir / "wan_request_id.txt"
    started = time.monotonic()
    if request_file.exists():
        request_id = request_file.read_text(encoding="utf-8").strip()
        task = provider.query(request_id)
    else:
        try:
            task = provider.create(
                prompt="电影感广角镜头，匿名舞者的剪影在雨夜空旷街道缓慢向晨光前行，无文字，无品牌，无真人肖像特征。",
                duration_seconds=5,
                ratio="16:9",
                resolution="480p",
            )
        except DomainError as exc:
            pytest.fail(
                f"{exc.code}: {json.dumps(exc.details, ensure_ascii=True, sort_keys=True)}",
                pytrace=False,
            )
        request_id = task.provider_request_id
        request_file.write_text(request_id, encoding="utf-8")
    deadline = time.monotonic() + settings.video_job_deadline_seconds
    while task.status in {"submitted", "queued", "running"} and time.monotonic() < deadline:
        time.sleep(settings.video_poll_interval_seconds)
        task = provider.query(request_id)
    assert task.status == "succeeded", task.error_code or task.raw_status
    assert task.video_url is not None
    video = provider.download(task.video_url, max_bytes=100 * 1024 * 1024)
    output = smoke_dir / "wan_smoke.mp4"
    output.write_bytes(video)
    assert validate_mp4(output)
    probe = subprocess.run(
        [
            FFPROBE_BIN,
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name,width,height:format=duration,size",
            "-of",
            "json",
            str(output),
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=True,
    )
    payload = json.loads(probe.stdout)
    streams = payload["streams"]
    video_stream = next(stream for stream in streams if stream["codec_type"] == "video")
    duration_ms = round(float(payload["format"]["duration"]) * 1000)
    metadata = {
        "duration_ms": duration_ms,
        "width": int(video_stream["width"]),
        "height": int(video_stream["height"]),
        "video_codec": video_stream["codec_name"],
        "audio_stream_count": sum(stream["codec_type"] == "audio" for stream in streams),
        "bytes": int(payload["format"]["size"]),
    }
    (smoke_dir / "wan_result.json").write_text(
        json.dumps(
            {
                "request_id": f"{request_id[:8]}...{request_id[-4:]}",
                "status": task.status,
                "elapsed_seconds": round(time.monotonic() - started, 2),
                "metadata": metadata,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    assert duration_ms == pytest.approx(5_000, abs=1_000)
    assert video_stream["codec_name"] == "h264"
    assert metadata["audio_stream_count"] == 0
