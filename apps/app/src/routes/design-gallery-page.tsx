import { Button } from '@sododeck/ui/components/button';
import { Toaster, ToastProvider } from '@sododeck/ui/components/toast';
import { Moon, Sun } from 'lucide-react';

import { ButtonsSection } from '../design-gallery/buttons-section';
import { FeedbackSection } from '../design-gallery/feedback-section';
import { FieldsSection } from '../design-gallery/fields-section';
import { KeyboardSection } from '../design-gallery/keyboard-section';
import { KindsSection } from '../design-gallery/kinds-section';
import { OverlaysSection } from '../design-gallery/overlays-section';
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
    <ToastProvider>
      <div className="min-h-dvh">
        <a
          href="#main"
          className="sr-only rounded-button bg-surface px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:outline-2 focus:outline-solid focus:outline-primary"
        >
          Skip to content
        </a>
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
          <KindsSection />
          <FeedbackSection />
          <OverlaysSection />
          <KeyboardSection />
        </main>
      </div>
      <Toaster />
    </ToastProvider>
  );
}
