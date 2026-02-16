class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
    }

    init() {
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    play(type) {
        if (!this.enabled) return;
        this.init();

        switch (type) {
            case 'tick': this.playTone(800, 0.05, 'square'); break;
            case 'tick-warning': this.playTone(600, 0.08, 'square'); break;
            case 'tick-danger': this.playTone(400, 0.12, 'sawtooth'); break;
            case 'submit': this.playMelody([523, 659, 784], 0.1); break;
            case 'reveal': this.playMelody([392, 523, 659, 784], 0.15); break;
            case 'achievement': this.playMelody([523, 659, 784, 1047], 0.12); break;
            case 'join': this.playTone(523, 0.15, 'sine'); break;
            case 'error': this.playTone(200, 0.2, 'sawtooth'); break;
            case 'countdown': this.playTone(440, 0.1, 'triangle'); break;
            case 'complete':
                this.playMelody([523, 587, 659, 698, 784, 880, 988, 1047], 0.08);
                break;
        }
    }

    playTone(frequency, duration, type = 'sine') {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001,
            this.audioContext.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start();
        osc.stop(this.audioContext.currentTime + duration);
    }

    playMelody(frequencies, noteDuration) {
        frequencies.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, noteDuration * 2), i * noteDuration * 1000);
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}