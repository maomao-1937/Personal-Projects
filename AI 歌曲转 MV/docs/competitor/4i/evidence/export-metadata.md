# 导出文件元数据

## Director Export

文件：`downloads/audio-cloud.mp4`

| 字段 | 实测值 |
|---|---|
| 容器 | MP4 / MOV family |
| 时长 | 8.000 s |
| 文件大小 | 1,643,729 bytes |
| 总码率 | 1,643,729 bit/s |
| 视频 | H.264, 1280×704, 30 fps |
| 音频 | AAC, mono, 44.1 kHz |
| SHA-256 | `779131300d7a6b443eb25d5648cea28f05f387ec55537bbf2ad26b930d4a1ff3` |

说明：Director 中选择了 16:9，但“无重编码”下载成片实测为 1280×704。[`39-exported-video-frame.jpg`](39-exported-video-frame.jpg) 为抽帧，未看到可见水印。

## Timeline Export 页面下载

文件：`downloads/audio.mp4`

| 字段 | 实测值 |
|---|---|
| 容器 | MP4 / MOV family |
| 时长 | 8.064 s |
| 文件大小 | 2,805,312 bytes |
| 总码率 | 2,783,047 bit/s |
| 视频 | H.264, 1280×720, 30 fps |
| 音频 | AAC, stereo, 48 kHz |
| SHA-256 | `5b9d5593c8c201669255e2aec5dba3379e879dacdc9bafa5111bba660d4ab004` |

说明：Timeline Export 页显示 Ready / 100%，Duration 0:08、Scenes 1、Gaps None、Audio Finalized。[`56-timeline-export-frame.jpg`](56-timeline-export-frame.jpg) 为抽帧，未看到可见水印。

### 下载内容与当前 Row 的对比

Timeline Export 页下载文件的参数是真实的，但其画面内容不是当前 8 秒 Lipsync Row：

| 样本 | 视频 | 音频 | 时长 | 大小 | SHA-256 |
|---|---|---|---:|---:|---|
| 当前 Timeline Row 媒体 | H.264, 1280×704, 24 fps | AAC, mono, 44.1 kHz | 8.000 s | 1,319,044 bytes | `0e390dc3c9df8f9822e20e34792bc24269134b4b70319162f971db3db832d388` |
| Timeline Export 页下载 | H.264, 1280×720, 30 fps | AAC, stereo, 48 kHz | 8.064 s | 2,805,312 bytes | `5b9d5593c8c201669255e2aec5dba3379e879dacdc9bafa5111bba660d4ab004` |

`audio-timeline-row.mp4` 从项目当前 Row 的 `videoUrl` 读取。每 2 秒抽帧后：

- Director 成片和 Timeline Export 页下载均依次出现歌手、空录音室、霓虹人群、调音台。
- 当前 Timeline Row 在 4 个抽帧中都是歌手对麦克风。
- 统一缩放后，Director 与 Timeline Export 页下载的全片 SSIM 约 `0.888`；当前 Row 与该下载的 SSIM 约 `0.794`。SSIM 不单独用作来源证明，但与抽帧顺序共同支持“下载内容复用既有 Director 蒙太奇”的观察。

证据：[`audio-timeline-row.mp4`](downloads/audio-timeline-row.mp4)、[`61-export-content-comparison.jpg`](61-export-content-comparison.jpg)。对比图从左到右为 Director 导出、Timeline Export 页下载、当前 Timeline Row，每列包含 0/2/4/6 秒附近抽帧。

## 字幕与转录

| 文件 | 大小 | SHA-256 |
|---|---:|---|
| `downloads/audio.srt` | 136 bytes | `63fee676ed6d4fdd68d0751feb58c4b3a44fe2644d8637db851ab7128ca9d4d9` |
| `downloads/audio.ass` | 1,144 bytes | `9942ee8c7d9717c69babce6778bae1bf23eef2feda9ae970737fe3e72aaec442` |
| `downloads/audio.txt` | 581 bytes | `71ba1289939ceacadd505ff38e74507935168a5035af1cbeadd7864b5f70d789` |

- SRT 是 1 个 cue，时间 00:01.120–00:06.660。
- ASS 头部是 1280×720、Arial 40；完整句子被按 cut 边界重复写入 4 个 Dialogue 区间。
- TXT 保留逐词开始/结束时间。本次转录中后半部分多个词具有相同时间戳，这是下载文件的真实输出。
