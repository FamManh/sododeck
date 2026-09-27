import { Button } from '@sododeck/ui/components/button';
import { Moon, Sun } from 'lucide-react';

import { ButtonsSection } from '../design-gallery/buttons-section';
import { FieldsSection } from '../design-gallery/fields-section';
import { useThemeStore } from '../theme/theme-store';

/**
 * Dev-only review gallery (/design): every @sododeck/ui building block in every variant and
 * state, for side-by-side comparison with docs/design/screens. Never shipped to production.
 */
export function DesignGalleryPage() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-hairline bg-surface px-6">
        <h1 className="text-title-md">Design gallery</h1>
        <span className="text-caption text-ink-muted">Dev only · @sododeck/ui</span>
        <Button
          className="ml-auto"
          onClick={() => {
            setTheme(nextTheme);
          }}
        >
          {theme === 'light' ? <Moon /> : <Sun />}
          Switch to {nextTheme}
        </Button>
      </header>
      <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <ButtonsSection />
        <FieldsSection />
      </main>
    </div>
  );
}
