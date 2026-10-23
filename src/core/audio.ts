import { settings } from './storage';

/** Procedural chiptune audio: no sound files, everything is synthesized. */

type Wave = OscillatorType;

const NOTE: Record<string, number> = {};
{
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let o = 1; o <= 7; o++) {
    names.forEach((n, i) => {
      NOTE[n + o] = 440 * Math.pow(2, (o - 4) + (i - 9) / 12);
    });
  }
}

// Menu theme: 32 eighth notes per loop.
const LEAD = [
  'E5', 'G5', 'C6', 'G5', 'E5', 'G5', 'C6', 'D6', 'E6', 'D6', 'C6', 'G5', 'A5', 'G5', 'E5', 'G5',
  'F5', 'A5', 'C6', 'A5', 'F5', 'A5', 'C6', 'D6', 'E6', 'D6', 'C6', 'B5', 'C6', '', 'G5', '',
  'A5', 'C6', 'E6', 'C6', 'A5', 'C6', 'E6', 'F6', 'G6', 'F6', 'E6', 'C6', 'D6', 'C6', 'A5', 'C6',
  'F5', 'A5', 'C6', 'F6', 'E6', 'C6', 'G5', 'C6', 'D6', '', 'B5', '', 'C6', '', '', '',
];
const BASS = ['C3', 'C3', 'A2', 'A2', 'F2', 'F2', 'G2', 'G2', 'A2', 'A2', 'E2', 'E2', 'F2', 'F2', 'G2', 'C3'];

class Audio {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private crowd: { src: AudioBufferSourceNode; gain: GainNode; filt: BiquadFilterNode } | null = null;
  private musicOn = false;
  private musicStep = 0;
  private musicNext = 0;
  private musicTimer = 0;

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.35;
        this.musicGain.connect(this.master);
        const len = this.ctx.sampleRate * 2;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // a silent blip fully unlocks audio on iOS
        const b = this.ctx.createBuffer(1, 1, 22050);
        const s = this.ctx.createBufferSource();
        s.buffer = b;
        s.connect(this.ctx.destination);
        s.start(0);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* no audio */
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  private ok() {
    return !!this.ctx && !!this.master && settings.sound && this.ctx.state === 'running';
  }

