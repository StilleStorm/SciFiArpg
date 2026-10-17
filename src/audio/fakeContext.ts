/**
 * A recording stand-in for BaseAudioContext, for unit tests only: it keeps every node that was created, its connections
 * and the start/stop times of sources, so the music engine can be run in node and its node count checked.
 */
export class FakeParam {
  value = 0;
  calls: { kind: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number): FakeParam {
    this.value = value;
    this.calls.push({ kind: 'set', value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): FakeParam {
    this.value = value;
    this.calls.push({ kind: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): FakeParam {
    this.value = value;
    this.calls.push({ kind: 'exp', value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number): FakeParam {
    this.calls.push({ kind: 'target', value, time });
    return this;
  }
  cancelScheduledValues(): FakeParam {
    return this;
  }
}

export class FakeNode {
  connected: FakeNode[] = [];
  /** Params this node modulates (an LFO's gain connected to a delayTime). */
  paramTargets: FakeParam[] = [];
  disconnected = false;
  onended: (() => void) | null = null;
  started: number | null = null;
  stopped: number | null = null;
  buffer: FakeBuffer | null = null;
  loop = false;
  type = '';
  curve: Float32Array | null = null;
  gain = new FakeParam();
  frequency = new FakeParam();
  delayTime = new FakeParam();
  playbackRate = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  constructor(readonly kind: string) {}
  connect(to: unknown): unknown {
    if (to instanceof FakeNode) this.connected.push(to);
    else if (to instanceof FakeParam) this.paramTargets.push(to);
    return to;
  }
  disconnect(): void {
    this.disconnected = true;
  }
  start(when = 0): void {
    this.started = when;
  }
  stop(when = 0): void {
    this.stopped = when;
  }
}

export class FakeBuffer {
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {}
  get duration(): number {
    return this.length / this.sampleRate;
  }
  copyToChannel(): void {
    /* the samples are not needed */
  }
  getChannelData(): Float32Array<ArrayBuffer> {
    return new Float32Array(this.length);
  }
}

export class FakeContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  destination = new FakeNode('destination');
  nodes: FakeNode[] = [];
  private make(kind: string): FakeNode {
    const n = new FakeNode(kind);
    this.nodes.push(n);
    return n;
  }
  createGain = (): FakeNode => this.make('gain');
  createBiquadFilter = (): FakeNode => this.make('biquad');
  createDelay = (): FakeNode => this.make('delay');
  createOscillator = (): FakeNode => this.make('osc');
  createBufferSource = (): FakeNode => this.make('buffer');
  createWaveShaper = (): FakeNode => this.make('shaper');
  createDynamicsCompressor = (): FakeNode => this.make('compressor');
  createBuffer = (channels: number, length: number, sampleRate: number): FakeBuffer => new FakeBuffer(channels, length, sampleRate);
  /** Sources that were given a stop time (the short-lived voices), with their span. */
  voices(): { start: number; stop: number; node: FakeNode }[] {
    return this.nodes
      .filter((n) => (n.kind === 'buffer' || n.kind === 'osc') && n.started !== null && n.stopped !== null)
      .map((n) => ({ start: n.started ?? 0, stop: n.stopped ?? 0, node: n }));
  }
  asContext(): BaseAudioContext {
    return this as unknown as BaseAudioContext;
  }
}
