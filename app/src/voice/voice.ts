import { Capacitor } from '@capacitor/core';
import { apiCall, getSession } from '../lib/account';
import { audit } from '../lib/vault';
import { db } from '../lib/db';

/**
 * AURA's voice.
 * Speaking: ElevenLabs through the AURA server when it has a key and you are
 * logged in; otherwise the phone's own text-to-speech (free, offline).
 * Listening: ElevenLabs speech-to-text (understands Hindi and English mixed);
 * otherwise the phone's own speech recogniser.
 * Only the text to speak, or the short voice clip, leaves the phone.
 */

interface VoiceStyle {
  eleven: string; // ElevenLabs stock voice id
  pitch: number; // for the phone voice
  rate: number;
}

const STYLES: Record<string, VoiceStyle> = {
  ananya: { eleven: '21m00Tcm4TlvDq8ikWAM', pitch: 1.1, rate: 1 }, // Rachel
  meera: { eleven: 'EXAVITQu4vr4xnSDxMaL', pitch: 1.1, rate: 1 }, // Sarah
  priya: { eleven: 'XB0fDUnXU5powFXDhCwa', pitch: 1.05, rate: 0.97 }, // Charlotte
  kamala: { eleven: 'pFZP5JQG7iQjIQuC4Bku', pitch: 0.95, rate: 0.9 }, // Lily
  arjun: { eleven: 'TX3LPaxmHKxFdv7VOQHJ', pitch: 0.9, rate: 1 }, // Liam
  kabir: { eleven: 'bIHbv24MWmeRgasZH58o', pitch: 0.85, rate: 1 }, // Will
  rahul: { eleven: 'nPczCjzI2devNBz1zQrb', pitch: 0.85, rate: 0.97 }, // Brian
  ramesh: { eleven: 'JBFqnCBsd6RMkjVDRZzb', pitch: 0.8, rate: 0.9 }, // George
};
const DEFAULT_STYLE = STYLES.ananya;

export const styleFor = (characterId?: string): VoiceStyle => (characterId && STYLES[characterId]) || DEFAULT_STYLE;

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

let serverVoice: { on: boolean; at: number } | null = null;
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
      const on = (await apiCall<{ enabled: boolean }>('/v1/voice/status', { method: 'GET', label: 'voice-status' })).enabled;
      serverVoice = { on, at: Date.now() };
    } catch {
      lastIssue = 'The AURA server is not reachable (same Wi-Fi? server running?). Using your phone voice.';
      return false;
    }
  }
  if (!serverVoice.on) lastIssue = 'ElevenLabs key is not set on the server (AURA_ELEVEN_KEY). Using your phone voice.';
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

async function phoneVoice(text: string, s: VoiceStyle): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
    await TextToSpeech.speak({ text, lang: 'en-IN', rate: s.rate, pitch: s.pitch, volume: 1, category: 'playback' });
    return;
  }
  if (!('speechSynthesis' in window)) throw new Error('This browser cannot speak.');
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.pitch = s.pitch;
    u.rate = s.rate;
    u.onend = () => resolve();
    u.onerror = () => reject(new Error('Could not speak.'));
    window.speechSynthesis.speak(u);
  });
}

/** Speak text in the character's voice. Returns which voice was used. */
export async function speak(text: string, characterId?: string): Promise<'eleven' | 'phone'> {
  const say = speakable(text);
  if (!say) return 'phone';
  await stopSpeaking();
  const s = styleFor(characterId);
  if (await cloudVoiceReady()) {
    try {
      const session = await getSession();
      const r = await apiCall<{ audio: string; mime: string }>('/v1/voice/speak', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session!.token}` },
        body: JSON.stringify({ text: say, voice: s.eleven }),
        label: 'voice-speak (only the reply text)',
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
  await phoneVoice(say, s);
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
    });
    await audit('voice', `Turned a ${Math.round(blob.size / 1024)} KB voice clip into text with ElevenLabs`);
    return r.text;
  })();
  return { result, stop: () => rec.state !== 'inactive' && rec.stop(), via: 'eleven' };
}

/** Start listening. Uses ElevenLabs when available, otherwise the phone. */
export async function listen(maxSeconds = 15): Promise<Listener> {
  await stopSpeaking();
  if ((await cloudVoiceReady()) && typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
    try {
      return await cloudListen(maxSeconds);
    } catch {
      /* microphone blocked in the web view: use the phone recogniser */
    }
  }
  return phoneListen();
}
