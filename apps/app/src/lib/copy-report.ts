import { useToast } from '@sododeck/ui/components/toast';
import { useCallback, useState } from 'react';

import { copyText, couldNotCopyText } from './clipboard';

export type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * Copy for the problem and fidelity reports (062 R10), shared by every Copy button. `build` runs
 * on click, so a report is only turned into text when asked for. Success shows `copiedMessage` in
 * a toast (a polite live region); failure shows the "Couldn't copy" toast and exposes the text so
 * the caller can show it in a selectable text area (FR-017).
 */
export function useCopyReport(
  build: () => string,
  copiedMessage: string,
): { copy: () => Promise<void>; status: CopyStatus; text: string | null; reset: () => void } {
  const { toast } = useToast();
  const [state, setState] = useState<{ status: CopyStatus; text: string | null }>({
    status: 'idle',
    text: null,
  });
  const copy = useCallback(async () => {
    const text = build();
    if (await copyText(text)) {
      setState({ status: 'copied', text: null });
      toast({ message: copiedMessage });
    } else {
      setState({ status: 'failed', text });
      toast({ message: couldNotCopyText() });
    }
  }, [build, copiedMessage, toast]);
  const reset = useCallback(() => {
    setState({ status: 'idle', text: null });
  }, []);
  return { copy, status: state.status, text: state.text, reset };
}
