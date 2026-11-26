import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_CHOICE, loadAvatarChoice, type AvatarChoice } from './choice';
import { loadProfilePhoto } from '../lib/camera';
import { loadProfile } from '../profile/profile';

interface Me {
  choice: AvatarChoice;
  photo: string | null;
  name: string;
  reload: () => Promise<void>;
}

const Ctx = createContext<Me>({ choice: DEFAULT_CHOICE, photo: null, name: '', reload: async () => undefined });

export function AvatarProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<AvatarChoice>(DEFAULT_CHOICE);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');

  const reload = useCallback(async () => {
    try {
      setChoice(await loadAvatarChoice());
      setPhoto(await loadProfilePhoto());
      setName((await loadProfile())?.name ?? '');
    } catch {
      // Vault locked: keep defaults.
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return <Ctx.Provider value={{ choice, photo, name, reload }}>{children}</Ctx.Provider>;
}

export const useMe = () => useContext(Ctx);
