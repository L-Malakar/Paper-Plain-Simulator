/**
 * ═══════════════════════════════════════════════════════════════
 *  music-handler.js — Audio System
 *  Background music (WebAudio) + synthesised SFX
 * ═══════════════════════════════════════════════════════════════
 */

// ── Background music ──────────────────────────────────────────
const bgMusic       = new Audio('music.webm');
bgMusic.loop        = true;

let musicVolume = parseFloat(localStorage.getItem('paperPlane_musicVol') ?? '0.5');
let isMuted     = localStorage.getItem('paperPlane_muted') === 'true';
bgMusic.volume  = musicVolume;
bgMusic.muted   = isMuted;

export const getMusicMuted  = () => bgMusic.muted;
export const getMusicVolume = () => musicVolume;

bgMusic.addEventListener('timeupdate', () => {
  localStorage.setItem('paperPlane_musicTime', bgMusic.currentTime);
});

export function startMusic() {
  const saved = localStorage.getItem('paperPlane_musicTime');
  if (saved) bgMusic.currentTime = parseFloat(saved);
  bgMusic.play().catch(() => {
    window.addEventListener('click',      () => bgMusic.play(), { once: true });
    window.addEventListener('touchstart', () => bgMusic.play(), { once: true });
  });
}

export function setMusicVolume(vol) {
  musicVolume    = Math.max(0, Math.min(1, vol));
  bgMusic.volume = musicVolume;
  localStorage.setItem('paperPlane_musicVol', musicVolume);
  if (isMuted && musicVolume > 0) toggleMute();
}

export function toggleMute() {
  bgMusic.muted = !bgMusic.muted;
  isMuted       = bgMusic.muted;
  localStorage.setItem('paperPlane_muted', bgMusic.muted);
  return bgMusic.muted;
}

// ── SFX engine (Web Audio API) ────────────────────────────────
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx     = new AudioContext();

const masterGain   = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

let sfxVolume = parseFloat(localStorage.getItem('paperPlane_sfxVol') ?? '1.0');
let sfxMuted  = localStorage.getItem('paperPlane_sfxMuted') === 'true';
masterGain.gain.value = sfxMuted ? 0 : sfxVolume;

export const getSFXMuted  = () => sfxMuted;
export const getSFXVolume = () => sfxVolume;

export function toggleSFX() {
  sfxMuted = !sfxMuted;
  localStorage.setItem('paperPlane_sfxMuted', sfxMuted);
  masterGain.gain.setValueAtTime(sfxMuted ? 0 : sfxVolume, audioCtx.currentTime);
  return sfxMuted;
}

export function setSFXVolume(vol) {
  sfxVolume = Math.max(0, Math.min(1, vol));
  localStorage.setItem('paperPlane_sfxVol', sfxVolume);
  if (!sfxMuted) masterGain.gain.setValueAtTime(sfxVolume, audioCtx.currentTime);
  if (sfxMuted && sfxVolume > 0) toggleSFX();
}

function resumeCtx() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ── Individual SFX ────────────────────────────────────────────
export function playClick() {
  if (sfxMuted) return; resumeCtx();
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.connect(env); env.connect(masterGain);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.09);
  env.gain.setValueAtTime(0.25, audioCtx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

export function playCoin() {
  if (sfxMuted) return; resumeCtx();
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.connect(env); env.connect(masterGain);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1100, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2200, audioCtx.currentTime + 0.12);
  env.gain.setValueAtTime(0.3, audioCtx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

export function playCrash() {
  if (sfxMuted) return; resumeCtx();
  const bufSize = audioCtx.sampleRate * 0.3;
  const buf     = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data    = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = Math.random() < 0.2
      ? (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3)
      : 0;
  }
  const src    = audioCtx.createBufferSource();
  src.buffer   = buf;
  const filter = audioCtx.createBiquadFilter();
  filter.type  = 'bandpass';
  filter.frequency.value = 3500;
  filter.Q.value = 0.8;
  const env    = audioCtx.createGain();
  src.connect(filter); filter.connect(env); env.connect(masterGain);
  env.gain.setValueAtTime(2.0, audioCtx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  src.start();
}

export function playBeep(isGo = false) {
  if (sfxMuted) return; resumeCtx();
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.connect(env); env.connect(masterGain);
  osc.type = 'square';
  osc.frequency.setValueAtTime(isGo ? 880 : 440, audioCtx.currentTime);
  env.gain.setValueAtTime(0.2, audioCtx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
  osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}
