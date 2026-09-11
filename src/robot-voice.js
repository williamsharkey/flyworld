// Offline-rendered neural phrases retain consonants and whole-line prosody.
// Only a small local audio atlas is downloaded; no model runs in the browser.
export const VOICE_VOLUME = 0.7 * 0.55;
export class RobotVoice {
  constructor(ctx, destination, { base = import.meta.env?.BASE_URL ?? "/", fetcher = (...args) => globalThis.fetch(...args) } = {}) {
    this.ctx = ctx;
    this.fetcher = fetcher;
    this.base = base;
    this.words = 0;
    this.lines = 0;
    this.nodes = new Set();
    this.intervals = [];
    this.ready = false;
    this.error = null;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.samples = new Float32Array(512);
    this.gain = ctx.createGain();
    this.gain.gain.value = 1.4 * VOICE_VOLUME;
    this.gain.connect(destination);
    this.gain.connect(this.analyser);
    this.load();
  }
  load() {
    if (this.ready) return Promise.resolve(true);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const [manifestResponse, audioResponse] = await Promise.all([
          this.fetcher(`${this.base}audio/vocals.json`),
          this.fetcher(`${this.base}audio/vocals.mp3`),
        ]);
        if (!manifestResponse.ok || !audioResponse.ok) throw new Error("Vocal audio could not be loaded");
        const [manifest, bytes] = await Promise.all([manifestResponse.json(), audioResponse.arrayBuffer()]);
        const buffer = await this.ctx.decodeAudioData(bytes);
        for (const clip of Object.values(manifest.clips)) {
          if (!(clip.offset >= 0 && clip.duration > 0 && clip.offset + clip.duration <= buffer.duration + .02))
            throw new Error("Vocal audio and phrase manifest do not match");
        }
        this.manifest = manifest;
        this.buffer = buffer;
        this.ready = true;
        this.error = null;
        return true;
      } catch (error) {
        this.error = error.message;
        return false;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }
  line(id, time) {
    const clip = this.manifest?.clips[id];
    if (!this.ready || !clip || time < this.ctx.currentTime) return false;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);
    source.onended = () => {
      this.nodes.delete(source);
      source.disconnect();
    };
    source.start(time, clip.offset, clip.duration);
    this.nodes.add(source);
    this.intervals = this.intervals.filter(i => i.end > this.ctx.currentTime);
    this.intervals.push({ start: time, end: time + clip.speechDuration });
    this.words += clip.text.split(/\s+/).length;
    this.lines++;
    return true;
  }
  activeAt(time) {
    return this.intervals.some(i => time >= i.start && time < i.end);
  }
  stop() {
    for (const node of this.nodes) {
      try { node.stop(); } catch {}
      node.disconnect();
    }
    this.nodes.clear();
    this.intervals = [];
  }
  get rms() {
    this.analyser.getFloatTimeDomainData(this.samples);
    return Math.sqrt(this.samples.reduce((s, v) => s + v * v, 0) / this.samples.length);
  }
}
