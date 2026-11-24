// RAVN recorder (step 8) — runs on the audio thread.
//
// Turns the microphone's samples (usually 48 kHz, maybe stereo) into
// 16 kHz mono 16-bit PCM and hands them to the page every ~0.5 s, along with
// how loud that half second was. The page stores the PCM and, at upload,
// wraps it in a WAV header. Plain PCM is what makes the recording survive an
// interruption: after iOS takes the mic away and gives it back, the page
// starts a fresh capture and its samples simply continue the same file,
// which an .m4a from a second MediaRecorder cannot do.
class RavnPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.outRate = 16000;
    this.step = sampleRate / this.outRate;   // input samples per output sample
    this.pos = 0;                              // fractional read position carried across blocks
    this.acc = 0; this.accN = 0;               // running average (a simple anti-alias filter)
    this.buf = new Int16Array(8000);           // 0.5 s at 16 kHz
    this.n = 0;
    this.sumSq = 0; this.peak = 0;
  }
  flush() {
    if (!this.n) return;
    const out = this.buf.slice(0, this.n);
    const rms = Math.sqrt(this.sumSq / this.n);
    this.port.postMessage({ pcm: out.buffer, rms, peak: this.peak }, [out.buffer]);
    this.n = 0; this.sumSq = 0; this.peak = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input.length || !input[0]) return true;   // no channel: nothing arrived this block
    const ch = input.length, len = input[0].length;
    for (let i = 0; i < len; i++) {
      let s = 0;
      for (let c = 0; c < ch; c++) s += input[c][i];
      this.acc += s / ch; this.accN++;
      this.pos += 1;
      if (this.pos >= this.step) {
        this.pos -= this.step;
        const v = Math.max(-1, Math.min(1, this.acc / this.accN));
        this.acc = 0; this.accN = 0;
        this.buf[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        this.sumSq += v * v; const a = v < 0 ? -v : v; if (a > this.peak) this.peak = a;
        if (this.n === this.buf.length) this.flush();
      }
    }
    return true;
  }
}
registerProcessor("ravn-pcm", RavnPcmProcessor);
