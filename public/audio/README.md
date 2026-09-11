# Vocal assets

`vocals.mp3` is an audio atlas of 60 locally generated, original fruit-fly vocal lines. `vocals.json` identifies the slices. Text and spoken pronunciation overrides are in `src/lyrics.json`.

The stock voices `am_michael` and `af_heart` were generated offline with [Kokoro-82M v1.0](https://huggingface.co/hexgrad/Kokoro-82M), an Apache-2.0 licensed model, through the MIT-licensed [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) package. These are synthetic spoken/chant vocals, not recordings or impersonations of any requested artist. No model weights or inference service are used by the web app.

Production: 24 kHz mono; pitch-preserving tempo fit to eight-beat slots at 150 BPM, natural lead with subtle lower/upper-octave backing, filtered and level-normalized, encoded as 80 kbit/s MP3. Short lines keep their natural pace and leave a longer instrumental gap. Regenerate with `scripts/render-vocals.py` (instructions in the repository README).
