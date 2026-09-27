import { Button } from '@sododeck/ui/components/button';
import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => {
    observer.disconnect();
  };
}

const isDark = () => document.documentElement.classList.contains('dark');

/** React island proving @sododeck/ui components work in Astro. Shares the app's storage key. */
export function ThemeToggle() {
  // Server snapshot is "light"; the real value is read on hydration without a mismatch.
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => {
        document.documentElement.classList.toggle('dark', !dark);
        try {
          localStorage.setItem('sododeck:theme', dark ? 'light' : 'dark');
        } catch {
          // non-critical preference
        }
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
