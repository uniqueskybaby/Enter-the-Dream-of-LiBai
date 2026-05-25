export type MusicMood =
  | 'home'
  | 'lushan'
  | 'moon_three'
  | 'yellow_river'
  | 'yangtze_farewell'
  | 'ending';

export type SoundEffect =
  | 'uiTap'
  | 'panelOpen'
  | 'panelClose'
  | 'hotspotMoon'
  | 'hotspotWine'
  | 'hotspotWater'
  | 'hotspotWind'
  | 'hotspotShadow'
  | 'hotspotLocked'
  | 'puzzlePick'
  | 'puzzleCorrect'
  | 'puzzleWrong'
  | 'clueCollect'
  | 'transition'
  | 'gateOpen'
  | 'achievement'
  | 'hiddenReveal'
  | 'startDream'
  | 'endingReveal';

export interface AudioPreferences {
  enabled: boolean;
  musicVolume: number;
  sfxVolume: number;
}

interface MusicProfile {
  root: number;
  scale: number[];
  pluckEveryMs: number;
  pluckGain: number;
  droneGain: number;
  ambience: 'wind' | 'water' | 'river' | 'night';
  lowPulse?: boolean;
}

interface MusicHandle {
  mood: MusicMood;
  gain: GainNode;
  timers: number[];
  stopSources: Array<() => void>;
}

const STORAGE_KEY = 'dream-li-bai-audio-prefs';

const DEFAULT_PREFS: AudioPreferences = {
  enabled: true,
  musicVolume: 0.42,
  sfxVolume: 0.72,
};

const musicProfiles: Record<MusicMood, MusicProfile> = {
  home: {
    root: 146.83,
    scale: [0, 2, 5, 7, 9, 12, 14],
    pluckEveryMs: 2600,
    pluckGain: 0.12,
    droneGain: 0.048,
    ambience: 'wind',
  },
  lushan: {
    root: 185.0,
    scale: [0, 2, 5, 7, 9, 12, 17],
    pluckEveryMs: 3100,
    pluckGain: 0.1,
    droneGain: 0.055,
    ambience: 'water',
  },
  moon_three: {
    root: 220.0,
    scale: [0, 3, 5, 7, 10, 12, 15],
    pluckEveryMs: 3400,
    pluckGain: 0.09,
    droneGain: 0.044,
    ambience: 'night',
  },
  yellow_river: {
    root: 110.0,
    scale: [0, 2, 5, 7, 10, 12, 14],
    pluckEveryMs: 2100,
    pluckGain: 0.11,
    droneGain: 0.065,
    ambience: 'river',
    lowPulse: true,
  },
  yangtze_farewell: {
    root: 164.81,
    scale: [0, 2, 4, 7, 9, 12, 16],
    pluckEveryMs: 3600,
    pluckGain: 0.085,
    droneGain: 0.04,
    ambience: 'wind',
  },
  ending: {
    root: 196.0,
    scale: [0, 2, 5, 7, 9, 12, 14],
    pluckEveryMs: 4200,
    pluckGain: 0.075,
    droneGain: 0.05,
    ambience: 'night',
  },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizePrefs(value: Partial<AudioPreferences>): AudioPreferences {
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_PREFS.enabled,
    musicVolume: clamp01(typeof value.musicVolume === 'number' ? value.musicVolume : DEFAULT_PREFS.musicVolume),
    sfxVolume: clamp01(typeof value.sfxVolume === 'number' ? value.sfxVolume : DEFAULT_PREFS.sfxVolume),
  };
}

export function loadAudioPreferences(): AudioPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return normalizePrefs(JSON.parse(raw) as Partial<AudioPreferences>);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveAudioPreferences(prefs: AudioPreferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePrefs(prefs)));
}

export function musicMoodForGame(gameId: string): MusicMood {
  if (gameId.includes('yellow_river')) return 'yellow_river';
  if (gameId.includes('yangtze')) return 'yangtze_farewell';
  if (gameId.includes('moon_three')) return 'moon_three';
  if (gameId.includes('lushan')) return 'lushan';
  return 'home';
}

