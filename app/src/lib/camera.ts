import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { getRecord, putRecord } from './vault';
import { db } from './db';

/** Shrink a photo before storing it (keeps the encrypted vault small). */
export function downscale(dataUrl: string, maxSide = 320, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('That image could not be read.'));
    img.src = dataUrl;
  });
}

function pickFile(capture: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'user');
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsDataURL(f);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Take a photo with the camera, or choose one from the gallery. Returns a small JPEG data URL. */
export async function getPhoto(source: 'camera' | 'gallery'): Promise<string | null> {
  try {
    let raw: string | null;
    if (Capacitor.isNativePlatform()) {
      const p = await Camera.getPhoto({
        quality: 80,
        width: 640,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      });
      raw = p.dataUrl ?? null;
    } else {
      raw = await pickFile(source === 'camera');
    }
    return raw ? await downscale(raw) : null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/cancel/i.test(msg)) return null; // user closed the camera
    throw new Error(/permission|denied/i.test(msg) ? 'Camera permission was denied. Allow it in phone Settings → Apps → AURA.' : 'Could not open the camera.');
  }
}

export async function loadProfilePhoto(): Promise<string | null> {
  return (await getRecord<{ dataUrl: string }>('settings', 'photo:profile'))?.dataUrl ?? null;
}

export async function saveProfilePhoto(dataUrl: string): Promise<void> {
  await putRecord('settings', 'photo:profile', { dataUrl });
}

export async function removeProfilePhoto(): Promise<void> {
  await db.records.delete('settings:photo:profile');
}
