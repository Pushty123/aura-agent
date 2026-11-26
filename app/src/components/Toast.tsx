import { useEffect, useState } from 'react';

/** Small message at the bottom of the screen. Send one with: window.dispatchEvent(new CustomEvent('aura-toast', { detail: 'text' })) */
export function Toast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 4500);
    };
    window.addEventListener('aura-toast', on);
    return () => {
      window.removeEventListener('aura-toast', on);
      clearTimeout(timer);
    };
  }, []);
  if (!text) return null;
  return (
    <div className="toast" role="status" aria-live="polite" onClick={() => setText(null)}>
      {text}
    </div>
  );
}

export const toast = (text: string) => window.dispatchEvent(new CustomEvent('aura-toast', { detail: text }));
