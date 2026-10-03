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

/** The nav theme switch (a React island reusing `@sododeck/ui`'s Button). Shares the app's storage key. */
export function ThemeToggle() {
  // Server snapshot is "light"; the real value is read on hydration without a mismatch.
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  return (
    <Button
      variant="ghost"
      size="icon"
      // The landing nav draws it as a 36px bordered tile (board `Sododeck Landing.dc.html`).
      className="size-9 rounded-[10px] border-[1.5px] border-border-strong bg-surface text-ink-secondary"
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
