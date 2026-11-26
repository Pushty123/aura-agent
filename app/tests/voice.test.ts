import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import {
  getVoiceChoice,
  isNaturalVoiceName,
  pickBestVoice,
  resolveVoiceStyle,
  setVoiceChoice,
  VOICE_PRESETS,
} from '../src/voice/voice';

describe('voice selection', () => {
  beforeEach(async () => {
    await db.meta.clear();
  });

  it('defaults to the smooth Siri-style preset and persists user selection', async () => {
    expect(await getVoiceChoice()).toEqual({ preset: 'smooth', deviceId: undefined });

    await setVoiceChoice('calm');
    expect(await getVoiceChoice()).toEqual({ preset: 'calm', deviceId: undefined });

    await setVoiceChoice('smooth', 'com.apple.voice.compact.en-US.Samantha');
    expect(await getVoiceChoice()).toEqual({
      preset: 'smooth',
      deviceId: 'com.apple.voice.compact.en-US.Samantha',
    });

    await setVoiceChoice('bright');
    expect(await getVoiceChoice()).toEqual({ preset: 'bright', deviceId: undefined });
  });

  it('resolves preset styles and falls back to character style on auto', () => {
    const smooth = resolveVoiceStyle('arjun', 'smooth');
    expect(smooth.pitch).toBeGreaterThan(1);
    expect(smooth.rate).toBeLessThan(1);

    const autoArjun = resolveVoiceStyle('arjun', 'auto');
    expect(autoArjun.pitch).toBeLessThan(1);
  });

  it('prefers natural/Siri-like voices over robotic defaults and respects explicit deviceId', () => {
    const voices = [
      { name: 'eSpeak Default', lang: 'en-US', voiceURI: 'espeak' },
      { name: 'Samantha', lang: 'en-US', voiceURI: 'samantha' },
      { name: 'Microsoft Aria Online (Natural)', lang: 'en-US', voiceURI: 'aria-natural' },
    ];

    const smoothHints = VOICE_PRESETS[0].hints;
    const picked = pickBestVoice(voices, smoothHints);
    expect(picked?.voiceURI).toBe('samantha');

    const explicit = pickBestVoice(voices, smoothHints, 'aria-natural');
    expect(explicit?.voiceURI).toBe('aria-natural');

    expect(isNaturalVoiceName('Microsoft Aria Online (Natural)')).toBe(true);
    expect(isNaturalVoiceName('eSpeak Default')).toBe(false);
  });
});
