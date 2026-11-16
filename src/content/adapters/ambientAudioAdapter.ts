import { AmbientSoundChannel, AmbientSoundLevels } from '../../shared/types';

export const DEFAULT_AMBIENT_SOUND_LEVELS: AmbientSoundLevels = {
  rain: 0,
  vinyl: 0,
  fireplace: 0,
  cafe: 0,
};

interface ChannelNodes {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
}

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channels = new Map<AmbientSoundChannel, ChannelNodes>();
  private levels: AmbientSoundLevels = { ...DEFAULT_AMBIENT_SOUND_LEVELS };
  private masterMultiplier = 1.0;
  private paused = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.paused ? 0 : this.masterMultiplier;
      this.masterGain.connect(this.ctx.destination);
      this.channels.clear();
    }
    return this.ctx;
  }

  private createNoiseBuffer(
    ctx: AudioContext,
    durationSec: number,
    generator: (prevSample: number, idx: number, sampleRate: number) => number
  ): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let prev = 0;
      for (let i = 0; i < length; i++) {
        const val = generator(prev, i, ctx.sampleRate);
        data[i] = Math.max(-1, Math.min(1, val));
        prev = data[i];
      }
      // Smooth 15ms cross-fade at seam so buffers loop without audible ticks
      const fadeSamples = Math.min(Math.floor(ctx.sampleRate * 0.015), Math.floor(length / 8));
      for (let i = 0; i < fadeSamples; i++) {
        const w = i / fadeSamples;
        const tailIdx = length - fadeSamples + i;
        data[i] = data[i] * w + data[tailIdx] * (1 - w);
      }
    }
    return buffer;
  }

  private buildChannel(channel: AmbientSoundChannel): ChannelNodes | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return null;

    const existing = this.channels.get(channel);
    if (existing) return existing;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.masterGain);
    const sources: AudioScheduledSourceNode[] = [];

    if (channel === 'rain') {
      const buffer = this.createNoiseBuffer(ctx, 4, (prev) => {
        const white = Math.random() * 2 - 1;
        return prev * 0.65 + white * 0.28;
      });
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 2400;

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 220;

      src.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gain);
      src.start();
      sources.push(src);
    } else if (channel === 'vinyl') {
      const buffer = this.createNoiseBuffer(ctx, 5, (prev, _idx, sampleRate) => {
        const warmHum = prev * 0.88 + (Math.random() * 2 - 1) * 0.03;
        // Occasional soft surface dust tick (~2.2 ticks/sec)
        const spike =
          Math.random() < 2.2 / sampleRate ? (Math.random() * 2 - 1) * 0.72 : 0;
        return warmHum * 0.32 + spike;
      });
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1850;
      bandpass.Q.value = 0.65;

      src.connect(bandpass);
      bandpass.connect(gain);
      src.start();
      sources.push(src);
    } else if (channel === 'fireplace') {
      const rumbleBuf = this.createNoiseBuffer(ctx, 4.5, (prev, _idx, sampleRate) => {
        const deep = prev * 0.94 + (Math.random() * 2 - 1) * 0.14;
        const pop =
          Math.random() < 1.8 / sampleRate ? (Math.random() * 2 - 1) * 0.55 : 0;
        return deep + pop;
      });
      const src = ctx.createBufferSource();
      src.buffer = rumbleBuf;
      src.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 620;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.22;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(lowpass.frequency);

      src.connect(lowpass);
      lowpass.connect(gain);
      src.start();
      lfo.start();
      sources.push(src, lfo);
    } else {
      // cafe
      const roomBuf = this.createNoiseBuffer(ctx, 5, (prev) => {
        return prev * 0.85 + (Math.random() * 2 - 1) * 0.16;
      });
      const src = ctx.createBufferSource();
      src.buffer = roomBuf;
      src.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 460;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 95;
      lfo.connect(lfoGain);
      lfoGain.connect(lowpass.frequency);

      src.connect(lowpass);
      lowpass.connect(gain);
      src.start();
      lfo.start();
      sources.push(src, lfo);
    }

    const created: ChannelNodes = { gain, sources };
    this.channels.set(channel, created);
    return created;
  }

  private hasAnyActiveChannel(): boolean {
    return Object.values(this.levels).some((v) => v > 0);
  }

  private syncSuspendState() {
    if (!this.ctx || this.ctx.state === 'closed') return;
    if (!this.hasAnyActiveChannel() || this.paused) {
      if (this.ctx.state === 'running') {
        void this.ctx.suspend().catch(() => {});
      }
      return;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setLevels(nextLevels: AmbientSoundLevels): void {
    this.levels = { ...nextLevels };
    const active = this.hasAnyActiveChannel();
    if (!active && !this.ctx) return;

    if (active) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      (Object.keys(this.levels) as AmbientSoundChannel[]).forEach((ch) => {
        const level = Math.max(0, Math.min(100, this.levels[ch] || 0));
        if (level > 0 || this.channels.has(ch)) {
          const nodes = this.buildChannel(ch);
          if (nodes) {
            const maxGain = ch === 'vinyl' ? 0.34 : ch === 'rain' ? 0.28 : 0.42;
            const target = (level / 100) * maxGain;
            nodes.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
          }
        }
      });
    } else if (this.ctx && this.ctx.state !== 'closed') {
      for (const nodes of this.channels.values()) {
        nodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    }

    this.syncSuspendState();
  }

  public setMasterMultiplier(multiplier: number): void {
    this.masterMultiplier = Math.max(0, Math.min(1, multiplier));
    if (this.ctx && this.masterGain && this.ctx.state !== 'closed') {
      const target = this.paused ? 0 : this.masterMultiplier;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.ctx && this.masterGain && this.ctx.state !== 'closed') {
      const target = paused ? 0 : this.masterMultiplier;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
    this.syncSuspendState();
  }

  public dispose(): void {
    for (const nodes of this.channels.values()) {
      nodes.sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          // Ignore already stopped sources
        }
        try {
          s.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      });
      try {
        nodes.gain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    this.channels.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this.levels = { ...DEFAULT_AMBIENT_SOUND_LEVELS };
    this.masterMultiplier = 1.0;
    this.paused = false;
  }
}

const sharedAmbientEngine = new AmbientAudioEngine();

export function updateAmbientSoundLevels(levels: AmbientSoundLevels): void {
  sharedAmbientEngine.setLevels(levels);
}

export function setAmbientMasterMultiplier(multiplier: number): void {
  sharedAmbientEngine.setMasterMultiplier(multiplier);
}

export function setAmbientAudioPaused(paused: boolean): void {
  sharedAmbientEngine.setPaused(paused);
}

export function disposeAmbientAudio(): void {
  sharedAmbientEngine.dispose();
}