export function soundForHotspot(hotspotId: string, label?: string): SoundEffect {
  const key = `${hotspotId} ${label ?? ''}`.toLowerCase();
  if (key.includes('moon') || key.includes('月')) return 'hotspotMoon';
  if (key.includes('wine') || key.includes('酒') || key.includes('cup')) return 'hotspotWine';
  if (key.includes('water') || key.includes('river') || key.includes('sea') || key.includes('瀑') || key.includes('河') || key.includes('江') || key.includes('海')) return 'hotspotWater';
  if (key.includes('sky') || key.includes('heaven') || key.includes('sail') || key.includes('天') || key.includes('帆')) return 'hotspotWind';
  if (key.includes('shadow') || key.includes('影')) return 'hotspotShadow';
  return 'uiTap';
}

export class AudioDirector {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private prefs = loadAudioPreferences();
  private currentMusic: MusicHandle | null = null;

  setPreferences(nextPrefs: AudioPreferences) {
    this.prefs = normalizePrefs(nextPrefs);
    saveAudioPreferences(this.prefs);
    this.applyGains();
    if (this.prefs.enabled) void this.resume();
  }

  async resume() {
    const context = this.ensureContext();
    if (!context || context.state === 'running') return;
    await context.resume().catch(() => undefined);
  }

  playMusic(mood: MusicMood) {
    const context = this.ensureContext();
    if (!context || !this.musicBus) return;
    if (this.currentMusic?.mood === mood) return;

    this.stopMusic(1.2);
    this.currentMusic = this.createMusic(context, mood);
    this.applyGains();
  }

