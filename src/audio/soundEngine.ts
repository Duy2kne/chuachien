/**
 * Web Audio Engine cho Chùa Online 3D
 * Hoàn toàn procedural, không phụ thuộc file âm thanh ngoài, không vi phạm bản quyền.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;

  private isMusicPlaying = false;
  private musicTimer: number | null = null;
  private droneNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

  // Âm lượng lưu trong localStorage (0.0 -> 1.0)
  public musicVolume = 0.55;
  public sfxVolume = 0.8;
  public isMuted = false;

  constructor() {
    // Đọc cài đặt đã lưu
    try {
      const savedMVol = localStorage.getItem('chua_music_volume');
      const savedSVol = localStorage.getItem('chua_sfx_volume');
      const savedMute = localStorage.getItem('chua_is_muted');
      if (savedMVol !== null) this.musicVolume = parseFloat(savedMVol);
      if (savedSVol !== null) this.sfxVolume = parseFloat(savedSVol);
      if (savedMute !== null) this.isMuted = savedMute === 'true';
    } catch {}
  }

  public init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Master
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);

    // Music
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);

    // SFX
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    // Tạo procedural impulse response cho Reverb chánh điện
    this.convolver = this.createSyntheticReverb(2.8, 2.2);
    this.loadCustomSamples();
  }

  private createSyntheticReverb(seconds: number, decay: number): ConvolverNode | null {
    if (!this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const length = rate * seconds;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const factor = Math.exp(-n * decay);
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }

    const conv = this.ctx.createConvolver();
    conv.buffer = impulse;
    conv.connect(this.sfxGain!);
    return conv;
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    try { localStorage.setItem('chua_music_volume', this.musicVolume.toString()); } catch {}
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    try { localStorage.setItem('chua_sfx_volume', this.sfxVolume.toString()); } catch {}
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 1;
    }
    try { localStorage.setItem('chua_is_muted', this.isMuted ? 'true' : 'false'); } catch {}
    return this.isMuted;
  }

  // ===================== TIẾNG CHUÔNG ĐẠI HỒNG CHUNG =====================
  // Chuông đồng lớn có nhiều bồi âm (inharmonic), lệch tần số tạo tiếng ngân "uồm... uồm", ngân dài ~10s
  public playBigBell(distanceFactor = 1.0) {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    if (this.playSample('bell', Math.max(0.1, Math.min(1, 1 / (distanceFactor || 1))))) return;
    const t = this.ctx.currentTime;
    const fundamental = 138.59; // Nốt C#3 trầm hùng tráng

    // Ratios bồi âm của chuông đồng cổ điển Việt Nam / Á Đông
    const partials = [
      { ratio: 0.5, amp: 0.6, decay: 10.0 }, // Hum tone (âm đáy)
      { ratio: 1.0, amp: 1.0, decay: 9.0 },  // Strike tone
      { ratio: 1.48, amp: 0.7, decay: 7.5 },
      { ratio: 2.06, amp: 0.5, decay: 6.0 },
      { ratio: 2.78, amp: 0.4, decay: 4.5 },
      { ratio: 3.85, amp: 0.25, decay: 3.5 },
      { ratio: 5.12, amp: 0.15, decay: 2.0 }
    ];

    const bellOutput = this.ctx.createGain();
    bellOutput.gain.value = Math.max(0.1, Math.min(1, 1 / (distanceFactor || 1)));

    if (this.convolver) {
      const reverbSend = this.ctx.createGain();
      reverbSend.gain.value = 0.5;
      bellOutput.connect(reverbSend);
      reverbSend.connect(this.convolver);
    }
    bellOutput.connect(this.sfxGain);

    for (const p of partials) {
      // 2 dao động hơi lệch nhau (detuned) để sinh ra nhịp đập ngân vang (beating)
      for (const detune of [-1.2, 1.2]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamental * p.ratio, t);
        osc.detune.setValueAtTime(detune, t);

        // Vang nở và ngân tắt dần
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(p.amp * 0.15, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

        osc.connect(gain);
        gain.connect(bellOutput);

        osc.start(t);
        osc.stop(t + p.decay + 0.5);
      }
    }

    // Tiếng chạm chày gỗ vào chuông (clapper strike noise click)
    const strikeOsc = this.ctx.createOscillator();
    const strikeGain = this.ctx.createGain();
    strikeOsc.type = 'triangle';
    strikeOsc.frequency.setValueAtTime(75, t);
    strikeOsc.frequency.exponentialRampToValueAtTime(30, t + 0.1);
    strikeGain.gain.setValueAtTime(0.3, t);
    strikeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    strikeOsc.connect(strikeGain);
    strikeGain.connect(bellOutput);
    strikeOsc.start(t);
    strikeOsc.stop(t + 0.15);
  }

  // ===================== TIẾNG MÕ GỖ (WOODEN FISH) =====================
  public playWoodenFish(distanceFactor = 1.0) {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const vol = Math.max(0.05, Math.min(1, 1 / (distanceFactor || 1)));
    if (this.playSample('woodfish', vol)) return;
    const t = this.ctx.currentTime;

    // Thân gỗ rỗng cộng hưởng bandpass
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);
    filter.Q.setValueAtTime(7.0, t);

    const gain = this.ctx.createGain();
    gain.gain.value = vol * 0.7;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    // Cao độ tụt nhanh mô phỏng gõ dùi gỗ
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.05);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    osc.connect(oscGain);
    oscGain.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    if (this.convolver) {
      const rev = this.ctx.createGain();
      rev.gain.value = 0.25;
      gain.connect(rev);
      rev.connect(this.convolver);
    }

    osc.start(t);
    osc.stop(t + 0.2);
  }

  // ===================== TIẾNG TRỐNG BÁT NHÃ =====================
  // Trống da trâu thân gỗ lớn: tiếng "thùng" trầm ấm (2-3 mode cộng hưởng tụt cao độ),
  // tiếng da căng khi dùi chạm, ngân vang trong lầu. Có thể thay bằng file public/sfx/drum.mp3
  public playDrum(distanceFactor = 1.0, accent = 1.0) {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const vol = Math.max(0.1, Math.min(1, 1 / (distanceFactor || 1))) * accent;
    if (this.playSample('drum', vol)) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.value = vol;
    const warm = ctx.createWaveShaper();
    warm.curve = this.getSaturationCurve();
    out.connect(warm);
    warm.connect(this.sfxGain);
    if (this.convolver) {
      const rev = ctx.createGain();
      rev.gain.value = 0.55;
      warm.connect(rev);
      rev.connect(this.convolver);
    }

    // 1. Thân trống: các mode cộng hưởng, cao độ tụt nhanh lúc đầu (da trống chùng lại)
    const modes: [number, number, number, number][] = [
      [96, 56, 1.0, 1.6],
      [158, 102, 0.42, 0.8],
      [236, 168, 0.16, 0.4]
    ];
    for (const [f0, f1, amp, decay] of modes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }

    // 2. Tiếng da trống: nhiễu lọc dải trầm-trung, tắt nhanh
    const skin = ctx.createBufferSource();
    skin.buffer = this.getNoiseBuffer();
    const skinFilter = ctx.createBiquadFilter();
    skinFilter.type = 'bandpass';
    skinFilter.frequency.setValueAtTime(420, t);
    skinFilter.frequency.exponentialRampToValueAtTime(160, t + 0.2);
    skinFilter.Q.value = 1.2;
    const skinGain = ctx.createGain();
    skinGain.gain.setValueAtTime(0.55, t);
    skinGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    skin.connect(skinFilter);
    skinFilter.connect(skinGain);
    skinGain.connect(out);
    skin.start(t);
    skin.stop(t + 0.3);

    // 3. Tiếng dùi gỗ chạm mặt trống
    const click = ctx.createBufferSource();
    click.buffer = this.getNoiseBuffer();
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.value = 1800;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.25, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(out);
    click.start(t);
    click.stop(t + 0.05);
  }

  private noiseBuffer: AudioBuffer | null = null;
  private getNoiseBuffer(): AudioBuffer {
    if (!this.noiseBuffer && this.ctx) {
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer!;
  }

  private saturationCurve: Float32Array<ArrayBuffer> | null = null;
  private getSaturationCurve(): Float32Array<ArrayBuffer> {
    if (!this.saturationCurve) {
      const n = 1024;
      this.saturationCurve = new Float32Array(new ArrayBuffer(n * 4));
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        this.saturationCurve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
      }
    }
    return this.saturationCurve;
  }

  // ===================== ÂM THANH TỪ FILE (TUỲ CHỌN) =====================
  // Bỏ file vào public/sfx với tên drum / bell / woodfish / chime (.mp3, .ogg, .wav)
  // thì sẽ dùng file đó thay cho âm thanh tổng hợp.
  private samples = new Map<string, AudioBuffer>();
  private samplesRequested = false;

  private loadCustomSamples() {
    if (this.samplesRequested || !this.ctx) return;
    this.samplesRequested = true;
    fetch('/api/sfx')
      .then(res => (res.ok ? res.json() : []))
      .then(async (files: string[]) => {
        for (const file of files) {
          const key = file.replace(/\.[^/.]+$/, '').toLowerCase();
          if (!['drum', 'bell', 'woodfish', 'chime'].includes(key)) continue;
          try {
            const buf = await (await fetch(`/sfx/${encodeURIComponent(file)}`)).arrayBuffer();
            this.samples.set(key, await this.ctx!.decodeAudioData(buf));
          } catch (err) {
            console.warn('Không đọc được file âm thanh', file, err);
          }
        }
      })
      .catch(() => {});
  }

  private playSample(key: string, vol: number): boolean {
    const buf = this.samples.get(key);
    if (!buf || !this.ctx || !this.sfxGain) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start();
    return true;
  }

  // ===================== TIẾNG KHÁNH NHỎ (CHIME) =====================
  public playChime() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    if (this.playSample('chime', 0.8)) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1760, t); // A6
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3520, t); // A7
    osc2.detune.setValueAtTime(4, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    if (this.convolver) {
      const rev = this.ctx.createGain();
      rev.gain.value = 0.5;
      gain.connect(rev);
      rev.connect(this.convolver);
    }

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 2.4);
    osc2.stop(t + 2.4);
  }

  // ===================== TIẾNG GIAO DIỆN NHẸ =====================
  public playClick() {
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  // ===================== NHẠC THIỀN NGŨ CỦNG PROCEDURAL =====================
  // Thang ngũ cung thiền: D, F, G, A, C (hoặc Hò, Xự, Xang, Xê, Cống)
  private PENTATONIC_FREQS = [
    293.66, // D4
    349.23, // F4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    698.46, // F5
    783.99, // G5
    880.00  // A5
  ];

  // ===================== NHẠC NỀN: TỔNG HỢP HOẶC FILE MP3 =====================
  public currentTrack = (() => {
    try { return localStorage.getItem('chua_music_track') || 'synth_zen'; } catch { return 'synth_zen'; }
  })();
  private audioEl: HTMLAudioElement | null = null;

  // Bắt đầu nhạc nền theo bài đã chọn lần trước
  public startMusic() {
    this.playTrack(this.currentTrack);
  }

  // id = 'synth_zen' (nhạc tổng hợp) hoặc tên file trong public/music
  public playTrack(id: string) {
    this.init();
    this.resume();
    if (!this.ctx || !this.musicGain) return;
    this.currentTrack = id;
    try { localStorage.setItem('chua_music_track', id); } catch {}

    // Nhạc tổng hợp: zen (mặc định), chuông xoay, đàn tranh
    if (id.startsWith('synth_')) {
      this.audioEl?.pause();
      const mode = id === 'synth_bowl' ? 'bowl' : id === 'synth_zither' ? 'zither' : 'zen';
      if (this.isMusicPlaying && this.synthMode !== mode) this.stopMusic();
      this.synthMode = mode;
      this.startZenMusic();
      return;
    }

    this.stopMusic();
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.loop = true;
      this.audioEl.preload = 'auto';
      // Đi qua musicGain để thanh âm lượng nhạc & nút tắt tiếng vẫn hoạt động
      this.ctx.createMediaElementSource(this.audioEl).connect(this.musicGain);
      this.audioEl.addEventListener('error', () => {
        console.warn('Không phát được file nhạc, quay về nhạc thiền tổng hợp');
        this.playTrack('synth_zen');
      });
    }
    this.audioEl.src = `/music/${encodeURIComponent(id)}`;
    this.audioEl.play().catch(() => {});
  }

  public startZenMusic() {
    this.init();
    this.resume();
    if (this.isMusicPlaying || !this.ctx || !this.musicGain) return;
    this.isMusicPlaying = true;

    // 1. Tạo Drone nền thanh tịnh liên tục
    this.startMeditationDrone();

    // 2. Tạo vòng lặp giai điệu sáo trúc / đàn tranh ngẫu nhiên
    this.scheduleNextMelodyNote();
  }

  private startMeditationDrone() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // D2 (73.42Hz) & A2 (110Hz) & D3 (146.83Hz)
    const freqs = [73.42, 110.0, 146.83, 220.0];

    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      // Lọc dải trầm ấm áp
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.045, t + 4.0);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(t);
      this.droneNodes.push({ osc, gain });
    }
  }

  private synthMode: 'zen' | 'bowl' | 'zither' = 'zen';

  private scheduleNextMelodyNote = () => {
    if (!this.isMusicPlaying || !this.ctx || !this.musicGain) return;

    if (this.synthMode === 'bowl') {
      // Chuông xoay: mỗi 5-9 giây một tiếng chuông ngân dài, xen tiếng sáo rất thưa
      this.musicTimer = window.setTimeout(() => {
        this.playSingingBowl();
        if (Math.random() > 0.75) window.setTimeout(() => this.playFluteNote(), 1800);
        this.scheduleNextMelodyNote();
      }, 5000 + Math.random() * 4000);
      return;
    }

    if (this.synthMode === 'zither') {
      // Đàn tranh: chuỗi 3-6 nốt gảy liền nhau đi lên/xuống theo ngũ cung, rồi nghỉ
      this.musicTimer = window.setTimeout(() => {
        const n = 3 + Math.floor(Math.random() * 4);
        let idx = Math.floor(Math.random() * (this.PENTATONIC_FREQS.length - 3));
        const dir = Math.random() > 0.5 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const noteIdx = Math.max(0, Math.min(this.PENTATONIC_FREQS.length - 1, idx));
          window.setTimeout(() => this.playZitherNote(this.PENTATONIC_FREQS[noteIdx]), i * (220 + Math.random() * 120));
          idx += dir * (Math.random() > 0.7 ? 2 : 1);
        }
        this.scheduleNextMelodyNote();
      }, 2200 + Math.random() * 2600);
      return;
    }

    // Khoảng cách giữa các nốt sáo: 2.5 ~ 6 giây tạo khoảng lặng sâu lắng
    const delay = 2500 + Math.random() * 3500;
    this.musicTimer = window.setTimeout(() => {
      this.playFluteNote();
      // Thỉnh thoảng gảy nốt đàn tranh (harp/zither pluck)
      if (Math.random() > 0.6) {
        window.setTimeout(() => this.playZitherNote(), 600 + Math.random() * 800);
      }
      this.scheduleNextMelodyNote();
    }, delay);
  };

  // Nốt sáo trúc thiền (với vibrato nhẹ và tiếng hơi)
  private playFluteNote() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    const freq = this.PENTATONIC_FREQS[Math.floor(Math.random() * this.PENTATONIC_FREQS.length)];
    const duration = 2.0 + Math.random() * 2.2;

    const osc = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    const noteGain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    // Rung (vibrato 5.2Hz)
    vibrato.frequency.setValueAtTime(5.2, t);
    vibratoGain.gain.setValueAtTime(2.5, t);
    vibrato.connect(osc.frequency);

    // Đường bao âm lượng mềm mại
    noteGain.gain.setValueAtTime(0, t);
    noteGain.gain.linearRampToValueAtTime(0.08, t + 0.6); // Mở hơi từ từ
    noteGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(noteGain);
    noteGain.connect(this.musicGain);

    if (this.convolver) {
      const rev = this.ctx.createGain();
      rev.gain.value = 0.4;
      noteGain.connect(rev);
      rev.connect(this.convolver);
    }

    vibrato.start(t);
    osc.start(t);
    vibrato.stop(t + duration + 0.2);
    osc.stop(t + duration + 0.2);
  }

  // Chuông xoay (singing bowl): các bồi âm không điều hoà, lệch nhẹ tạo tiếng "ngân" chậm
  private playSingingBowl() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const base = [196, 220, 261.63, 293.66][Math.floor(Math.random() * 4)];
    const out = this.ctx.createGain();
    out.gain.value = 0.9;
    out.connect(this.musicGain);
    if (this.convolver) {
      const rev = this.ctx.createGain();
      rev.gain.value = 0.5;
      out.connect(rev);
      rev.connect(this.convolver);
    }
    for (const [ratio, amp, decay] of [[1, 0.06, 9], [2.71, 0.03, 6], [5.15, 0.012, 3.5]]) {
      for (const detune of [-3, 3]) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = base * ratio;
        osc.detune.value = detune;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + decay + 0.1);
      }
    }
  }

  // Nốt đàn tranh thánh thót
  private playZitherNote(noteFreq?: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    const freq = (noteFreq ?? this.PENTATONIC_FREQS[Math.floor(Math.random() * this.PENTATONIC_FREQS.length)]) * 2;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    // Gảy dây đàn: tiếng công kích nhanh, tắt dần
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);

    osc.connect(gain);
    gain.connect(this.musicGain);

    if (this.convolver) {
      const rev = this.ctx.createGain();
      rev.gain.value = 0.35;
      gain.connect(rev);
      rev.connect(this.convolver);
    }

    osc.start(t);
    osc.stop(t + 2.0);
  }

  public stopMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    for (const d of this.droneNodes) {
      try {
        d.gain.gain.linearRampToValueAtTime(0.0001, (this.ctx?.currentTime || 0) + 1.0);
        setTimeout(() => d.osc.stop(), 1100);
      } catch {}
    }
    this.droneNodes = [];
    this.isMusicPlaying = false;
  }
}

export const sound = new SoundEngine();
