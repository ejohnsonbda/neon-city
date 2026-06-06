// ============================================================
//  AUDIO — procedural WebAudio sfx
// ============================================================
class SoundManager {
  constructor() {
    this.buffers = {};
    this.enabled = false;
    this.lastPulseSfx = 0;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('[SoundManager] WebAudio is not available; continuing silently.');
      return;
    }
    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
    } catch (err) {
      console.warn('[SoundManager] WebAudio failed to initialize; continuing silently.', err);
    }
  }
  resume() { if (this.enabled && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  loadSample(name, url) {
    if (!this.enabled || !url) return;
    fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then(a => this.ctx.decodeAudioData(a))
      .then(buf => { this.buffers[name] = buf; })
      .catch(err => console.warn(`[SoundManager] Sample '${name}' unavailable; using procedural fallback.`, err));
  }
  playSample(name, vol = 1, rate = 1) {
    const buf = this.buffers[name];
    if (!this.enabled || !buf || this.ctx.state === 'suspended') return false;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.master); src.start();
    return true;
  }
  setVolume(v) {
    if (this.enabled && this.master) this.master.gain.value = v;
    const el = document.getElementById('vol-val');
    if (el) el.innerText = Math.round(v * 100) + '%';
  }
  tone(freq, type, dur, vol = 1, slide = 0) {
    if (!this.enabled || this.ctx.state === 'suspended') return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, this.ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, this.ctx.currentTime + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  }
  noise(dur, vol = 0.5, freq = 1200) {
    if (!this.enabled || this.ctx.state === 'suspended') return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = freq;
    const gain = this.ctx.createGain(); gain.gain.value = vol;
    src.connect(filt); filt.connect(gain); gain.connect(this.master);
    src.start();
  }
  shoot(type) {
    // distinct sound per weapon (pitched sample for kinetic, synth for energy)
    if (type === 'pistol')  { if (!this.playSample('shoot', 0.7, 1.15)) { this.tone(720, 'square', 0.09, 0.32, 180); } return; }
    if (type === 'smg')     { if (!this.playSample('shoot', 0.4, 1.5))  { this.tone(560, 'sawtooth', 0.05, 0.22, 130); } return; }
    if (type === 'shotgun') { if (!this.playSample('shoot', 1.0, 0.66)) { this.tone(110, 'square', 0.32, 0.6, 50); } this.noise(0.18, 0.4, 800); return; }
    if (type === 'railgun') { // charged rail zap
      this.tone(1400, 'sawtooth', 0.28, 0.5, 120); this.tone(200, 'square', 0.3, 0.4, 60); this.noise(0.12, 0.3, 3000); return;
    }
    if (type === 'plasma')  { // energy bloop
      this.tone(180, 'sine', 0.22, 0.45, 480); this.tone(90, 'triangle', 0.25, 0.3, 50); return;
    }
    if (type === 'pulse')   {
      const now = performance.now();
      const minGap = window.__NEON_LOW_MEMORY ? 130 : 65;
      if (now - this.lastPulseSfx < minGap) return;
      this.lastPulseSfx = now;
      if (!this.playSample('shoot', window.__NEON_LOW_MEMORY ? 0.18 : 0.28, 1.7)) { this.tone(640, 'square', window.__NEON_LOW_MEMORY ? 0.025 : 0.04, window.__NEON_LOW_MEMORY ? 0.12 : 0.2, 200); }
      return;
    }
    if (type === 'katana')  { this.playSample('shoot', 0.45, 1.7); this.noise(0.14, 0.4, 4200); this.tone(2600, 'sine', 0.12, 0.18, 900); return; }
    if (type === 'shuriken'){ this.playSample('shoot', 0.4, 1.9); this.noise(0.12, 0.3, 2600); this.tone(1700, 'sine', 0.09, 0.12, 700); return; }
    if (type === 'bow')     { this.playSample('shoot', 0.4, 0.85); this.noise(0.1, 0.25, 1400); this.tone(300, 'triangle', 0.16, 0.3, 120); return; }
    this.playSample('shoot', 0.8, 1);
  }
  enemyShoot() { this.tone(300, 'sawtooth', 0.18, 0.18, 90); }
  hit() { this.tone(1400, 'triangle', 0.04, 0.18); }
  kill() { this.tone(160, 'square', 0.18, 0.3, 60); this.noise(0.15, 0.25, 600); }
  step() { this.tone(48, 'sine', 0.05, 0.08); }
  collect() { this.tone(1100, 'sine', 0.08, 0.25); this.tone(1650, 'sine', 0.1, 0.25, 0); }
  damage() { this.tone(90, 'sawtooth', 0.2, 0.3, 40); }
  wave() { this.tone(440, 'triangle', 0.15, 0.25, 660); this.tone(660, 'triangle', 0.2, 0.25, 880); }
  boss() { this.tone(70, 'sawtooth', 0.8, 0.4, 45); this.noise(0.6, 0.3, 300); }
}
