import os
import glob
import yt_dlp


def download_youtube(url: str, output_dir: str, kind: str) -> str:
    """Download a YouTube video or audio. Returns the output file path."""
    os.makedirs(output_dir, exist_ok=True)

    if kind == "audio":
        outtmpl = os.path.join(output_dir, "audio.%(ext)s")
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": outtmpl,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }],
            "quiet": True,
            "no_warnings": True,
        }
    else:
        outtmpl = os.path.join(output_dir, "video.%(ext)s")
        ydl_opts = {
            "format": "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "outtmpl": outtmpl,
            "merge_output_format": "mp4",
            "quiet": True,
            "no_warnings": True,
        }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    # Find the downloaded file
    pattern = os.path.join(output_dir, f"{kind}.*")
    matches = glob.glob(pattern)
    if not matches:
        raise FileNotFoundError(f"Download failed: no {kind} file found in {output_dir}")
    return matches[0]
