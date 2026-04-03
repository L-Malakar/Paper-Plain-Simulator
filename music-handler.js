// music-handler.js
const bgMusic = new Audio('music.webm');
bgMusic.loop = true;
bgMusic.volume = 0.5;

// Load saved music preference
let isMuted = localStorage.getItem('paperPlane_muted') === 'true';
bgMusic.muted = isMuted;

export function getMusicMuted() { return bgMusic.muted; }

bgMusic.addEventListener('timeupdate', () => {
    localStorage.setItem('paperPlane_musicTime', bgMusic.currentTime);
});

export function startMusic() {
    const savedTime = localStorage.getItem('paperPlane_musicTime');
    if (savedTime) {
        bgMusic.currentTime = parseFloat(savedTime);
    }
    bgMusic.play().catch(e => {
        console.log("Autoplay blocked by browser. Music will start upon first user interaction.");
        window.addEventListener('click', () => bgMusic.play(), { once: true });
    });
}

export function setMusicVolume(targetVolume) {
    bgMusic.volume = Math.max(0, Math.min(1, targetVolume));
}

export function toggleMute() {
    bgMusic.muted = !bgMusic.muted;
    localStorage.setItem('paperPlane_muted', bgMusic.muted);
    return bgMusic.muted;
}

// ── Synthesized Web Audio API (SFX) ──
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Load saved SFX preference
let sfxMuted = localStorage.getItem('paperPlane_sfxMuted') === 'true';

export function getSFXMuted() { return sfxMuted; }

export function toggleSFX() {
    sfxMuted = !sfxMuted;
    localStorage.setItem('paperPlane_sfxMuted', sfxMuted);
    return sfxMuted;
}

function initAudio() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

export function playClick() {
    if (sfxMuted) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

export function playCrash() {
    if (sfxMuted) return;
    initAudio();
    
    // Paper crumple/crinkle sound
    const bufferSize = audioCtx.sampleRate * 0.25; // 0.25 seconds
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        // Random crackle envelope for a papery texture
        if (Math.random() < 0.2) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i / bufferSize), 3);
        } else {
            data[i] = 0;
        }
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    // Bandpass filter to make it sound light and thin, not heavy
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3500; 
    filter.Q.value = 0.8;
    
    const gain = audioCtx.createGain();
    
    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    gain.gain.setValueAtTime(2.0, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    
    noiseSource.start();
}

export function playBeep(isGo = false) {
    if (sfxMuted) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}