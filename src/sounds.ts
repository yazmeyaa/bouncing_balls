export class Sounds {
    public soundsEnabled = false;
    private audioCtx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private currentFrequencyIdx = 0;
    private willFrequencyIncrement = true;
    private frequencies = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];

    private readonly beepDuration: number = 0.25;

    private switchFrequency() {
        if (this.willFrequencyIncrement && (this.currentFrequencyIdx + 1 >= this.frequencies.length)) this.willFrequencyIncrement = false;
        if (this.willFrequencyIncrement === false && (this.currentFrequencyIdx - 1 < 0)) this.willFrequencyIncrement = true;
        if (this.willFrequencyIncrement) {
            this.currentFrequencyIdx++;
        } else this.currentFrequencyIdx--;
    }

    public enableSounds() {
        this.soundsEnabled = true;

        this.audioCtx = new AudioContext();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.connect(this.audioCtx.destination)
        this.masterGain.gain.value = 0.01;
    }

    public disableSounds() {
        this.soundsEnabled = false;

        this.audioCtx = null;
    }

    public beep() {
        if (!this.soundsEnabled || !this.audioCtx) return;
        //* Create & Connect all sound nodes;
        const oscillator = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        oscillator.connect(gain)
        gain.connect(this.audioCtx.destination);

        //* Create sounds:
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(this.frequencies[this.currentFrequencyIdx], this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, this.audioCtx.currentTime + this.beepDuration * (1 / 3));
        gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + this.beepDuration * (2 / 3));

        oscillator.start();

        //* Disconnect & Stop all sound nodes;
        //* GC will eat all this instances;
        oscillator.stop(this.audioCtx.currentTime + this.beepDuration);
        setTimeout(() => {
            oscillator.disconnect();
            gain.disconnect();
        }, this.beepDuration * 1000)
        this.switchFrequency();
    }
}
