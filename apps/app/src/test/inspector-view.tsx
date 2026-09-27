import { Inspector } from '../editor/inspector';
import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { useEditor } from '../model/use-editor';

/** The inspector over the provider's live deck. */
export function InspectorView({ onOpenRules }: { onOpenRules?: () => void }) {
  return <Inspector deck={useDeckSnapshot(useEditor().doc)} onOpenRules={onOpenRules} />;
}