  tone(freq: number, dur: number, type: Wave = 'square', vol = 0.15, slideTo = 0, delay = 0, dest?: AudioNode) {
    if (!this.ok() && !dest) return;
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur: number, vol = 0.2, type: BiquadFilterType = 'lowpass', freq = 1200, delay = 0, q = 1) {
    if (!this.ok() || !this.noiseBuf) return;
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master!);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.02);
  }

  sfx(name: string, power = 1) {
    if (!this.ok()) return;
    switch (name) {
      case 'blip':
        this.tone(880, 0.05, 'square', 0.08);
        break;
      case 'select':
        this.tone(660, 0.06, 'square', 0.08);
        this.tone(990, 0.08, 'square', 0.08, 0, 0.06);
        break;
      case 'back':
        this.tone(440, 0.07, 'square', 0.08, 300);
        break;
      case 'stick':
        this.noise(0.04, 0.12 * power, 'highpass', 2500);
        this.tone(520, 0.03, 'triangle', 0.1 * power);
        break;
      case 'pass':
        this.noise(0.05, 0.18, 'bandpass', 1800, 0, 2);
        this.tone(700, 0.04, 'square', 0.06, 500);
        break;
      case 'shot':
        this.noise(0.09, 0.3, 'bandpass', 1400, 0, 1.5);
        this.tone(300, 0.06, 'square', 0.12, 120);
        break;
      case 'slap':
        this.noise(0.15, 0.45, 'lowpass', 2600);
        this.tone(160, 0.12, 'sawtooth', 0.2, 60);
        break;
      case 'post':
        this.tone(1760, 0.35, 'square', 0.12, 1700);
        this.tone(2640, 0.25, 'triangle', 0.1);
        break;
      case 'board':
        this.noise(0.12, 0.25 * power, 'lowpass', 400);
        this.tone(90, 0.12, 'triangle', 0.25 * power, 60);
        break;
      case 'check':
        this.noise(0.2, 0.4, 'lowpass', 600);
        this.tone(70, 0.22, 'square', 0.25, 40);
        break;
      case 'save':
        this.noise(0.06, 0.25, 'lowpass', 900);
        this.tone(200, 0.06, 'triangle', 0.2, 120);
        break;
      case 'whistle':
        for (let i = 0; i < 6; i++) this.tone(i % 2 ? 2900 : 3150, 0.06, 'square', 0.05, 0, i * 0.055);
        break;
      case 'horn': {
        const notes = [110, 138.6, 164.8, 220];
        for (const f of notes) this.tone(f, 1.8, 'sawtooth', 0.09);
        this.cheer(2.5);
        break;
      }
      case 'drop':
        this.tone(1200, 0.03, 'square', 0.06);
        break;
      case 'deke':
        this.tone(500, 0.12, 'triangle', 0.1, 900);
        break;
      case 'charge': {
        const seq = ['G4', 'C5', 'E5', 'G5', '', 'E5', 'G5'];
        seq.forEach((n, i) => n && this.tone(NOTE[n], i === 6 ? 0.45 : 0.14, 'square', 0.07, 0, i * 0.15));
        break;
      }
      case 'buzzer':
        this.tone(140, 1.1, 'sawtooth', 0.12);
        this.tone(147, 1.1, 'square', 0.06);
        break;
      case 'win':
        ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) => this.tone(NOTE[n], i === 5 ? 0.6 : 0.12, 'square', 0.08, 0, i * 0.12));
        break;
      case 'lose':
        ['G4', 'F4', 'D#4', 'D4'].forEach((n, i) => this.tone(NOTE[n], 0.3, 'triangle', 0.12, 0, i * 0.25));
        break;
    }
  }

  cheer(dur = 2) {
    if (!this.ok() || !this.noiseBuf) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master!);
    s.start(t);
    s.stop(t + dur + 0.1);
  }

  /** Constant low crowd murmur during games. */
  crowdLoop(on: boolean) {
    if (!this.ctx || !this.noiseBuf || !this.master) return;
    if (on && !this.crowd && settings.sound) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 700;
      filt.Q.value = 0.5;
      const gain = c.createGain();
      gain.gain.value = 0.035;
      src.connect(filt);
      filt.connect(gain);
      gain.connect(this.master);
      src.start();
      this.crowd = { src, gain, filt };
    } else if (!on && this.crowd) {
      try {
        this.crowd.src.stop();
      } catch {
        /* ignore */
      }
      this.crowd = null;
    }
  }

  music(on: boolean) {
    on = on && settings.music;
    if (on === this.musicOn) return;
    this.musicOn = on;
    clearInterval(this.musicTimer);
    if (!on) return;
    this.musicStep = 0;
    this.musicNext = 0;
    this.musicTimer = window.setInterval(() => this.musicTick(), 40);
  }

  private musicTick() {
    if (!this.ctx || !this.musicGain || this.ctx.state !== 'running' || !settings.sound) return;
    const step = 60 / 140 / 2; // eighth notes at 140 bpm
    const now = this.ctx.currentTime;
    if (this.musicNext < now) this.musicNext = now + 0.05;
    while (this.musicNext < now + 0.2) {
      const i = this.musicStep % LEAD.length;
      const n = LEAD[i];
      const d = this.musicNext - now;
      if (n) this.tone(NOTE[n], step * 0.9, 'square', 0.05, 0, d, this.musicGain);
      if (i % 4 === 0) {
        const b = BASS[(i / 4) % BASS.length];
        this.tone(NOTE[b], step * 3.6, 'triangle', 0.16, 0, d, this.musicGain);
      }
      if (i % 2 === 1) this.hat(d);
      this.musicStep++;
      this.musicNext += step;
    }
  }

  private hat(delay: number) {
    if (!this.ctx || !this.noiseBuf || !this.musicGain) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    s.start(t, Math.random());
    s.stop(t + 0.05);
  }
}

export const audio = new Audio();
