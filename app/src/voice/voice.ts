import { Capacitor } from '@capacitor/core';
import { apiCall, getSession } from '../lib/account';
import { audit } from '../lib/vault';
import { db } from '../lib/db';
import { hasPermission } from '../lib/permissions';
import { getAiConsent } from '../lib/ai';

/**
 * AURA's voice.
 * Speaking: ElevenLabs through the AURA server when it has a key and you are
 * logged in; otherwise the phone's own text-to-speech (free, offline), tuned
 * to prefer smooth/natural system voices and user-selected presets.
 * Listening: ElevenLabs speech-to-text (understands Hindi and English mixed);
 * otherwise the phone's own speech recogniser.
 * Only the text to speak, or the short voice clip, leaves the phone.
 */

export interface VoiceStyle {
  eleven: string; // ElevenLabs stock voice id
  pitch: number; // for the phone voice
  rate: number;
  hints?: string[];
}

export interface VoicePreset {
  id: string;
  label: string;
  eleven: string;
  pitch: number;
  rate: number;
  hints: string[];
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'smooth',
    label: 'Smooth & sweet (Siri-style)',
    eleven: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    pitch: 1.04,
    rate: 0.96,
    hints: ['siri', 'samantha', 'ava', 'zoe', 'aria', 'jenny', 'google uk english female', 'google us english', 'neerja', 'veena'],
  },
  {
    id: 'calm',
    label: 'Soft & calm',
    eleven: 'pFZP5JQG7iQjIQuC4Bku', // Lily
    pitch: 0.98,
    rate: 0.92,
    hints: ['serena', 'sonia', 'karen', 'moira', 'fiona', 'lily', 'google uk english female'],
  },
  {
    id: 'bright',
    label: 'Clear & upbeat',
    eleven: '21m00Tcm4TlvDq8ikWAM', // Rachel
    pitch: 1.06,
    rate: 1.0,
    hints: ['google us english', 'allison', 'victoria', 'tessa', 'rachel', 'samantha'],
  },
  {
    id: 'warm-male',
    label: 'Warm & steady',
    eleven: 'TX3LPaxmHKxFdv7VOQHJ', // Liam
    pitch: 0.92,
    rate: 0.96,
    hints: ['daniel', 'rishi', 'guy', 'ryan', 'google uk english male', 'alex', 'aaron'],
  },
];

export interface DeviceVoice {
  id: string;
  name: string;
  lang: string;
  natural: boolean;
  index?: number;
}

const STYLES: Record<string, VoiceStyle> = {
  ananya: { eleven: '21m00Tcm4TlvDq8ikWAM', pitch: 1.05, rate: 0.97, hints: VOICE_PRESETS[0].hints }, // Rachel
  meera: { eleven: 'EXAVITQu4vr4xnSDxMaL', pitch: 1.04, rate: 0.96, hints: VOICE_PRESETS[0].hints }, // Sarah
  priya: { eleven: 'XB0fDUnXU5powFXDhCwa', pitch: 1.02, rate: 0.95, hints: VOICE_PRESETS[1].hints }, // Charlotte
  kamala: { eleven: 'pFZP5JQG7iQjIQuC4Bku', pitch: 0.96, rate: 0.92, hints: VOICE_PRESETS[1].hints }, // Lily
  arjun: { eleven: 'TX3LPaxmHKxFdv7VOQHJ', pitch: 0.92, rate: 0.97, hints: VOICE_PRESETS[3].hints }, // Liam
  kabir: { eleven: 'bIHbv24MWmeRgasZH58o', pitch: 0.88, rate: 0.97, hints: VOICE_PRESETS[3].hints }, // Will
  rahul: { eleven: 'nPczCjzI2devNBz1zQrb', pitch: 0.88, rate: 0.95, hints: VOICE_PRESETS[3].hints }, // Brian
  ramesh: { eleven: 'JBFqnCBsd6RMkjVDRZzb', pitch: 0.85, rate: 0.92, hints: VOICE_PRESETS[3].hints }, // George
};
const DEFAULT_STYLE = STYLES.ananya;

