import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';

import { useUiStore } from '../../state/ui-store';
import { SHORTCUT_SECTIONS, SHORTCUTS, shortcutLabel } from './shortcuts';

/**
 * "Keyboard shortcuts" (018 FR-039): every shortcut from the shared table, one table per
 * section. Opened by "?" or the zoom island's keyboard button.
 */
export function ShortcutHelpDialog() {
  const open = useUiStore((s) => s.helpOpen);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  return (
    <Dialog open={open} onOpenChange={setHelpOpen}>
      <DialogContent className="max-h-[80vh] w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>⌘ is Ctrl outside macOS.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUT_SECTIONS.map((section) => {
            const headingId = `shortcuts-${section.toLowerCase()}`;
            return (
              <section key={section} aria-labelledby={headingId}>
                <h3 id={headingId} className="mb-1.5 text-micro text-ink-muted uppercase">
                  {section}
                </h3>
                <table aria-labelledby={headingId} className="w-full text-body-sm">
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Action</th>
                      <th scope="col">Keys</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SHORTCUTS.filter((shortcut) => shortcut.section === section).map(
                      (shortcut) => (
                        <tr key={shortcut.id} className="border-b border-hairline last:border-0">
                          <td className="py-1.5 pr-3 text-ink-secondary">{shortcut.label}</td>
                          <td className="py-1.5 text-right">
                            <kbd className="rounded-segment bg-surface-2 px-1.5 py-0.5 font-mono text-code-sm text-ink">
                              {shortcutLabel(shortcut.id)}
                            </kbd>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