  stopMusic(fadeSeconds = 0.6) {
    if (!this.context || !this.currentMusic) return;

    const handle = this.currentMusic;
    this.currentMusic = null;
    handle.timers.forEach((timer) => window.clearInterval(timer));

    const now = this.context.currentTime;
    handle.gain.gain.cancelScheduledValues(now);
    handle.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.05, fadeSeconds / 3));

    window.setTimeout(() => {
      handle.stopSources.forEach((stop) => stop());
      handle.gain.disconnect();
    }, fadeSeconds * 1000 + 120);
  }

  play(effect: SoundEffect, intensity = 1) {
    if (!this.prefs.enabled) return;
    const context = this.ensureContext();
    if (!context || !this.sfxBus) return;
    void this.resume();

    const gain = clamp01(intensity);
    const now = context.currentTime + 0.015;

    switch (effect) {
      case 'uiTap':
        this.playChime([880], now, 0.18, 0.16 * gain);
        break;
      case 'panelOpen':
        this.playFilteredNoise(now, 0.34, 0.06 * gain, 'bandpass', 1400, 1.1);
        this.playChime([587.33, 783.99], now + 0.04, 0.46, 0.09 * gain);
        break;
      case 'panelClose':
        this.playFilteredNoise(now, 0.24, 0.045 * gain, 'lowpass', 900, 0.8);
        this.playTone(523.25, now, 0.18, 0.08 * gain, 'triangle');
        break;
      case 'hotspotMoon':
        this.playChime([987.77, 1318.51, 1760], now, 1.1, 0.09 * gain);
        break;
      case 'hotspotWine':
        this.playChime([1174.66, 1567.98], now, 0.55, 0.11 * gain);
        this.playFilteredNoise(now, 0.08, 0.08 * gain, 'highpass', 3600, 2.8);
        break;
      case 'hotspotWater':
        this.playFilteredNoise(now, 0.72, 0.12 * gain, 'bandpass', 680, 0.72, true);
        this.playChime([659.25], now + 0.18, 0.5, 0.07 * gain);
        break;
      case 'hotspotWind':
        this.playFilteredNoise(now, 0.86, 0.09 * gain, 'bandpass', 1080, 0.62, true);
        this.playTone(739.99, now + 0.18, 0.7, 0.06 * gain, 'sine');
        break;
      case 'hotspotShadow':
        this.playTone(392, now, 0.36, 0.08 * gain, 'sine');
        this.playTone(587.33, now + 0.12, 0.48, 0.055 * gain, 'triangle');
        break;
      case 'hotspotLocked':
        this.playTone(164.81, now, 0.28, 0.12 * gain, 'triangle', 120);
        this.playFilteredNoise(now, 0.12, 0.08 * gain, 'lowpass', 420, 1.4);
        break;
      case 'puzzlePick':
        this.playFilteredNoise(now, 0.12, 0.07 * gain, 'bandpass', 1800, 1.8);
        this.playTone(698.46, now + 0.02, 0.12, 0.05 * gain, 'triangle');
        break;
      case 'puzzleCorrect':
        this.playChime([523.25, 659.25, 783.99, 1046.5], now, 0.9, 0.1 * gain);
        break;
      case 'puzzleWrong':
        this.playTone(392, now, 0.22, 0.08 * gain, 'sine', -160);
        this.playTone(293.66, now + 0.14, 0.34, 0.06 * gain, 'triangle', -80);
        break;
      case 'clueCollect':
        this.playChime([783.99, 987.77, 1174.66, 1567.98], now, 1.2, 0.1 * gain);
        this.playFilteredNoise(now, 0.5, 0.065 * gain, 'highpass', 2600, 0.9, true);
        break;
      case 'transition':
        this.playFilteredNoise(now, 1.18, 0.15 * gain, 'bandpass', 620, 0.45, true);
        this.playTone(110, now, 0.7, 0.1 * gain, 'sine', -240);
        this.playChime([523.25, 880, 1318.51], now + 0.22, 1.1, 0.08 * gain);
        break;
      case 'gateOpen':
        this.playTone(98, now, 1.1, 0.16 * gain, 'sine', -60);
        this.playChime([392, 587.33, 880, 1174.66], now + 0.12, 1.25, 0.09 * gain);
        break;
      case 'achievement':
        this.playChime([1046.5, 1318.51, 1567.98], now, 1.0, 0.09 * gain);
        break;
      case 'hiddenReveal':
        this.playFilteredNoise(now, 0.92, 0.08 * gain, 'bandpass', 1280, 0.58, true);
        this.playChime([659.25, 987.77, 1396.91], now + 0.18, 1.1, 0.075 * gain);
        break;
      case 'startDream':
        this.playChime([392, 587.33, 783.99, 1174.66], now, 1.2, 0.1 * gain);
        this.playFilteredNoise(now, 0.8, 0.07 * gain, 'bandpass', 980, 0.7, true);
        break;
      case 'endingReveal':
        this.playTone(196, now, 1.4, 0.13 * gain, 'sine', 50);
        this.playChime([587.33, 783.99, 987.77, 1567.98], now + 0.2, 1.5, 0.11 * gain);
        break;
    }
  }

  dispose() {
    this.stopMusic(0.1);
    void this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.musicBus = null;
    this.sfxBus = null;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.context) return this.context;

    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return null;

    const context = new AudioContextCtor();
    const masterGain = context.createGain();
    const musicBus = context.createGain();
    const sfxBus = context.createGain();

    musicBus.connect(masterGain);
    sfxBus.connect(masterGain);
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    this.musicBus = musicBus;
    this.sfxBus = sfxBus;
    this.applyGains();
    return context;
  }

  private applyGains() {
    if (!this.context || !this.masterGain || !this.musicBus || !this.sfxBus) return;

    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(this.prefs.enabled ? 1 : 0.0001, now, 0.04);
    this.musicBus.gain.setTargetAtTime(this.prefs.musicVolume, now, 0.08);
    this.sfxBus.gain.setTargetAtTime(this.prefs.sfxVolume, now, 0.035);
  }

  private createMusic(context: AudioContext, mood: MusicMood): MusicHandle {
    const profile = musicProfiles[mood];
    const gain = context.createGain();
    const timers: number[] = [];
    const stopSources: Array<() => void> = [];
    const now = context.currentTime;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(1, now + 1.4);
    gain.connect(this.musicBus!);

    this.addDrone(profile.root, 'sine', profile.droneGain, gain, stopSources);
    this.addDrone(profile.root * 1.5, 'triangle', profile.droneGain * 0.46, gain, stopSources, 4);
    this.addDrone(profile.root * 2, 'sine', profile.droneGain * 0.22, gain, stopSources, -6);
    this.addAmbience(profile, gain, stopSources);

    const timer = window.setInterval(() => this.playMusicFigure(profile, gain), profile.pluckEveryMs);
    timers.push(timer);
    window.setTimeout(() => this.playMusicFigure(profile, gain), 420);

    if (profile.lowPulse) {
      const pulseTimer = window.setInterval(() => this.playLowPulse(gain), 3600);
      timers.push(pulseTimer);
      window.setTimeout(() => this.playLowPulse(gain), 900);
    }

    return { mood, gain, timers, stopSources };
  }

  private addDrone(
    frequency: number,
    type: OscillatorType,
    amount: number,
    destination: AudioNode,
    stopSources: Array<() => void>,
    detune = 0,
  ) {
    if (!this.context) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    gain.gain.value = amount;
    osc.connect(gain).connect(destination);
    osc.start();
    stopSources.push(() => {
      try {
        osc.stop();
      } catch {
        // Oscillator may already be stopped during fast scene changes.
      }
      osc.disconnect();
      gain.disconnect();
    });
  }

  private addAmbience(profile: MusicProfile, destination: AudioNode, stopSources: Array<() => void>) {
    if (!this.context) return;
    const context = this.context;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const duration = 3;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;

    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.88 + white * 0.12;
      data[i] = last;
    }

    const settings = {
      wind: { type: 'bandpass' as BiquadFilterType, frequency: 760, q: 0.56, gain: 0.026 },
      water: { type: 'lowpass' as BiquadFilterType, frequency: 1180, q: 0.72, gain: 0.04 },
      river: { type: 'lowpass' as BiquadFilterType, frequency: 620, q: 0.48, gain: 0.058 },
      night: { type: 'bandpass' as BiquadFilterType, frequency: 1480, q: 0.82, gain: 0.018 },
    }[profile.ambience];

    source.buffer = buffer;
    source.loop = true;
    filter.type = settings.type;
    filter.frequency.value = settings.frequency;
    filter.Q.value = settings.q;
    gain.gain.value = settings.gain;

    source.connect(filter).connect(gain).connect(destination);
    source.start();
    stopSources.push(() => {
      try {
        source.stop();
      } catch {
        // Buffer source may already be stopped during fast scene changes.
      }
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    });
  }

  private playMusicFigure(profile: MusicProfile, destination: AudioNode) {
    if (!this.context) return;
    const now = this.context.currentTime + 0.04;
    const count = Math.random() > 0.66 ? 3 : 2;

    for (let index = 0; index < count; index += 1) {
      const degree = profile.scale[Math.floor(Math.random() * profile.scale.length)];
      const octave = Math.random() > 0.72 ? 12 : 0;
      const frequency = profile.root * 2 ** ((degree + octave) / 12);
      this.playTone(frequency, now + index * 0.28, 1.7 - index * 0.18, profile.pluckGain * (index === 0 ? 1 : 0.68), index === 0 ? 'triangle' : 'sine', 0, destination);
    }
  }

  private playLowPulse(destination: AudioNode) {
    if (!this.context) return;
    const now = this.context.currentTime + 0.02;
    this.playTone(73.42, now, 0.74, 0.12, 'sine', -220, destination);
    this.playFilteredNoise(now, 0.36, 0.08, 'lowpass', 220, 0.9, false, destination);
  }

  private playChime(frequencies: number[], startTime: number, duration: number, gain: number) {
    frequencies.forEach((frequency, index) => {
      this.playTone(frequency, startTime + index * 0.075, duration, gain * (1 - index * 0.08), 'sine');
      this.playTone(frequency * 2.01, startTime + index * 0.075, duration * 0.72, gain * 0.25, 'triangle');
    });
  }

  private playTone(
    frequency: number,
    startTime: number,
    duration: number,
    gainAmount: number,
    type: OscillatorType,
    detuneEnd = 0,
    destination: AudioNode = this.sfxBus!,
  ) {
    if (!this.context) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const attack = Math.min(0.035, duration * 0.18);
    const releaseStart = startTime + Math.max(attack + 0.02, duration * 0.32);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    if (detuneEnd !== 0) {
      osc.detune.setValueAtTime(0, startTime);
      osc.detune.linearRampToValueAtTime(detuneEnd, startTime + duration);
    }

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, gainAmount), startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + duration * 0.68);

    osc.connect(gain).connect(destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.08);
  }

  private playFilteredNoise(
    startTime: number,
    duration: number,
    gainAmount: number,
    type: BiquadFilterType,
    frequency: number,
    q: number,
    swell = false,
    destination: AudioNode = this.sfxBus!,
  ) {
    if (!this.context) return;

    const context = this.context;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      const progress = i / Math.max(1, data.length - 1);
      const fade = swell ? Math.sin(progress * Math.PI) : Math.max(0, 1 - progress);
      data[i] = (Math.random() * 2 - 1) * fade;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = buffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, startTime);
    filter.Q.value = q;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(gainAmount, startTime + Math.min(0.08, duration * 0.24));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.connect(filter).connect(gain).connect(destination);
    source.start(startTime);
  }
}