export const styleFor = (characterId?: string): VoiceStyle => (characterId && STYLES[characterId]) || DEFAULT_STYLE;

export function resolveVoiceStyle(characterId: string | undefined, presetId: string): VoiceStyle {
  if (presetId && presetId !== 'auto') {
    const preset = VOICE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      return { eleven: preset.eleven, pitch: preset.pitch, rate: preset.rate, hints: preset.hints };
    }
  }
  return styleFor(characterId);
}

export async function getVoiceChoice(): Promise<{ preset: string; deviceId?: string }> {
  const preset = String((await db.meta.get('voice-preset'))?.value ?? 'smooth');
  const deviceId = (await db.meta.get('voice-device-id'))?.value;
  return { preset, deviceId: typeof deviceId === 'string' && deviceId ? deviceId : undefined };
}

export async function setVoiceChoice(preset: string, deviceId?: string): Promise<void> {
  await db.meta.put({ key: 'voice-preset', value: preset || 'smooth' });
  if (deviceId) {
    await db.meta.put({ key: 'voice-device-id', value: deviceId });
  } else {
    await db.meta.delete('voice-device-id');
  }
}

const NATURAL_RE = /(natural|online|enhanced|premium|neural|siri|google|samantha|ava|zoe|serena|aria|jenny|sonia|daniel|rishi)/i;

export function isNaturalVoiceName(name: string): boolean {
  return NATURAL_RE.test(name);
}

/** Pick the smoothest matching voice from a list of available voices. */
export function pickBestVoice<T extends { name: string; lang: string; voiceURI?: string }>(
  voices: readonly T[],
  hints: readonly string[] = [],
  preferredId?: string,
): T | undefined {
  if (!voices.length) return undefined;
  if (preferredId) {
    const exact = voices.find((v) => (v.voiceURI ?? v.name) === preferredId || v.name === preferredId);
    if (exact) return exact;
  }
  const enVoices = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pool = enVoices.length ? enVoices : [...voices];

  let best: T | undefined;
  let bestScore = -1;
  for (const v of pool) {
    const lower = v.name.toLowerCase();
    let score = 0;
    if (isNaturalVoiceName(v.name)) score += 30;
    if (/^en[-_](in|us|gb|au)/i.test(v.lang)) score += 5;
    const hintIdx = hints.findIndex((h) => lower.includes(h));
    if (hintIdx !== -1) score += 50 - hintIdx;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

async function getWebVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const synth = window.speechSynthesis;
  const immediate = synth.getVoices();
  if (immediate.length > 0) return immediate;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener?.('voiceschanged', finish);
    setTimeout(finish, 400);
  });
}

export async function listDeviceVoices(): Promise<DeviceVoice[]> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      const { voices } = await TextToSpeech.getSupportedVoices();
      return voices
        .map((v, index) => ({
          id: v.voiceURI || v.name,
          name: v.name,
          lang: v.lang,
          natural: isNaturalVoiceName(v.name),
          index,
        }))
        .filter((v) => /^(en|hi)([-_]|$)/i.test(v.lang))
        .sort((a, b) => Number(b.natural) - Number(a.natural) || a.name.localeCompare(b.name))
        .slice(0, 30);
    }
    const voices = await getWebVoices();
    const seen = new Set<string>();
    return voices
      .filter((v) => /^(en|hi)([-_]|$)/i.test(v.lang))
      .filter((v) => {
        const key = `${v.name}|${v.lang}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((v) => ({
        id: v.voiceURI || v.name,
        name: v.name,
        lang: v.lang,
        natural: isNaturalVoiceName(v.name),
      }))
      .sort((a, b) => Number(b.natural) - Number(a.natural) || a.name.localeCompare(b.name))
      .slice(0, 30);
  } catch {
    return [];
  }
}

/** Turn chat text into something pleasant to hear. */
export function speakable(text: string): string {
  return text
    .replace(/[*_#`>|]/g, ' ')
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/(\d)\s*h\b/g, '$1 hours')
    .replace(/(\d)\s*min\b/g, '$1 minutes')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 650);
}

