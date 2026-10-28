# Apple Silicon live speech acceleration

This optional local service speeds up speech recognition for the existing
Chrome/Whale extension. The extension continues capturing the current tab and
keeps its existing UI, YAMNet sound cues, word timing schema, and browser Whisper
fallback. When the service is running, five-second PCM windows go to MLX Whisper
on `127.0.0.1`; they are never sent to a cloud service. Without the service, the
existing browser model runs as before.

## Install and run

On an Apple Silicon Mac, open a terminal in this repository and run:

```sh
python3 -m venv .venv-macos-asr
source .venv-macos-asr/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-macos-asr.txt
python -m uvicorn server_macos.app:app --host 127.0.0.1 --port 8765
```

Then reload the extension from its `0.4.0` build and start captions on a video.
The extension checks the loopback health endpoint when captions start. The
first MLX request downloads the selected model; later requests reuse MLX
Whisper's cached model. Set `SORIMOI_MLX_MODEL=mlx-community/whisper-tiny-mlx`
before starting Uvicorn for lower latency with a greater chance of transcription
errors. The default is `mlx-community/whisper-base-mlx`.

The backend accepts at most eight seconds of 16kHz Float32 audio per request,
serializes inference to avoid overlapping GPU work, and returns word timestamps
in the same format used by the browser recognizer. It binds only to loopback.
The browser extension uses a fixed client header and extension-origin CORS check;
the service does not accept requests from ordinary websites.

## First-playback behavior and limits

Speech recognition works on rolling windows while the video plays. The newest
recognized phrase is shown in the overlay for up to six seconds after the result
arrives, so the first playback does not have to be repeated just to see speech
text. The phrase may lag the sound by a few seconds. Word timestamps remain
anchored to the source video, and the optional replay button is available when
you want to see prepared words at their original times.

This live path intentionally does not download the whole YouTube video with
`yt-dlp`, separate stems with Demucs, align a second time with WhisperX, or
render ASS through SubtitlesOctopus. Those steps add delay before captions are
available. MLX Whisper provides word times directly; the existing YAMNet path
continues to handle sound-type cues. On non-Apple-Silicon systems or when the
service is stopped, the packaged browser Whisper path remains the fallback.

The first model load may be slow, inference latency varies by Mac and audio,
and small models trade recognition quality for speed. The overlay cannot
guarantee exact real-time speech recognition or correct Korean transcription.
