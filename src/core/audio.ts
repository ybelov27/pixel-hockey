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
      if (!this.samplesRequested) {
        this.samplesRequested = true;
        for (const name of ['bardown', 'post']) void this.loadSample(name);
      }
    } catch {
      /* no audio */
    }
  }

  /**
   * Optional real recordings. Drop sounds/bardown.mp3 (and optionally
   * sounds/post.mp3) into public/ and they replace the synthesized crossbar
   * and post sounds; without them the synth versions play.
   */
  private samples = new Map<string, AudioBuffer>();
  private samplesRequested = false;

  private async loadSample(name: string) {
    for (const ext of ['mp3', 'm4a', 'wav']) {
      try {
        const res = await fetch(`./sounds/${name}.${ext}`);
        const type = res.headers.get('content-type') || '';
        if (!res.ok || type.includes('text/html')) continue;
        const buf = await res.arrayBuffer();
        const audio = await new Promise<AudioBuffer>((resolve, reject) => this.ctx!.decodeAudioData(buf, resolve, reject));
        this.samples.set(name, audio);
        return;
      } catch {
        /* missing or undecodable: keep trying, then fall back to synth */
      }
    }
  }

  private playSample(name: string, vol = 1, rate = 1) {
    const buf = this.samples.get(name);
    if (!buf || !this.ok()) return false;
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.master!);
    src.start();
    return true;
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
        if (!this.playSample('post', 0.8, 0.92) && !this.playSample('bardown', 0.7, 0.85)) this.metalRing(0.82, 0.85);
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
      case 'horn':
        this.goalHorn();
        break;
      case 'groan':
        this.noise(1.2, 0.18, 'lowpass', 500);
        this.tone(220, 0.9, 'triangle', 0.05, 140);
        this.cheer(0.9, 0.06);
        break;
      case 'ooh':
        this.tone(330, 0.6, 'triangle', 0.05, 440);
        this.cheer(1, 0.12);
        break;
      case 'crossbar':
        if (!this.playSample('post', 0.9) && !this.playSample('bardown', 0.8)) this.metalRing(1, 1);
        break;
      case 'bardown':
        if (!this.playSample('bardown', 1)) this.metalRing(1, 1.15);
        // puck snaps the twine, then the building erupts
        this.noise(0.28, 0.22, 'bandpass', 2600, 0.09, 0.9);
        this.noise(0.12, 0.12, 'lowpass', 700, 0.1);
        this.cheer(3, 0.26);
        break;
      case 'chant': {
        // organ "let's go ___" then clap clap clap-clap-clap
        const org = ['C5', 'C5', 'G5'];
        org.forEach((n, i) => this.tone(NOTE[n], 0.16, 'square', 0.06, 0, i * 0.2));
        [0.75, 1.0, 1.25, 1.375, 1.5].forEach((t) => this.noise(0.05, 0.25, 'bandpass', 1500, t, 1.2));
        break;
      }
      case 'punch':
        if (power <= 0) {
          this.noise(0.06, 0.18, 'lowpass', 900);
          this.tone(300, 0.05, 'triangle', 0.08, 200);
        } else {
          this.noise(0.09, 0.32 * power, 'lowpass', 1400);
          this.tone(130, 0.12, 'square', 0.16, 55);
          this.noise(0.03, 0.2, 'highpass', 3000);
          if (power >= 2) this.cheer(1.2, 0.16);
        }
        break;
      case 'whoosh':
        this.noise(0.25, 0.08, 'highpass', 3000);
        break;
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

  private reverbIn: GainNode | null = null;

  /** Small arena echo: two cross-fed delays with damping, shared by impact sounds. */
  private arenaVerb() {
    if (this.reverbIn || !this.ctx || !this.master) return this.reverbIn;
    const c = this.ctx;
    const input = c.createGain();
    input.gain.value = 0.32;
    const out = c.createGain();
    out.gain.value = 1;
    out.connect(this.master);
    for (const [time, fb] of [[0.083, 0.42], [0.127, 0.38], [0.191, 0.3]] as [number, number][]) {
      const d = c.createDelay(1);
      d.delayTime.value = time;
      const damp = c.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 3200;
      const g = c.createGain();
      g.gain.value = fb;
      input.connect(d);
      d.connect(damp);
      damp.connect(g);
      g.connect(d);
      damp.connect(out);
    }
    this.reverbIn = input;
    return input;
  }

  /**
   * A frozen puck striking a steel crossbar: a sharp click, a short low thud
   * from the impact, then the bright "TING" of a hollow steel tube (inharmonic
   * free-bar modes that beat slightly and ring out), echoing round the arena.
   * pitch scales the frequencies, vol the loudness.
   */
  private metalRing(pitch: number, vol: number) {
    if (!this.ok()) return;
    const c = this.ctx!;
    const t = c.currentTime;
    const verb = this.arenaVerb();
    const out = c.createGain();
    out.gain.value = vol;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    out.connect(hp);
    hp.connect(this.master!);
    if (verb) hp.connect(verb);
    // contact click: a few milliseconds of bright noise
    if (this.noiseBuf) {
      const n = c.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2500;
      const g = c.createGain();
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
      n.connect(f);
      f.connect(g);
      g.connect(out);
      n.start(t, Math.random());
      n.stop(t + 0.02);
    }
    // puck thud
    const th = c.createOscillator();
    const tg = c.createGain();
    th.type = 'sine';
    th.frequency.setValueAtTime(240, t);
    th.frequency.exponentialRampToValueAtTime(90, t + 0.05);
    tg.gain.setValueAtTime(0.25, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    th.connect(tg);
    tg.connect(out);
    th.start(t);
    th.stop(t + 0.08);
    // the ring: steel tube modes (1 : 2.756 : 5.404 : 8.933), each a beating pair
    const f0 = 1520 * pitch;
    const partials: [number, number, number][] = [
      [1, 0.11, 0.75],
      [2.756, 0.14, 0.6],
      [5.404, 0.07, 0.38],
      [8.933, 0.035, 0.22],
      [13.34, 0.018, 0.12],
    ];
    for (const [ratio, amp, decay] of partials) {
      for (const det of [-3.5, 3.5]) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        const f = f0 * ratio + det * ratio;
        o.frequency.setValueAtTime(f * 1.008, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.002);
        g.gain.exponentialRampToValueAtTime(amp * 0.35, t + decay * 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + decay + 0.05);
      }
    }
  }

  /** Arena goal horn: long, detuned low brass chord with vibrato. */
  goalHorn(delay = 0) {
    if (!this.ok()) return;
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
    out.gain.setValueAtTime(0.16, t + 2.4);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(out);
    out.connect(this.master!);
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 2.5;
    lfo.connect(lfoGain);
    for (const [f, det] of [[110, -6], [110, 7], [138.6, 0], [164.8, -4], [220, 5]] as [number, number][]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      lfoGain.connect(o.frequency);
      o.connect(lp);
      o.start(t);
      o.stop(t + 3.05);
    }
    lfo.start(t);
    lfo.stop(t + 3.05);
    if (!delay) this.cheer(4, 0.22);
  }

  /** A short chiptune goal song generated from the team name, so every club sounds different. */
  goalSong(seed: number, delay = 2.6) {
    if (!this.ok()) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    let h = seed >>> 0;
    const next = () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
      return (h ^ (h >>> 16)) >>> 0;
    };
    const root = 60 + (next() % 7);
    const step = 0.13;
    const motif: number[] = [];
    for (let i = 0; i < 4; i++) motif.push(scale[next() % scale.length]);
    const seq = [...motif, ...motif, ...motif.map((n) => n + 2), 12, -1, 12, 12];
    seq.forEach((n, i) => {
      if (n < 0) return;
      const f = 440 * Math.pow(2, (root + n - 69) / 12);
      this.tone(f, step * 0.9, 'square', 0.06, 0, delay + i * step);
      if (i % 4 === 0) this.tone(f / 4, step * 3.5, 'triangle', 0.12, 0, delay + i * step);
    });
  }

  cheer(dur = 2, vol = 0.22) {
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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
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
