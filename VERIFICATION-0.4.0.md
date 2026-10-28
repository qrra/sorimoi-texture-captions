# 0.4.0 change notes

This change adds an optional Apple Silicon MLX Whisper endpoint and connects
the extension to it when the loopback service responds. The browser Whisper
worker remains the fallback. The live overlay can show the newest recognized
phrase briefly during the first playback while retaining original cue times.
Extension icon assets use the user-provided badger image.

## Not verified in this change

- No JavaScript or Python test suite was run.
- MLX model download and inference were not run on Apple Silicon in this change.
- No YouTube video was used to measure speech latency, timestamp quality, or
  Korean recognition accuracy.
- The optional local server and browser fallback need a real installed build
  check in Whale/Chrome before a release ZIP is produced.

Build and test instructions remain `npm run extension` and `npm test` after
installing the source dependencies and model/WASM assets described in README.