let serverVoice: { on: boolean; at: number; reachable: boolean } | null = null;
let current: HTMLAudioElement | null = null;
/** Why the last reply used the phone voice instead of ElevenLabs (shown in Ask). */
let lastIssue: string | null = null;
export const voiceIssue = () => lastIssue;

export async function cloudVoiceReady(): Promise<boolean> {
  if (!(await getSession())) {
    lastIssue = 'Log in (☰ menu) to use the ElevenLabs voice. Using your phone voice for now.';
    return false;
  }
  // Re-check every minute, so turning the server on later works without restarting AURA.
  if (!serverVoice || Date.now() - serverVoice.at > 60_000) {
    try {
      const on = (await apiCall<{ enabled: boolean }>('/v1/voice/status', { method: 'GET', label: 'voice-status', timeoutMs: 4000 })).enabled;
      serverVoice = { on, at: Date.now(), reachable: true };
    } catch {
      // Remember for a minute, so the next replies use the phone voice straight away.
      serverVoice = { on: false, at: Date.now(), reachable: false };
    }
  }
  if (!serverVoice.reachable) lastIssue = 'The AURA server is not reachable (same Wi-Fi? server running?). Using your phone voice.';
  else if (!serverVoice.on) lastIssue = 'ElevenLabs key is not set on the server (AURA_ELEVEN_KEY). Using your phone voice.';
  return serverVoice.on;
}

function playToEnd(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onpause = () => resolve(); // stopped by the person
    audio.onerror = () => reject(new Error('Could not play the audio.'));
    audio.play().catch(reject);
  });
}

export async function getAutoSpeak(): Promise<boolean> {
  return (await db.meta.get('voice-auto'))?.value === 'on';
}

export async function setAutoSpeak(on: boolean): Promise<void> {
  await db.meta.put({ key: 'voice-auto', value: on ? 'on' : 'off' });
}

export async function stopSpeaking(): Promise<void> {
  current?.pause();
  current = null;
  try {
    if (Capacitor.isNativePlatform()) {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      await TextToSpeech.stop();
    } else window.speechSynthesis?.cancel();
  } catch {
    /* nothing playing */
  }
}

async function phoneVoice(text: string, s: VoiceStyle, deviceId?: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
    let voiceIndex: number | undefined;
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      const chosen = pickBestVoice(voices, s.hints, deviceId);
      if (chosen) {
        const idx = voices.indexOf(chosen);
        if (idx >= 0) voiceIndex = idx;
      }
    } catch {
      /* use platform default */
    }
    await TextToSpeech.speak({
      text,
      lang: 'en-IN',
      rate: s.rate,
      pitch: s.pitch,
      volume: 1,
      category: 'playback',
      ...(voiceIndex !== undefined ? { voice: voiceIndex } : {}),
    });
    return;
  }
  if (!('speechSynthesis' in window)) throw new Error('This browser cannot speak.');
  const voices = await getWebVoices();
  const chosen = pickBestVoice(voices, s.hints, deviceId);
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    if (chosen) {
      u.voice = chosen;
      u.lang = chosen.lang;
    } else {
      u.lang = 'en-IN';
    }
    u.pitch = s.pitch;
    u.rate = s.rate;
    u.onend = () => resolve();
    u.onerror = () => reject(new Error('Could not speak.'));
    window.speechSynthesis.speak(u);
  });
}

