import { getRecord, putRecord } from './vault';

export type ThemePreference = 'light' | 'dark';

interface ThemeSetting {
  mode: ThemePreference;
}

export async function loadThemePreference(): Promise<ThemePreference | undefined> {
  const setting = await getRecord<ThemeSetting>('settings', 'theme');
  return setting?.mode === 'light' || setting?.mode === 'dark' ? setting.mode : undefined;
}

export async function saveThemePreference(mode: ThemePreference): Promise<void> {
  await putRecord<ThemeSetting>('settings', 'theme', { mode });
}
