# 0.2 verification — 2026-10-26

## Confirmed

- 8 automated tests pass: WebVTT parsing/round trip/overlap, input validation, sound-window merging, bounded PCM ring buffer/reset, audio level, stale inference rejection on navigation/pause/native-caption availability, ASR text cleaning.
- WXT produces `background.js`, `offscreen.html`, **bundled `speech-worker.js`**, popup and model/runtime files. The worker path was tested after replacing an initially incorrect source-relative URL with a WXT unlisted-script entrypoint.
- Browser Worker with extension-equivalent CSP (`self` scripts/workers/connect; `wasm-unsafe-eval`) initialized the bundled multilingual Whisper-base q8 model in **2162 ms** in one local run (an earlier cold run took 3225 ms).
- A locally generated Microsoft Heami Korean PCM16/16kHz fixture, cropped to **5 seconds**, returned **“안녕하세요 종이가 바스락거리고 작은 물방울이 떨어집니다”** in **4036 ms** in the browser WASM worker. This is one synthetic example, not an accuracy or real-time throughput benchmark.
- The same fixture on native ONNX CPU (not browser WASM) initialized in 1197 ms and inferred in 1516 ms. This is recorded separately and is not presented as browser performance.
- A local HTML5 player fixture verified DOM-native caption text is re-rendered with the source label `YouTube 자막`. The fixture is a simulated page; it does not prove every YouTube layout works.
- Speech and sound models and JS/WASM runtime are bundled; remote model loading is disabled. Runtime audio is not sent to a server.

## Not yet confirmed

The tool environment blocks controlling browser extension installation. The updated extension has therefore **not been installed and run end-to-end on the user's real YouTube Shorts tab**. In particular the real `tabCapture → offscreen document → AudioWorklet → model → content overlay` chain still needs an installed-profile check. All-sites, all-Shorts, full-screen, and every Whale version compatibility are not claimed.

Model inference is chunked and follows the sound. A 3–5 second audio context plus processing latency is expected when native captions are absent. The overlay says `후행 음성 인식 · 처리 N초`; this processing value excludes the initial audio collection window. Native captions can be used immediately, but must already be exposed by the active player's caption DOM.