/** Speak text in the chosen voice (or character voice). Returns which voice was used. */
export async function speak(text: string, characterId?: string): Promise<'eleven' | 'phone'> {
  const say = speakable(text);
  if (!say) return 'phone';
  await stopSpeaking();
  const choice = await getVoiceChoice();
  const s = resolveVoiceStyle(characterId, choice.preset);
  if ((await getAiConsent()) && (await cloudVoiceReady())) {
    try {
      const session = await getSession();
      const r = await apiCall<{ audio: string; mime: string }>('/v1/voice/speak', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session!.token}` },
        body: JSON.stringify({ text: say, voice: s.eleven }),
        label: 'voice-speak (only the reply text)',
        timeoutMs: 12_000,
      });
      const audio = new Audio(`data:${r.mime};base64,${r.audio}`);
      current = audio;
      await audit('voice', `Spoke a ${say.length}-character reply with ElevenLabs`);
      lastIssue = null;
      await playToEnd(audio);
      return 'eleven';
    } catch (e) {
      lastIssue = `ElevenLabs did not work (${e instanceof Error ? e.message : 'unknown error'}). Using your phone voice.`;
    }
  }
  await phoneVoice(say, s, choice.deviceId);
  return 'phone';
}

// ---------------- Listening ----------------

export interface Listener {
  /** Resolves with what was said ('' if nothing). */
  result: Promise<string>;
  /** Stop recording early and transcribe. */
  stop: () => void;
  via: 'eleven' | 'phone';
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Could not read the recording.'));
    r.readAsDataURL(b);
  });
}

async function phoneListen(): Promise<Listener> {
  if (Capacitor.isNativePlatform()) {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
    const { available } = await SpeechRecognition.available();
    if (!available) throw new Error('Speech recognition is not available on this phone. Install or update the Google app.');
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') throw new Error('Allow the microphone to talk to AURA.');
    const result = SpeechRecognition.start({ language: 'en-IN', maxResults: 1, partialResults: false, popup: true }).then(
      (r) => r?.matches?.[0] ?? '',
    );
    return { result, stop: () => void SpeechRecognition.stop(), via: 'phone' };
  }
  type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onerror: (e: { error: string }) => void; onend: () => void; start: () => void; stop: () => void };
  const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) throw new Error('Voice input needs Chrome, the Android app, or ElevenLabs on the server.');
  const rec = new Ctor();
  rec.lang = 'en-IN';
  rec.interimResults = false;
  const result = new Promise<string>((resolve, reject) => {
    let said = '';
    rec.onresult = (e) => (said = e.results[0][0].transcript);
    rec.onerror = (e) => (e.error === 'no-speech' ? resolve('') : reject(new Error(e.error === 'not-allowed' ? 'Allow the microphone to talk to AURA.' : 'Could not hear that.')));
    rec.onend = () => resolve(said);
  });
  rec.start();
  return { result, stop: () => rec.stop(), via: 'phone' };
}

async function cloudListen(maxSeconds: number): Promise<Listener> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), maxSeconds * 1000);
  const result = (async () => {
    await stopped;
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' });
    if (blob.size < 1500) return '';
    const session = await getSession();
    const r = await apiCall<{ text: string }>('/v1/voice/transcribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.token}` },
      body: JSON.stringify({ audio: await blobToBase64(blob), mime: blob.type.split(';')[0] }),
      label: 'voice-transcribe (a short voice clip)',
      timeoutMs: 20_000,
    });
    await audit('voice', `Turned a ${Math.round(blob.size / 1024)} KB voice clip into text with ElevenLabs`);
    return r.text;
  })();
  return { result, stop: () => rec.state !== 'inactive' && rec.stop(), via: 'eleven' };
}

/** Start listening. Uses ElevenLabs when available, otherwise the phone. */
export async function listen(maxSeconds = 15): Promise<Listener> {
  if (!(await hasPermission('microphone'))) throw new Error('Enable Microphone in Settings → Permissions first.');
  await stopSpeaking();
  if (await getAiConsent() && (await cloudVoiceReady()) && typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
    try {
      return await cloudListen(maxSeconds);
    } catch {
      /* microphone blocked in the web view: use the phone recogniser */
    }
  }
  return phoneListen();
}
