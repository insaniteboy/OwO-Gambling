// audio.js - Synthesized Sound Effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol=0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

const Sounds = {
    click: () => playTone(600, 'sine', 0.1, 0.05),
    spin: () => playTone(300, 'triangle', 0.1, 0.05),
    win: () => {
        playTone(400, 'sine', 0.2, 0.1);
        setTimeout(() => playTone(600, 'sine', 0.4, 0.1), 150);
        setTimeout(() => playTone(1000, 'sine', 0.6, 0.1), 300);
    },
    jackpot: () => {
        for(let i=0; i<10; i++) {
            setTimeout(() => playTone(800 + (i*50), 'square', 0.1, 0.1), i * 100);
        }
    },
    loss: () => {
        playTone(300, 'sawtooth', 0.3, 0.1);
        setTimeout(() => playTone(250, 'sawtooth', 0.4, 0.1), 200);
    },
    mineSafe: () => playTone(800, 'sine', 0.2, 0.08),
    mineExplode: () => {
        playTone(100, 'sawtooth', 0.5, 0.2);
        setTimeout(() => playTone(50, 'square', 0.5, 0.2), 100);
    },
    cashout: () => playTone(1200, 'sine', 0.5, 0.1)
};